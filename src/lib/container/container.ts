import type { NodeBase } from "../api";
import {
  extractToken,
  INJECTION_SYMBOL,
  isNodeBase,
  MultiNodeToken,
  NodeToken,
  nodeInject,
} from "../api";
import { InjectionError } from "../errors";
import type { ProtoNode, TreeNode, UpstreamGetter } from "../provider";
import {
  extractProvider,
  ProtoNodeMulti,
  ProtoNodeSingle,
  resolveTreeNode,
  TreeRootNode,
} from "../provider";
import type {
  Ctor,
  iDIContainer,
  iNodeProvider,
  iNodeProviderSet,
  Providable,
  Token,
} from "../types";
import { Injector, InjectorImpl } from "../utils";

/**
 * Configuration options for the NodeContainer.
 */
export interface iContainerOptions {
  /**
   * When true, logs the bootstrap time to the console based on performance.now()
   * difference before and after bootstrap.
   * @default false
   */
  measurePerformance?: boolean;
  parent?: iDIContainer;
}

export class NodeContainer implements iDIContainer {
  private _bootstrapped = false;
  private _rootNode?: TreeRootNode;

  private readonly _parent?: iDIContainer;
  private readonly _protoNodes = new Map<NodeToken<any>, ProtoNodeSingle<any>>();
  private readonly _multiProtoNodes = new Map<MultiNodeToken<any>, ProtoNodeMulti<any>>();

  constructor(private readonly _opts?: iContainerOptions) {
    this._parent = _opts?.parent;
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
  public provide<T>(provider: Providable<T>): void {
    if (this._bootstrapped) {
      throw InjectionError.bootstrapped();
    }

    // Handle node token declarations
    if (provider instanceof MultiNodeToken) {
      if (this._multiProtoNodes.has(provider)) {
        throw InjectionError.duplicate(provider);
      }

      const newProto = new ProtoNodeMulti<T>(provider);
      this._multiProtoNodes.set(provider, newProto);
      return;
    }

    // Handle multi node token declarations
    if (provider instanceof NodeToken) {
      if (this._protoNodes.has(provider)) {
        throw InjectionError.duplicate(provider);
      }

      const proto = new ProtoNodeSingle<T>(provider);
      this._protoNodes.set(provider, proto);
      return;
    }

    // Handle constructors
    if (typeof provider === "function") {
      if (!(INJECTION_SYMBOL in provider)) throw InjectionError.invalidCtor(provider);

      const token = provider[INJECTION_SYMBOL];
      if (!(token instanceof NodeToken)) throw InjectionError.invalidCtor(provider);

      const existing = this._protoNodes.get(token);
      if (existing?.hasFactory()) throw InjectionError.duplicate(token);

      const factory = () => new provider();
      if (existing) {
        existing.setFactory(factory);
        return;
      }

      const proto = new ProtoNodeSingle<T>(token, factory);
      this._protoNodes.set(token, proto);
      return;
    }

    // Extract token and retriever from provider object or constructor
    const token = extractToken((<iNodeProvider<T>>provider).provide);
    const retriever = extractProvider<T>(provider);

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
      const existing = this._protoNodes.get(token);
      if (existing?.hasFactory()) throw InjectionError.duplicate(token);

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
   * Includes a provider set (group of providers) into the container.
   * This is useful for organizing related providers together.
   *
   * @param group - A provider set created with {@link createProviderSet}
   *
   * @example
   * ```typescript
   * const databaseProviders = createProviderSet(
   *   { provide: DbToken, useClass: PostgresDb },
   *   { provide: CacheToken, useClass: RedisCache }
   * );
   *
   * container.include(databaseProviders);
   * ```
   */
  public include(group: iNodeProviderSet): void {
    group(this);
  }

  public findNode<T>(token: Token<T>): TreeNode<T> | null {
    if (!this._rootNode) return null;
    const treeNode = this._rootNode.find(token);
    return treeNode;
  }

  private _getFromParent<T>(token: Token<T>): TreeNode<T> | null {
    if (!this._parent) return null;
    const parentNode = this._parent as NodeContainer;
    return parentNode.findNode(token);
  }

  private _buildInjectionTree(): TreeRootNode {
    const root = new TreeRootNode();
    const cache = new Map<ProtoNode, TreeNode>();

    const nodes: ProtoNode[] = [
      ...this._protoNodes.values(),
      ...this._multiProtoNodes.values(),
    ];

    const upstreamGetter: UpstreamGetter = this._getFromParent.bind(this);

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

  /**
   * Bootstraps the container by resolving the dependency trees and instantiating all providers.
   * This must be called after all providers are registered and before calling {@link get}.
   *
   * The bootstrap process:
   * 1. Validates all provider registrations
   * 2. Builds dependency injection trees
   * 3. Detects circular dependencies in each tree
   * 4. Instantiates all dependencies in the correct order
   *
   * @throws {InjectionError} If the container is already bootstrapped or if circular dependencies are detected
   *
   * @example
   * ```typescript
   * const container = new NodeContainer();
   * container.provide(UserService);
   * container.provide(LoggerService);
   * container.bootstrap(); // Resolves and instantiates all dependencies
   * ```
   */
  public bootstrap(): void {
    if (this._bootstrapped) throw InjectionError.doubleBootstrap();

    const start = performance.now();

    this.provide({
      provide: Injector,
      value: new InjectorImpl(this),
    });

    this._rootNode = this._buildInjectionTree();
    this._rootNode.instantiate();
    this._bootstrapped = true;

    const end = performance.now();
    if (this._opts?.measurePerformance) {
      const duration = end - start;
      console.log(`[Illuma] 🚀 Bootstrapped in ${duration.toFixed(2)} ms`);
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
  public get<T>(token: MultiNodeToken<T>): T[];
  public get<T>(token: NodeToken<T>): T;
  public get<T>(token: Ctor<T>): T;
  public get<T>(provider: Token<T>): T | T[] {
    if (!this._bootstrapped || !this._rootNode) {
      throw InjectionError.notBootstrapped();
    }

    let token: NodeBase<T> | null = null;
    if (typeof provider === "function") {
      if (!(INJECTION_SYMBOL in provider)) {
        throw InjectionError.invalidCtor(provider);
      }

      token = provider[INJECTION_SYMBOL] as NodeBase<T>;
    }

    if (isNodeBase<T>(provider)) token = provider;

    if (!token) {
      throw InjectionError.invalidProvider(JSON.stringify(provider));
    }

    const treeNode = this._rootNode.find(token);
    if (!treeNode) {
      const upstream = this._getFromParent(token);
      if (upstream) return upstream.instance;

      if (token instanceof MultiNodeToken) return [];
      throw InjectionError.notFound(token);
    }

    return treeNode.instance;
  }
}
