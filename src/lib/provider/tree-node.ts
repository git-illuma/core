import type { NodeBase } from "../api/token";
import { MultiNodeToken } from "../api/token";
import type { iNodeInjectorOptions } from "../api/types";
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
/** @internal */
export class TreeRootNode {
  private readonly _deps: Set<TreeNode<any>> = new Set();
  private readonly _treePool: InjectionPool = new Map();

  constructor(
    public readonly instant = true,
    // A thunk, not a frozen array: a node materialized after bootstrap reads the
    // CURRENT chain, so lazy get() matches produce() for post-bootstrap middleware.
    private readonly _middlewaresProvider: () => iMiddleware[] = () => [],
  ) {}

  /** The owning container's current middleware chain. */
  public get middlewares(): iMiddleware[] {
    return this._middlewaresProvider();
  }

  public get dependencies(): Set<TreeNode<any>> {
    return this._deps;
  }

  public addDependency(node: TreeNode<any>): void {
    this._deps.add(node);
  }

  public registerDependency(node: TreeNode<any>): void {
    const alreadyPooled =
      "token" in node.proto && this._treePool.get(node.proto.token) !== undefined;

    // Materialize BEFORE recording: if the factory throws, the half-built node
    // must not be stranded in this long-lived root's _deps (a retry would add one).
    if (!alreadyPooled) {
      if (this.instant) node.instantiate(this._treePool, this);
      else node.collectPool(this._treePool, this);
    }

    this._deps.add(node);
  }

  public build(): void {
    for (const dep of this._deps) {
      if ("token" in dep.proto) this._treePool.set(dep.proto.token, dep);

      if (this.instant) dep.instantiate(this._treePool, this);
      else dep.collectPool(this._treePool, this);
    }
  }

  public obtain<T>(token: NodeBase<T>): TreeNode<T> | null {
    const node = this._treePool.get(token);
    if (!node) return null;

    if (!this.instant) node.instantiate(this._treePool, this);
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

  public destroy(): void {
    this._deps.clear();
    (this._treePool as Map<NodeBase<any>, TreeNode<any>>).clear();
  }
}

/**
 * @internal
 * Binds a tree node to its OWNING root's pool + middleware chain. A parent
 * bootstraps before any child that consumes its nodes, so the owner touches the
 * node first and the first capture wins. Cross-container consumers then
 * materialize an upstream node through its owner's pool + chain, not their own,
 * so a child's pool/middleware never contaminates a parent-provided instance.
 */
class HomeBinding {
  private _pool: InjectionPool | null = null;
  private _root: TreeRootNode | null = null;
  private _homed = false;

  public capture(pool: InjectionPool | undefined, root: TreeRootNode | undefined): void {
    if (this._homed || !root) return;
    this._homed = true;
    this._pool = pool ?? null;
    this._root = root;
  }

  public poolFor(pool?: InjectionPool): InjectionPool | undefined {
    return this._pool ?? pool;
  }

  public rootFor(root?: TreeRootNode): TreeRootNode | undefined {
    return this._root ?? root;
  }

  public middlewaresFor(root?: TreeRootNode): iMiddleware[] {
    const owner = this._root ?? root;
    return owner ? owner.middlewares : [];
  }
}

/** @internal */
export class TreeNodeSingle<T = any> {
  private readonly _transparentMap: Map<NodeBase<any>, TreeNodeTransparent> = new Map();
  private readonly _transparentList: TreeNodeTransparent[] = [];
  private readonly _transparentIndex = new Map<NodeBase<any>, number>();

  private readonly _deps: DependencyPool = new Map();
  private readonly _depsList: TreeNode<any>[] = [];
  private readonly _depsIndex = new Map<NodeBase<any>, number>();
  private readonly _depsTokens = new Set<NodeBase<any>>();

  // skipSelf injections resolve to a different (upstream) node than a plain/self
  // injection of the same token, so they need their own keyed-by-token storage.
  private readonly _skipSelfDeps: DependencyPool = new Map();
  private readonly _skipSelfList: TreeNode<any>[] = [];
  private readonly _skipSelfIndex = new Map<NodeBase<any>, number>();

  private readonly _home = new HomeBinding();
  private _instance: T | null = null;
  private _collected = false;
  private _resolved = false;
  private _inProgress = false;
  public allocations = 0;

  public get instance(): T {
    if (!this._resolved) {
      throw InjectionError.instanceAccessFailed(this.proto.token);
    }

    return this._instance as T;
  }

  private readonly _retriever = (
    token: NodeBase<any>,
    options?: iNodeInjectorOptions,
  ): any => {
    const optional = options ? options.optional : false;
    const self = options?.self ?? false;
    const skipSelf = options?.skipSelf ?? false;

    const depNode = (skipSelf ? this._skipSelfDeps : this._deps).get(token);
    if (depNode) return readNodeInstance(depNode, self);

    const transparent = this._transparentMap.get(token);
    if (transparent) return transparent.instance;

    // A multi token always resolves to an array, never null (even when optional).
    if (token instanceof MultiNodeToken) return [] as unknown as any;

    if (optional) return null;
    throw InjectionError.untracked(token, this.proto.token);
  };

  constructor(public readonly proto: ProtoNodeSingle<T>) {
    if (proto.token === Injector) {
      // biome-ignore lint/style/noNonNullAssertion: Instantiate Injector immediately
      this._instance = proto.factory!() as unknown as T;
      this._resolved = true;
    }
  }

  public addDependency(node: TreeNode<any>, skipSelf = false): void {
    if (node instanceof TreeNodeTransparent) {
      const token = node.proto.parent.token;
      const existing = this._transparentMap.get(token);
      if (existing === node) return;
      if (existing) existing.allocations--;

      this._transparentMap.set(token, node);
      upsertIndexedDependency(token, node, this._transparentIndex, this._transparentList);

      this._depsTokens.add(token);
    } else {
      const token = node.proto.token;
      const deps = skipSelf ? this._skipSelfDeps : this._deps;
      const index = skipSelf ? this._skipSelfIndex : this._depsIndex;
      const list = skipSelf ? this._skipSelfList : this._depsList;

      const existing = deps.get(token);
      if (existing === node) return;
      if (existing) existing.allocations--;

      deps.set(token, node);
      upsertIndexedDependency(token, node, index, list);

      this._depsTokens.add(token);
    }

    node.allocations++;
  }

  public collectPool(pool: InjectionPool, root?: TreeRootNode): void {
    this._home.capture(pool, root);
    const homePool = this._home.poolFor(pool) ?? pool;
    const homeRoot = this._home.rootFor(root);

    if (this._collected) {
      poolSetOnce(homePool, this.proto.token, this);
      return;
    }

    // Re-entry before completion means a genuine cycle the resolver's
    // build-time check could not see (e.g. mutually-referencing siblings);
    // report it instead of overflowing the stack.
    if (this._inProgress) {
      throw InjectionError.circularDependency(this.proto.token, [this.proto.token]);
    }
    this._inProgress = true;

    // Reset the guard on every exit so a throwing dependency can't fake a later
    // cycle (e.g. a lazy get() retried after the first attempt threw).
    try {
      for (let i = 0; i < this._depsList.length; i++) {
        this._depsList[i].collectPool(homePool, homeRoot);
      }

      for (let i = 0; i < this._skipSelfList.length; i++) {
        this._skipSelfList[i].collectPool(homePool, homeRoot);
      }

      for (let i = 0; i < this._transparentList.length; i++) {
        this._transparentList[i].collectPool(homePool, homeRoot);
      }
    } finally {
      this._inProgress = false;
    }

    this._collected = true;
    poolSetOnce(homePool, this.proto.token, this);
  }

  public instantiate(pool?: InjectionPool, root?: TreeRootNode): void {
    this._home.capture(pool, root);
    const homePool = this._home.poolFor(pool);
    const homeRoot = this._home.rootFor(root);

    if (this._resolved) {
      // Pre-resolved nodes (e.g. Injector) still have to be discoverable
      if (homePool) poolSetOnce(homePool, this.proto.token, this);
      return;
    }

    if (this._inProgress) {
      throw InjectionError.circularDependency(this.proto.token, [this.proto.token]);
    }
    this._inProgress = true;

    // Materialize through this node's OWN middleware chain, never a cross-container
    // consumer's, so a parent-provided instance isn't wrapped in a child's middleware.
    const middlewares = this._home.middlewaresFor(root);

    try {
      for (let i = 0; i < this._depsList.length; i++) {
        this._depsList[i].instantiate(homePool, homeRoot);
      }

      for (let i = 0; i < this._skipSelfList.length; i++) {
        this._skipSelfList[i].instantiate(homePool, homeRoot);
      }

      for (let i = 0; i < this._transparentList.length; i++) {
        this._transparentList[i].instantiate(homePool, homeRoot);
      }

      const factory = this.proto.factory ?? this.proto.token.opts?.factory;
      if (!factory) throw InjectionError.notFound(this.proto.token);

      if (!middlewares.length) {
        this._instance = InjectionContext.instantiate(factory, this._retriever);
      } else {
        const contextFactory = () =>
          InjectionContext.instantiate(factory, this._retriever);
        this._instance = runMiddlewares(middlewares, {
          token: this.proto.token,
          factory: contextFactory,
          deps: new Set(this._depsTokens),
        });
      }
    } finally {
      this._inProgress = false;
    }

    this._resolved = true;

    if (homePool) poolSetOnce(homePool, this.proto.token, this);
  }

  public toString(): string {
    return `TreeNodeSingle<${this.proto.token.toString()}>`;
  }
}

/** @internal */
export class TreeNodeTransparent<T = any> {
  private readonly _transparentMap: Map<NodeBase<any>, TreeNodeTransparent> = new Map();
  private readonly _transparentList: TreeNodeTransparent[] = [];
  private readonly _transparentIndex = new Map<NodeBase<any>, number>();

  private readonly _deps: DependencyPool = new Map();
  private readonly _depsList: TreeNode<any>[] = [];
  private readonly _depsIndex = new Map<NodeBase<any>, number>();
  private readonly _depsTokens = new Set<NodeBase<any>>();

  // skipSelf injections resolve to a different (upstream) node than a plain/self
  // injection of the same token; keep them in their own keyed-by-token storage.
  private readonly _skipSelfDeps: DependencyPool = new Map();
  private readonly _skipSelfList: TreeNode<any>[] = [];
  private readonly _skipSelfIndex = new Map<NodeBase<any>, number>();

  private readonly _home = new HomeBinding();
  private _instance: T | null = null;
  private _collected = false;
  private _resolved = false;
  private _inProgress = false;
  public allocations = 0;

  public get instance(): T {
    if (!this._resolved) throw InjectionError.accessFailed();
    return this._instance as T;
  }

  private readonly _retriever = (
    token: NodeBase<any>,
    options?: iNodeInjectorOptions,
  ): any => {
    const optional = options ? options.optional : false;
    const self = options?.self ?? false;
    const skipSelf = options?.skipSelf ?? false;

    const depNode = (skipSelf ? this._skipSelfDeps : this._deps).get(token);
    if (depNode) return readNodeInstance(depNode, self);

    const transparent = this._transparentMap.get(token);
    if (transparent) return transparent.instance;

    // A multi token always resolves to an array, never null (even when optional).
    if (token instanceof MultiNodeToken) return [] as unknown as any;

    if (optional) return null;
    throw InjectionError.untracked(token, this.proto.parent.token);
  };

  constructor(public readonly proto: ProtoNodeTransparent<T>) {}

  public addDependency(node: TreeNode<any>, skipSelf = false): void {
    if (node instanceof TreeNodeTransparent) {
      const token = node.proto.parent.token;
      const existing = this._transparentMap.get(token);
      if (existing === node) return;
      if (existing) existing.allocations--;

      this._transparentMap.set(token, node);
      upsertIndexedDependency(token, node, this._transparentIndex, this._transparentList);

      this._depsTokens.add(token);
    } else {
      const token = node.proto.token;
      const deps = skipSelf ? this._skipSelfDeps : this._deps;
      const index = skipSelf ? this._skipSelfIndex : this._depsIndex;
      const list = skipSelf ? this._skipSelfList : this._depsList;

      const existing = deps.get(token);
      if (existing === node) return;
      if (existing) existing.allocations--;

      deps.set(token, node);
      upsertIndexedDependency(token, node, index, list);

      this._depsTokens.add(token);
    }

    node.allocations++;
  }

  public collectPool(pool: InjectionPool, root?: TreeRootNode): void {
    this._home.capture(pool, root);
    const homePool = this._home.poolFor(pool) ?? pool;
    const homeRoot = this._home.rootFor(root);

    if (this._collected) return;

    if (this._inProgress) {
      throw InjectionError.circularDependency(this.proto.parent.token, [
        this.proto.parent.token,
      ]);
    }
    this._inProgress = true;

    // Reset the guard on every exit so a throwing dependency can't fake a later cycle.
    try {
      for (let i = 0; i < this._depsList.length; i++) {
        this._depsList[i].collectPool(homePool, homeRoot);
      }

      for (let i = 0; i < this._skipSelfList.length; i++) {
        this._skipSelfList[i].collectPool(homePool, homeRoot);
      }

      for (let i = 0; i < this._transparentList.length; i++) {
        this._transparentList[i].collectPool(homePool, homeRoot);
      }
    } finally {
      this._inProgress = false;
    }

    this._collected = true;
  }

  public instantiate(pool?: InjectionPool, root?: TreeRootNode): void {
    this._home.capture(pool, root);
    const homePool = this._home.poolFor(pool);
    const homeRoot = this._home.rootFor(root);

    if (this._resolved) return;

    if (this._inProgress) {
      throw InjectionError.circularDependency(this.proto.parent.token, [
        this.proto.parent.token,
      ]);
    }
    this._inProgress = true;

    const middlewares = this._home.middlewaresFor(root);

    try {
      for (let i = 0; i < this._transparentList.length; i++) {
        this._transparentList[i].instantiate(homePool, homeRoot);
      }

      for (let i = 0; i < this._depsList.length; i++) {
        this._depsList[i].instantiate(homePool, homeRoot);
      }

      for (let i = 0; i < this._skipSelfList.length; i++) {
        this._skipSelfList[i].instantiate(homePool, homeRoot);
      }

      if (!middlewares.length) {
        this._instance = InjectionContext.instantiate(
          this.proto.factory,
          this._retriever,
        );
      } else {
        const refFactory = () => {
          return InjectionContext.instantiate(this.proto.factory, this._retriever);
        };

        this._instance = runMiddlewares(middlewares, {
          token: this.proto.parent.token,
          factory: refFactory,
          deps: new Set(this._depsTokens),
        });
      }
    } finally {
      this._inProgress = false;
    }

    this._resolved = true;
  }

  public toString(): string {
    return `TreeNodeTransparent<${this.proto.parent.token.toString()}>`;
  }
}

/** @internal */
export class TreeNodeMulti<T = any> {
  private readonly _deps = new Set<TreeNode<any>>();
  private readonly _depsList: TreeNode<any>[] = [];
  private readonly _members: T[] = [];
  // The nearest ancestor's multi node, aggregated as the inherited tail. Kept
  // separate from local members so a `self: true` read can exclude it.
  private _inherited: TreeNodeMulti<T> | null = null;

  private readonly _home = new HomeBinding();
  private _collected = false;
  private _resolved = false;
  private _inProgress = false;
  public allocations = 0;

  constructor(public readonly proto: ProtoNodeMulti<T>) {}

  /**
   * Resolved members: inherited ancestor members then this container's own.
   * Returns a fresh copy each access so a consumer that mutates the result can't
   * corrupt the shared member list seen by others.
   */
  public get instance(): T[] {
    if (this._inherited) return [...this._inherited.instance, ...this._members];
    return [...this._members];
  }

  /**
   * Only this container's own members, excluding anything inherited from an
   * ancestor. Backs `self: true` resolution.
   */
  public get localInstance(): T[] {
    return [...this._members];
  }

  /** @internal Record the nearest ancestor's multi node as the inherited tail. */
  public setInherited(node: TreeNodeMulti<T>): void {
    if (this._inherited === node) return;
    if (this._inherited) this._inherited.allocations--;
    this._inherited = node;
    node.allocations++;
  }

  public collectPool(pool: InjectionPool, root?: TreeRootNode): void {
    this._home.capture(pool, root);
    const homePool = this._home.poolFor(pool) ?? pool;
    const homeRoot = this._home.rootFor(root);

    if (this._collected) {
      poolSetOnce(homePool, this.proto.token, this);
      return;
    }

    if (this._inProgress) {
      throw InjectionError.circularDependency(this.proto.token, [this.proto.token]);
    }
    this._inProgress = true;

    // Reset the guard on every exit so a throwing dependency can't fake a later cycle.
    try {
      for (let i = 0; i < this._depsList.length; i++) {
        this._depsList[i].collectPool(homePool, homeRoot);
      }
      // The inherited node belongs to an ancestor and uses its own captured home.
      this._inherited?.collectPool(homePool, homeRoot);
    } finally {
      this._inProgress = false;
    }

    this._collected = true;
    poolSetOnce(homePool, this.proto.token, this);
  }

  public instantiate(pool?: InjectionPool, root?: TreeRootNode): void {
    this._home.capture(pool, root);
    const homePool = this._home.poolFor(pool);
    const homeRoot = this._home.rootFor(root);

    if (this._resolved) return;

    if (this._inProgress) {
      throw InjectionError.circularDependency(this.proto.token, [this.proto.token]);
    }
    this._inProgress = true;

    // Start each attempt from an empty array: a prior attempt that threw
    // mid-loop would otherwise leave partial members to be duplicated on retry.
    this._members.length = 0;

    try {
      for (let i = 0; i < this._depsList.length; i++) {
        const dep = this._depsList[i];
        dep.instantiate(homePool, homeRoot);

        if (dep instanceof TreeNodeSingle) {
          this._members.push(dep.instance);
        } else if (dep instanceof TreeNodeMulti) {
          this._members.push(...dep.instance);
        } else if (dep instanceof TreeNodeTransparent) {
          this._members.push(dep.instance);
        }
      }
      // Inherited members are read lazily via the `instance` getter, but the
      // ancestor node must still be materialized (through its own home) so
      // its `.instance` is ready.
      this._inherited?.instantiate(homePool, homeRoot);
    } finally {
      this._inProgress = false;
    }

    this._resolved = true;
    if (homePool) poolSetOnce(homePool, this.proto.token, this);
  }

  public addDependency(...nodes: TreeNode[]): void {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (this._deps.has(node)) continue;

      this._deps.add(node);
      this._depsList.push(node);
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

/**
 * @internal
 * Reads a resolved node's instance, honoring `self: true` for multi nodes by
 * returning only their local members (excluding inherited ancestor members).
 * `self` is a no-op for single/transparent nodes.
 */
export function readNodeInstance(node: TreeNode, localOnly: boolean): any {
  if (localOnly && node instanceof TreeNodeMulti) return node.localInstance;
  return node.instance;
}

function poolSetOnce(pool: InjectionPool, token: NodeBase<any>, node: TreeNode): void {
  if (pool.get(token) === node) return;
  if (pool.has(token)) return;
  pool.set(token, node);
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
