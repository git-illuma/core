import type { NodeBase } from "../api/token";
import type { InjectorFn } from "../api/types";
import { InjectionContext } from "../context/context";
import { InjectionError } from "../errors";
import type { iInstantiationParams, iMiddleware } from "../plugins/middlewares";
import { Injector } from "../utils/injector";
import type { ProtoNodeMulti, ProtoNodeSingle, ProtoNodeTransparent } from "./proto";

/** @deprecated */
export type DependencyPool = Map<NodeBase<any>, TreeNode<any>>;
export type InjectionPool =
  | Map<NodeBase<any>, TreeNode<any>>
  | WeakMap<NodeBase<any>, TreeNode<any>>;

function runMiddlewares<T>(
  middlewares: iMiddleware[],
  params: iInstantiationParams<T>,
): T {
  const ms = middlewares as iMiddleware<T>[];
  const next = (i: number, current: iInstantiationParams<T>): T => {
    if (i >= ms.length) return current.factory();
    return ms[i](current, (nextParams) => next(i + 1, nextParams));
  };

  return next(0, params);
}

function retrieverFactory<T>(
  node: NodeBase<T>,
  deps: InjectionPool,
  transparentDeps: Set<TreeNodeTransparent>,
): InjectorFn {
  return (token: NodeBase<T>, optional: boolean | undefined): T | null => {
    const depNode = deps.get(token);
    if (!depNode && !optional) {
      const transparent = Array.from(transparentDeps).find(
        (n) => "proto" in n && n.proto.parent.token === token,
      );
      if (transparent) return transparent.instance;
      throw InjectionError.untracked(token, node);
    }

    return depNode?.instance ?? null;
  };
}

// Tree Nodes
export class TreeRootNode {
  private readonly _deps: Set<TreeNode<any>> = new Set();
  private readonly _treePool: InjectionPool = new WeakMap();

  constructor(
    public readonly instant = true,
    protected readonly middlewares: iMiddleware[] = [],
  ) {}

  public get dependencies(): Set<TreeNode<any>> {
    return this._deps;
  }

  public addDependency(node: TreeNode<any>): void {
    this._deps.add(node);
  }

  public build(): void {
    for (const dep of this._deps) {
      if ("token" in dep.proto) this._treePool.set(dep.proto.token, dep);

      if (this.instant) dep.instantiate(this._treePool, this.middlewares);
      else dep.collectPool(this._treePool);
    }
  }

  public find<T>(token: NodeBase<T>): TreeNode<T> | null {
    const node = this._treePool.get(token);
    if (!node) return null;

    if (!this.instant) node.instantiate(this._treePool, this.middlewares);
    return node as TreeNode<T>;
  }

  public toString(): string {
    return "TreeRootNode";
  }
}

export class TreeNodeSingle<T = any> {
  private readonly _transparent: Set<TreeNodeTransparent> = new Set();
  private readonly _deps: DependencyPool = new Map();
  private _instance: T | null = null;
  private _resolved = false;
  public allocations = 0;

  public get instance(): T {
    if (!this._resolved) {
      throw InjectionError.instanceAccessFailed(this.proto.token);
    }

    return this._instance as T;
  }

  constructor(public readonly proto: ProtoNodeSingle<T>) {
    if (proto.token === Injector) {
      // biome-ignore lint/style/noNonNullAssertion: Instantiate Injector immediately
      this._instance = proto.factory!() as unknown as T;
      this._resolved = true;
    }
  }

  public addDependency(node: TreeNode<any>): void {
    if (node instanceof TreeNodeTransparent) this._transparent.add(node);
    else this._deps.set(node.proto.token, node);
    node.allocations++;
  }

  public collectPool(pool: InjectionPool): void {
    for (const node of this._deps.values()) node.collectPool(pool);
    for (const dep of this._transparent) dep.collectPool(pool);

    pool.set(this.proto.token, this);
  }

  public instantiate(pool?: InjectionPool, middlewares: iMiddleware[] = []): void {
    if (this._resolved) return;

    for (const node of this._deps.values()) node.instantiate(pool, middlewares);
    for (const dep of this._transparent) dep.instantiate(pool, middlewares);

    const retriever = retrieverFactory(this.proto.token, this._deps, this._transparent);
    const factory = this.proto.factory ?? this.proto.token.opts?.factory;
    if (!factory) throw InjectionError.notFound(this.proto.token);

    const contextFactory = () => InjectionContext.instantiate(factory, retriever);
    this._instance = runMiddlewares(middlewares, {
      token: this.proto.token,
      factory: contextFactory,
    });

    this._resolved = true;

    if (pool) pool.set(this.proto.token, this);
  }

  public toString(): string {
    return `TreeNodeSingle<${this.proto.token.toString()}>`;
  }
}

export class TreeNodeTransparent<T = any> {
  private readonly _transparent = new Set<TreeNodeTransparent>();
  private readonly _deps: DependencyPool = new Map();
  private _instance: T | null = null;
  private _resolved = false;
  public allocations = 0;

  public get instance(): T {
    if (!this._resolved) throw InjectionError.accessFailed();
    return this._instance as T;
  }

  constructor(public readonly proto: ProtoNodeTransparent<T>) {}

  public addDependency(node: TreeNode<any>): void {
    if (node instanceof TreeNodeTransparent) this._transparent.add(node);
    else this._deps.set(node.proto.token, node);

    node.allocations++;
  }

  public collectPool(pool: InjectionPool): void {
    for (const node of this._deps.values()) node.collectPool(pool);
    for (const dep of this._transparent) dep.collectPool(pool);
  }

  public instantiate(pool?: InjectionPool, middlewares: iMiddleware[] = []): void {
    if (this._resolved) return;

    for (const dep of this._transparent) dep.instantiate(pool, middlewares);
    for (const node of this._deps.values()) node.instantiate(pool, middlewares);

    const retriever = retrieverFactory(
      this.proto.parent.token,
      this._deps,
      this._transparent,
    );

    const refFactory = () => InjectionContext.instantiate(this.proto.factory, retriever);
    this._instance = runMiddlewares(middlewares, {
      token: this.proto.parent.token,
      factory: refFactory,
    });

    this._resolved = true;
  }

  public toString(): string {
    return `TreeNodeTransparent<${this.proto.parent.token.toString()}>`;
  }
}

export class TreeNodeMulti<T = any> {
  private readonly _deps = new Set<TreeNode<any>>();
  public readonly instance: T[] = [];
  private _resolved = false;
  public allocations = 0;

  constructor(public readonly proto: ProtoNodeMulti<T>) {}

  public collectPool(pool: InjectionPool): void {
    for (const dep of this._deps) dep.collectPool(pool);
    pool.set(this.proto.token, this);
  }

  public instantiate(pool?: InjectionPool, middlewares: iMiddleware[] = []): void {
    if (this._resolved) return;

    for (const dep of this._deps) {
      dep.instantiate(pool, middlewares);

      if (dep instanceof TreeNodeSingle) {
        this.instance.push(dep.instance);
      } else if (dep instanceof TreeNodeMulti) {
        this.instance.push(...dep.instance);
      } else if (dep instanceof TreeNodeTransparent) {
        this.instance.push(dep.instance);
      }
    }

    this._resolved = true;
    if (pool) pool.set(this.proto.token, this);
  }

  public addDependency(...nodes: TreeNode[]): void {
    for (const node of nodes) {
      this._deps.add(node);
      node.allocations++;
    }
  }

  public toString(): string {
    return `TreeNodeMulti<${this.proto.token.toString()}>`;
  }
}

export type TreeNode<T = any> =
  | TreeNodeSingle<T>
  | TreeNodeMulti<T>
  | TreeNodeTransparent<T>;
