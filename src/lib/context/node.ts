import type { MultiNodeToken, NodeToken } from "../api/token";

/**
 * Represents a single dependency injection point in the dependency graph.
 * Stores information about what token is being injected and whether it's optional.
 *
 * @template T - The type of value being injected
 * @internal
 */
export class InjectionNode<T> {
  constructor(
    public readonly token: NodeToken<T> | MultiNodeToken<T>,
    public readonly optional = false,
  ) {}
}
