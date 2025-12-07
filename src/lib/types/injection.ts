import type { MultiNodeToken, NodeToken } from "../api";

/**
 * Options for the {@link nodeInject} function.
 */

export interface iNodeInjectorOptions {
  /**
   * If true, returns null instead of throwing when the dependency is not found.
   * @default false
   */
  optional?: boolean;
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
