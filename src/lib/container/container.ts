import { getInjectableToken, isConstructor, isInjectable } from "../api/decorator";
import { nodeInject } from "../api/injection";
import type { NodeBase } from "../api/token";
import { extractToken, isNodeBase, MultiNodeToken, NodeToken } from "../api/token";
import type { InjectorFn, iNodeInjectorOptions } from "../api/types";
import { InjectionContext } from "../context";
import { InjectionError } from "../errors";
import { Illuma } from "../plugins/core/plugin-container";
import type { iMiddleware } from "../plugins/middlewares";
import { runMiddlewares } from "../plugins/middlewares/runner";
import {
  extractProvider,
  ProtoNodeMulti,
  ProtoNodeSingle,
  resolveTreeNode,
  TreeRootNode,
} from "../provider";
import type { ProtoNode } from "../provider/proto";
import type { UpstreamGetter } from "../provider/resolver";
import type { TreeNode } from "../provider/tree-node";
import type { Ctor, iNodeProvider, Provider, Token } from "../provider/types";
import { Injector, InjectorImpl } from "../utils/injector";
import { LifecycleRef, LifecycleRefImpl } from "./lifecycle";
import type { iContainerOptions, iDIContainer } from "./types";

/**
 * The main Dependency Injection Container class that holds registered providers
 * and resolves instances of those dependencies.
 *
 * The container supports hierarchical scoping, allowing child containers to inherit
 * providers from parent containers while maintaining their own registrations. It also supports lifecycle management, ensuring proper cleanup of resources when containers are destroyed.
 *
 * @param options - Optional configuration for the container
 *
 * @example
 * ```typescript
 * const container = new NodeContainer();
 * container.provide({ provide: CONFIG_TOKEN, useValue: { apiKey: '123' } });
 * container.bootstrap();
 *
 * const config = container.get(CONFIG_TOKEN);
 * ```
 */
export class NodeContainer extends Illuma implements iDIContainer {
  private _bootstrapped = false;
  private _rootNode?: TreeRootNode;

  private readonly _unsubParentBootstrap?: () => void;
  private readonly _unsubParentDestroy?: () => void;

  private readonly _parent?: iDIContainer;
  private readonly _protoNodes = new Map<NodeToken<any>, ProtoNodeSingle<any>>();
  private readonly _multiProtoNodes = new Map<MultiNodeToken<any>, ProtoNodeMulti<any>>();
  protected readonly _lifecycle: LifecycleRefImpl = new LifecycleRefImpl();
  protected readonly _injector: InjectorImpl = new InjectorImpl(this);

  /**
   * Indicates whether the container has been destroyed.
   */
  public get destroyed(): boolean {
    return this._lifecycle.destroyed;
  }

  /**
   * Indicates whether the container has been bootstrapped.
   */
  public get bootstrapped(): boolean {
    return this._bootstrapped;
  }

  constructor(protected readonly _opts?: iContainerOptions) {
    super();
    this._parent = _opts?.parent;

    if (this._parent) {
      if (this._parent.destroyed) {
        throw InjectionError.parentDestroyed();
      }

      if (this._parent instanceof NodeContainer) {
        if (!this._parent.bootstrapped) {
          this._unsubParentBootstrap = this._parent._lifecycle.onChildBootstrap(() =>
            this.bootstrap(),
          );
        }

        this._unsubParentDestroy = this._parent._lifecycle.onChildDestroy(() =>
          this.destroy(),
        );
      }
    }
  }

  /**
   * Registers a provider in the container.
   * Must be called before {@link bootstrap}.
   *
   * @template T - The type of value being provided
   * @param provider - The provider configuration (token, class, or provider object)
   * @throws {InjectionError} If called after bootstrap or if a duplicate provider is detected
   *
   * @example
   * ```typescript
   * // Provide a value
   * container.provide({ provide: CONFIG_TOKEN, value: { apiKey: '123' } });
   *
   * // Provide a factory
   * container.provide({ provide: LOGGER_TOKEN, factory: () => new ConsoleLogger() });
   *
   * // Provide an injectable class directly
   * container.provide(UserService);
   *
   * // Provide a class override
   * container.provide({ provide: ServiceClass, useClass: ServiceOverride });
   * ```
   */
  public provide<T>(provider: Provider<T>): void {
    if (this._bootstrapped) {
      throw InjectionError.bootstrapped();
    }

    if (Array.isArray(provider)) {
      for (const item of provider) this.provide(item);
      return;
    }

    // Handle node token declarations
    if (provider instanceof MultiNodeToken) {
      this._registerMultiDeclaration(provider);
      return;
    }

    // Handle multi node token declarations
    if (provider instanceof NodeToken) {
      this._registerSingleDeclaration(provider);
      return;
    }

    // Handle constructors
    if (typeof provider === "function") {
      if (!isInjectable<T>(provider)) throw InjectionError.invalidCtor(provider);

      const token = getInjectableToken<T>(provider);
      if (!(token instanceof NodeToken)) throw InjectionError.invalidCtor(provider);

      const existing = this._assertSingleFactoryAssignable(token);

      const factory = token.opts?.factory ?? (() => new provider());
      if (existing) {
        existing.setFactory(factory);
        return;
      }

      const proto = new ProtoNodeSingle<T>(token, factory);
      this._protoNodes.set(token, proto);
      return;
    }

    // Extract token and retriever from provider object or constructor
    const obj = provider as iNodeProvider<T>;
    const token = extractToken(obj.provide);
    const retriever = extractProvider<T>(obj);

    if (token instanceof MultiNodeToken) {
      const multiProto = this._multiProtoNodes.get(token);
      if (multiProto) {
        multiProto.addProvider(retriever);
        return;
      }

      const newProto = new ProtoNodeMulti<T>(token);
      this._multiProtoNodes.set(token, newProto);
      newProto.addProvider(retriever);
      return;
    }

    if (token instanceof NodeToken) {
      const existing = this._assertSingleFactoryAssignable(token);

      let factory: (() => T) | undefined;
      if (typeof retriever === "function") factory = retriever;
      if (isNodeBase<T>(retriever)) {
        if (retriever === token) throw InjectionError.loopAlias(token);
        factory = () => nodeInject<NodeBase<T>>(retriever);
      }

      if (existing && factory) {
        existing.setFactory(factory);
        return;
      }

      const proto = new ProtoNodeSingle<T>(token, factory);
      this._protoNodes.set(token, proto);
      return;
    }

    throw InjectionError.invalidProvider(JSON.stringify(provider));
  }

  /**
   * Finds a resolved dependency node in the container's injection tree.
   * Internal representation of a node is returned, which contains the instance and other metadata.
   *
   * @template T - The type of value the node provides.
   * @param token - The token or class to look up in the container.
   * @returns The corresponding tree node, or null if the container is not bootstrapped or the token is not found.
   */
  public findNode<T>(token: Token<T>): TreeNode<T> | null {
    if (!this._rootNode) return null;
    if (!this._bootstrapped) return null;

    if (isInjectable<T>(token)) {
      const node = getInjectableToken<T>(token);
      return this._rootNode.obtain(node);
    }

    const treeNode = this._rootNode.obtain(token as NodeBase<T>);
    return treeNode;
  }

  public bootstrap(): void {
    if (this._bootstrapped) throw InjectionError.doubleBootstrap();
    if (this._parent) {
      if (this._parent.destroyed) throw InjectionError.parentDestroyed();
      if (!this._parent.bootstrapped) throw InjectionError.parentNotBootstrapped();
    }

    const start = performance.now();

    this.provide(Injector.withValue(this._injector));
    this.provide(LifecycleRef.withValue(this._lifecycle));

    this._rootNode = this._buildInjectionTree();
    this._rootNode.build();
    this._bootstrapped = true;

    const end = performance.now();
    const duration = end - start;
    if (this._opts?.measurePerformance) {
      console.log(`[Illuma] 🚀 Bootstrapped in ${duration.toFixed(2)} ms`);
    }

    this._lifecycle.runBootstrapHooks();

    // Run diagnostics if enabled or diagnostics modules are registered
    if (Illuma.hasDiagnostics()) {
      const allNodes = this._rootNode.dependencies.size;
      const unusedNodes = Array.from(this._rootNode.dependencies)
        .filter((node) => node.allocations === 0)
        .filter((node) => {
          if (!(node.proto instanceof ProtoNodeSingle)) return true;
          return node.proto.token !== Injector;
        });

      Illuma.onReport({
        totalNodes: allNodes,
        unusedNodes: unusedNodes,
        bootstrapDuration: duration,
      });
    }
  }

  /**
   * Retrieves an instance from the container.
   * Must be called after {@link bootstrap}.
   *
   * @template T - The type of value being retrieved (typically inferred)
   * @param token - The token or class to retrieve
   * @returns For NodeToken: a single instance. For MultiNodeToken: an array of instances.
   * @throws {InjectionError} If called before bootstrap or if the token is not found
   *
   * @example
   * ```typescript
   * // Get a single provider
   * const logger = container.get(LoggerToken);
   *
   * // Get a decorated class
   * const service = container.get(UserService);
   *
   * // Get multiple providers
   * const plugins = container.get(PluginToken); // Returns array
   * ```
   */
  public get<T>(token: MultiNodeToken<T>, options?: iNodeInjectorOptions): T[];
  public get<T>(
    token: NodeToken<T>,
    options: iNodeInjectorOptions & { optional: true },
  ): T | null;
  public get<T>(token: NodeToken<T>, options?: iNodeInjectorOptions): T;
  public get<T>(
    token: Ctor<T>,
    options: iNodeInjectorOptions & { optional: true },
  ): T | null;
  public get<T>(token: Ctor<T>, options?: iNodeInjectorOptions): T;
  public get<T>(provider: Token<T>, options?: iNodeInjectorOptions): T | T[] | null {
    if (!this._bootstrapped || !this._rootNode) {
      throw InjectionError.notBootstrapped();
    }

    const token = extractToken(provider);
    const { optional, self, skipSelf } = options ?? {};

    if (self && skipSelf) {
      throw InjectionError.conflictingStrategies(token as any);
    }

    if (!skipSelf) {
      const treeNode = this._rootNode.obtain(token);
      if (treeNode) return treeNode.instance;
    }

    if (!self) {
      const upstream = this._getFromParent(token);
      if (upstream) return upstream.instance;

      const rootSingleton = this._resolveSingletonFrom(this, token, true);
      if (rootSingleton) return rootSingleton.instance;
    }

    if (optional) return null;
    if (!skipSelf && token instanceof MultiNodeToken) return [];

    throw InjectionError.notFound(token);
  }

  public produce<T>(fn: Ctor<T> | (() => T)): T {
    if (typeof fn !== "function") throw InjectionError.invalidProvider(fn);

    if (!this._bootstrapped || !this._rootNode) {
      throw InjectionError.notBootstrapped();
    }

    let factory: () => T;
    if (isInjectable<T>(fn)) {
      const f = getInjectableToken<T>(fn).opts?.factory;
      if (!f) factory = () => new fn();
      else factory = () => getInjectableToken<T>(fn).opts?.factory?.() as T;
    } else {
      factory = isConstructor(fn) ? () => new fn() : (fn as () => T);
    }

    const rootNode = this._rootNode;
    if (!rootNode) throw InjectionError.notBootstrapped();

    const retriever: InjectorFn = (
      token,
      { optional, self, skipSelf }: iNodeInjectorOptions = {},
    ) => {
      if (self && skipSelf) {
        throw InjectionError.conflictingStrategies(token as NodeBase<any>);
      }

      if (!skipSelf) {
        const node = rootNode.obtain<T>(token);
        if (node) return node.instance;
      }

      if (!self) {
        const upstream = this._getFromParent(token);
        if (upstream) return upstream.instance;
      }

      if (!skipSelf && token instanceof MultiNodeToken) return [];
      if (!skipSelf && token instanceof NodeToken && token.opts?.singleton) {
        const singleton = this._getRootSingleton(token, true);
        if (singleton) return singleton.instance;
      }

      if (!optional) throw InjectionError.notFound(token);
      return null;
    };

    const middlewares = [...Illuma._middlewares, ...this.collectMiddlewares()];
    const contextFactory = () => InjectionContext.instantiate(factory, retriever);

    if (!middlewares.length) {
      return contextFactory();
    }

    const deps = InjectionContext.scan(factory);
    return runMiddlewares(middlewares, {
      token: new NodeToken<T>("ProducedNode"),
      deps: new Set([...deps.values()].map((d) => d.token)),
      factory: contextFactory,
    });
  }

  public destroy(): void {
    if (this._lifecycle.destroyed) throw InjectionError.destroyed();
    this._lifecycle.destroy();

    if (this._rootNode) {
      this._rootNode.destroy();
      this._rootNode = undefined;
    }

    this._unsubParentBootstrap?.();
    this._unsubParentDestroy?.();
    this._bootstrapped = false;
    this._protoNodes.clear();
  }

  public child(): iDIContainer {
    if (this.destroyed) throw InjectionError.destroyed();
    return new NodeContainer({ parent: this });
  }

  /** @internal */
  private _findNode<T>(token: Token<T>): TreeNode<T> | null {
    if (!this._rootNode) return null;
    if (!this._bootstrapped) return null;

    if (isInjectable<T>(token)) {
      const node = getInjectableToken<T>(token);
      return this._rootNode.find(node);
    }

    if (!isNodeBase<T>(token)) return null;
    return this._rootNode.find(token as NodeBase<T>);
  }

  /** @internal */
  private _getRootSingleton<T>(
    token: NodeToken<T>,
    instantiate = false,
  ): TreeNode<T> | null {
    if (!token.opts?.singleton) return null;
    let root: NodeContainer = this;

    while (root._parent instanceof NodeContainer) root = root._parent;

    const existing = root._findNode(token);
    if (existing) {
      if (!root._rootNode) return existing;
      return instantiate ? root._rootNode.obtain(token) : existing;
    }

    let proto = root._protoNodes.get(token) as ProtoNodeSingle<T> | undefined;
    if (!proto) {
      proto = new ProtoNodeSingle(token, token.opts.factory);
      root._protoNodes.set(token, proto);
    } else if (!proto.hasFactory() && token.opts.factory) {
      proto.setFactory(token.opts.factory);
    }

    if (!root._bootstrapped || !root._rootNode) {
      return null;
    }

    const cache = new Map<ProtoNode, TreeNode>();
    const upstream: UpstreamGetter = (upstreamToken) => {
      const local = root._findNode(upstreamToken);
      if (local) return local;
      return root._resolverFromParent(upstreamToken);
    };

    const treeNode = resolveTreeNode(
      proto,
      cache,
      root._protoNodes,
      root._multiProtoNodes,
      upstream,
    );

    root._rootNode.registerDependency(treeNode);
    return instantiate ? root._rootNode.obtain(token) : root._rootNode.find(token);
  }

  /** @internal */
  private _getFromParent<T>(token: Token<T>): TreeNode<T> | null {
    if (!this._parent) return null;
    const parentNode = this._parent as NodeContainer;

    const upstream = parentNode.findNode(token);
    if (upstream) return upstream;

    return this._resolveSingletonFrom(parentNode, token, true);
  }

  /** @internal */
  private _resolverFromParent<T>(token: Token<T>): TreeNode<T> | null {
    if (!this._parent || !(this._parent instanceof NodeContainer)) return null;

    const upstream = this._parent._findNode(token);
    if (upstream) return upstream;

    return this._resolveSingletonFrom(this._parent, token, false);
  }

  /** @internal */
  private _buildInjectionTree(): TreeRootNode {
    const middlewares = [...Illuma._middlewares, ...this.collectMiddlewares()];
    const root = new TreeRootNode(this._opts?.instant, middlewares);
    const cache = new Map<ProtoNode, TreeNode>();

    const nodes: ProtoNode[] = [
      ...this._protoNodes.values(),
      ...this._multiProtoNodes.values(),
    ];

    const upstreamGetter: UpstreamGetter = this._resolverFromParent.bind(this);

    for (const node of nodes) {
      if (cache.has(node)) continue;

      const treeNode = resolveTreeNode(
        node,
        cache,
        this._protoNodes,
        this._multiProtoNodes,
        upstreamGetter,
      );

      root.addDependency(treeNode);
    }

    cache.clear();
    this._protoNodes.clear();
    this._multiProtoNodes.clear();

    return root;
  }

  /** @internal */
  private _registerMultiDeclaration<T>(token: MultiNodeToken<T>): void {
    if (this._multiProtoNodes.has(token)) {
      throw InjectionError.duplicate(token);
    }

    this._multiProtoNodes.set(token, new ProtoNodeMulti<T>(token));
  }

  /** @internal */
  private _registerSingleDeclaration<T>(token: NodeToken<T>): void {
    if (this._protoNodes.has(token)) {
      throw InjectionError.duplicate(token);
    }

    this._protoNodes.set(token, new ProtoNodeSingle<T>(token));
  }

  /** @internal */
  private _assertSingleFactoryAssignable<T>(
    token: NodeToken<T>,
  ): ProtoNodeSingle<T> | undefined {
    const existing = this._protoNodes.get(token) as ProtoNodeSingle<T> | undefined;
    if (existing?.hasFactory()) throw InjectionError.duplicate(token);
    return existing;
  }

  /** @internal */
  private _resolveSingletonFrom<T>(
    container: NodeContainer,
    token: Token<T>,
    instantiate: boolean,
  ): TreeNode<T> | null {
    if (!(token instanceof NodeToken) || !token.opts?.singleton) return null;
    return container._getRootSingleton(token, instantiate);
  }

  /** @internal */
  protected collectMiddlewares(): iMiddleware[] {
    return [
      ...(this._parent &&
      "collectMiddlewares" in this._parent &&
      typeof this._parent.collectMiddlewares === "function"
        ? this._parent.collectMiddlewares()
        : []),
      ...this.middlewares,
    ];
  }
}
