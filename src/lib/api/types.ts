import type { MultiNodeToken, NodeBase, NodeToken } from "./token";

/**
 * Options for the {@link nodeInject} function.
 */
export interface iNodeInjectorOptions {
  /**
   * If true, returns null instead of throwing when the dependency is not found.
   * @default false
   */
  optional?: boolean;

  /**
   * If true, only checks the current injector for the dependency.
   * It prevents falling back to the parent container when dealing with hierarchical injection.
   * Mutually exclusive with `skipSelf`.
   * @default false
   */
  self?: boolean;

  /**
   * If true, skips the current injector and checks parent injectors for the dependency.
   * Mutually exclusive with `self`. When both are true, it throws a ConflictingStrategies error.
   * @default false
   */
  skipSelf?: boolean;
}

/**
 * Utility type that extracts the injected type from a token.
 * For MultiNodeToken, returns an array. For NodeToken, returns a single value.
 * @template Node - The token type to extract from
 */
export type ExtractInjectedType<Node> =
  Node extends MultiNodeToken<infer T>
    ? T[]
    : Node extends NodeToken<infer T>
      ? T
      : never;

/** @internal */
export type InjectorFn = (token: NodeBase<any>, options?: iNodeInjectorOptions) => any;
