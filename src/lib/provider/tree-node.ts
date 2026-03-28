import { MultiNodeToken, type NodeBase } from "../api/token";
import type { InjectorFn } from "../api/types";
import { InjectionContext } from "../context/context";
import { InjectionError } from "../errors";
import type { iMiddleware } from "../plugins/middlewares";
import { runMiddlewares } from "../plugins/middlewares/runner";
import { Injector } from "../utils/injector";
import type { ProtoNodeMulti, ProtoNodeSingle, ProtoNodeTransparent } from "./proto";

export type DependencyPool = Map<NodeBase<any>, TreeNode<any>>;
export type InjectionPool =
  | Map<NodeBase<any>, TreeNode<any>>
  | WeakMap<NodeBase<any>, TreeNode<any>>;

// Tree Nodes
export class TreeRootNode {
  private readonly _deps: Set<TreeNode<any>> = new Set();
  private readonly _treePool: InjectionPool = new Map();

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

  public registerDependency(node: TreeNode<any>): void {
    this._deps.add(node);

    if ("token" in node.proto) {
      const existing = this._treePool.get(node.proto.token);
      if (existing) return;
    }

    if (this.instant) node.instantiate(this._treePool, this.middlewares);
    else node.collectPool(this._treePool);
  }

  public build(): void {
    for (const dep of this._deps) {
      if ("token" in dep.proto) this._treePool.set(dep.proto.token, dep);

      if (this.instant) dep.instantiate(this._treePool, this.middlewares);
      else dep.collectPool(this._treePool);
    }
  }

  public obtain<T>(token: NodeBase<T>): TreeNode<T> | null {
    const node = this._treePool.get(token);
    if (!node) return null;

    if (!this.instant) node.instantiate(this._treePool, this.middlewares);
    return node as TreeNode<T>;
  }

  public find<T>(token: NodeBase<T>): TreeNode<T> | null {
    const node = this._treePool.get(token);
    if (!node) return null;
    return node as TreeNode<T>;
  }

  public toString(): string {
    return "TreeRootNode";
  }
}

export class TreeNodeSingle<T = any> {
  private readonly _transparentMap: Map<NodeBase<any>, TreeNodeTransparent> = new Map();
  private readonly _transparentList: TreeNodeTransparent[] = [];
  private readonly _transparentIndex = new Map<NodeBase<any>, number>();

  private readonly _deps: DependencyPool = new Map();
  private readonly _depsList: TreeNode<any>[] = [];
  private readonly _depsIndex = new Map<NodeBase<any>, number>();
  private readonly _depsTokens = new Set<NodeBase<any>>();

  private _instance: T | null = null;
  private _collected = false;
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
    if (node instanceof TreeNodeTransparent) {
      const token = node.proto.parent.token;
      this._transparentMap.set(token, node);
      upsertIndexedDependency(token, node, this._transparentIndex, this._transparentList);

      this._depsTokens.add(token);
    } else {
      const token = node.proto.token;
      this._deps.set(token, node);
      upsertIndexedDependency(token, node, this._depsIndex, this._depsList);

      this._depsTokens.add(token);
    }

    node.allocations++;
  }

  public collectPool(pool: InjectionPool): void {
    if (this._collected) {
      pool.set(this.proto.token, this);
      return;
    }

    for (let i = 0; i < this._depsList.length; i++) {
      this._depsList[i].collectPool(pool);
    }

    for (let i = 0; i < this._transparentList.length; i++) {
      this._transparentList[i].collectPool(pool);
    }

    this._collected = true;
    pool.set(this.proto.token, this);
  }

  public instantiate(pool?: InjectionPool, middlewares: iMiddleware[] = []): void {
    if (this._resolved) return;

    for (let i = 0; i < this._depsList.length; i++) {
      this._depsList[i].instantiate(pool, middlewares);
    }

    for (let i = 0; i < this._transparentList.length; i++) {
      this._transparentList[i].instantiate(pool, middlewares);
    }

    const retriever = retrieverFactory(
      this.proto.token,
      this._deps,
      this._transparentMap,
    );
    const factory = this.proto.factory ?? this.proto.token.opts?.factory;
    if (!factory) throw InjectionError.notFound(this.proto.token);

    if (!middlewares.length) {
      this._instance = InjectionContext.instantiate(factory, retriever);
    } else {
      const contextFactory = () => InjectionContext.instantiate(factory, retriever);
      this._instance = runMiddlewares(middlewares, {
        token: this.proto.token,
        factory: contextFactory,
        deps: new Set(this._depsTokens),
      });
    }

    this._resolved = true;

    if (pool) pool.set(this.proto.token, this);
  }

  public toString(): string {
    return `TreeNodeSingle<${this.proto.token.toString()}>`;
  }
}

export class TreeNodeTransparent<T = any> {
  private readonly _transparentMap: Map<NodeBase<any>, TreeNodeTransparent> = new Map();
  private readonly _transparentList: TreeNodeTransparent[] = [];
  private readonly _transparentIndex = new Map<NodeBase<any>, number>();

  private readonly _deps: DependencyPool = new Map();
  private readonly _depsList: TreeNode<any>[] = [];
  private readonly _depsIndex = new Map<NodeBase<any>, number>();
  private readonly _depsTokens = new Set<NodeBase<any>>();

  private _instance: T | null = null;
  private _collected = false;
  private _resolved = false;
  public allocations = 0;

  public get instance(): T {
    if (!this._resolved) throw InjectionError.accessFailed();
    return this._instance as T;
  }

  constructor(public readonly proto: ProtoNodeTransparent<T>) {}

  public addDependency(node: TreeNode<any>): void {
    if (node instanceof TreeNodeTransparent) {
      const token = node.proto.parent.token;
      this._transparentMap.set(token, node);
      upsertIndexedDependency(token, node, this._transparentIndex, this._transparentList);

      this._depsTokens.add(token);
    } else {
      const token = node.proto.token;
      this._deps.set(token, node);
      upsertIndexedDependency(token, node, this._depsIndex, this._depsList);

      this._depsTokens.add(token);
    }

    node.allocations++;
  }

  public collectPool(pool: InjectionPool): void {
    if (this._collected) return;

    for (let i = 0; i < this._depsList.length; i++) {
      this._depsList[i].collectPool(pool);
    }

    for (let i = 0; i < this._transparentList.length; i++) {
      this._transparentList[i].collectPool(pool);
    }

    this._collected = true;
  }

  public instantiate(pool?: InjectionPool, middlewares: iMiddleware[] = []): void {
    if (this._resolved) return;

    for (let i = 0; i < this._transparentList.length; i++) {
      this._transparentList[i].instantiate(pool, middlewares);
    }

    for (let i = 0; i < this._depsList.length; i++) {
      this._depsList[i].instantiate(pool, middlewares);
    }

    const retriever = retrieverFactory(
      this.proto.parent.token,
      this._deps,
      this._transparentMap,
    );

    if (!middlewares.length) {
      this._instance = InjectionContext.instantiate(this.proto.factory, retriever);
    } else {
      const refFactory = () => {
        return InjectionContext.instantiate(this.proto.factory, retriever);
      };

      this._instance = runMiddlewares(middlewares, {
        token: this.proto.parent.token,
        factory: refFactory,
        deps: new Set(this._depsTokens),
      });
    }

    this._resolved = true;
  }

  public toString(): string {
    return `TreeNodeTransparent<${this.proto.parent.token.toString()}>`;
  }
}

export class TreeNodeMulti<T = any> {
  private readonly _deps = new Set<TreeNode<any>>();
  private readonly _depsList: TreeNode<any>[] = [];
  public readonly instance: T[] = [];

  private _collected = false;
  private _resolved = false;
  public allocations = 0;

  constructor(public readonly proto: ProtoNodeMulti<T>) {}

  public collectPool(pool: InjectionPool): void {
    if (this._collected) {
      pool.set(this.proto.token, this);
      return;
    }

    for (let i = 0; i < this._depsList.length; i++) {
      this._depsList[i].collectPool(pool);
    }

    this._collected = true;
    pool.set(this.proto.token, this);
  }

  public instantiate(pool?: InjectionPool, middlewares: iMiddleware[] = []): void {
    if (this._resolved) return;

    for (let i = 0; i < this._depsList.length; i++) {
      const dep = this._depsList[i];
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
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!this._deps.has(node)) {
        this._deps.add(node);
        this._depsList.push(node);
      }

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

function retrieverFactory<T>(
  node: NodeBase<T>,
  deps: InjectionPool,
  transparentDeps: Map<NodeBase<any>, TreeNodeTransparent>,
): InjectorFn {
  return (token: NodeBase<T>, optional: boolean | undefined): T | null => {
    const depNode = deps.get(token);
    if (!depNode && !optional) {
      const transparent = transparentDeps.get(token);
      if (transparent) return transparent.instance;
      if (token instanceof MultiNodeToken) return [] as unknown as T;

      throw InjectionError.untracked(token, node);
    }

    return depNode ? depNode.instance : null;
  };
}

function upsertIndexedDependency<TNode>(
  token: NodeBase<any>,
  node: TNode,
  indexMap: Map<NodeBase<any>, number>,
  list: TNode[],
): void {
  const existingIndex = indexMap.get(token);
  if (existingIndex === undefined) {
    indexMap.set(token, list.length);
    list.push(node);
    return;
  }

  list[existingIndex] = node;
}
