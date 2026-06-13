import type { NodeBase } from "../api/token";
import { MultiNodeToken, NodeToken } from "../api/token";
import { InjectionContext } from "../context/context";
import type { iInjectionNode } from "../context/types";
import { InjectionError } from "../errors";

/** @internal */
export class ProtoNodeSingle<T = any> {
  // Metadata
  public readonly injections: Set<iInjectionNode<unknown>> = new Set();

  // Instantiation
  public factory: (() => T) | null = null;

  constructor(
    public readonly token: NodeToken<T>,
    factory?: () => T,
  ) {
    if (factory) {
      this.factory = factory;
      InjectionContext.scanInto(factory, this.injections);
    } else if (typeof token.opts?.factory === "function") {
      // Track the deps of the token's own factory so the resolver wires them,
      // without claiming a factory: hasFactory() stays false so an explicit
      // provider may still override this bare declaration.
      InjectionContext.scanInto(token.opts.factory, this.injections);
    }
  }

  public hasFactory(): boolean {
    return typeof this.factory === "function";
  }

  public setFactory(factory: () => T): void {
    if (this.factory) throw InjectionError.duplicateFactory(this.token);
    this.factory = factory;

    // Replace any deps scanned from token.opts.factory so the explicit
    // factory's injections fully supersede them.
    this.injections.clear();
    InjectionContext.scanInto(factory, this.injections);
  }

  public toString(): string {
    return `ProtoNodeSingle<${this.token.toString()}>`;
  }
}

/** @internal */
export class ProtoNodeTransparent<T = any> {
  public readonly factory: () => T;
  public readonly injections: Set<iInjectionNode<unknown>> = new Set();

  constructor(
    public readonly parent: ProtoNodeSingle<T> | ProtoNodeMulti<T>,
    factory: () => T,
  ) {
    this.factory = factory;
    InjectionContext.scanInto(factory, this.injections);
  }

  public toString(): string {
    return `ProtoNodeTransparent<${this.factory.name || "anonymous"}>`;
  }
}

/** @internal */
export class ProtoNodeMulti<T = any> {
  public readonly singleNodes: Set<NodeToken<T>> = new Set();
  public readonly multiNodes: Set<MultiNodeToken<T>> = new Set();
  public readonly transparentNodes: Set<ProtoNodeTransparent<T>> = new Set();

  constructor(public readonly token: MultiNodeToken<T>) {}

  public hasProviders(): boolean {
    return (
      this.singleNodes.size > 0 ||
      this.multiNodes.size > 0 ||
      this.transparentNodes.size > 0
    );
  }

  public addProvider(retriever: NodeBase<T> | (() => T)): void {
    if (retriever instanceof NodeToken) {
      this.singleNodes.add(retriever);
    } else if (retriever instanceof MultiNodeToken) {
      this.multiNodes.add(retriever);
    } else if (typeof retriever === "function") {
      const transparentProto = new ProtoNodeTransparent<T>(this, retriever);
      this.transparentNodes.add(transparentProto);
    }
  }

  public toString(): string {
    return `ProtoNodeMulti<${this.token.toString()}>`;
  }
}

export type ProtoNode<T = any> =
  | ProtoNodeSingle<T>
  | ProtoNodeMulti<T>
  | ProtoNodeTransparent<T>;

/** @internal */
export function isNotTransparentProto(
  proto: ProtoNode,
): proto is ProtoNodeSingle | ProtoNodeMulti {
  return !(proto instanceof ProtoNodeTransparent);
}
