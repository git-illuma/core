import type { NodeBase } from "../api";

/**
 * Represents a constructor function type.
 * @template T - The type that the constructor creates
 */

export type Ctor<T> = new (...args: any[]) => T;
/**
 * Represents a token that can be either a NodeBase token or a constructor.
 * @template T - The type that the token represents
 */

export type Token<T> = NodeBase<T> | Ctor<T>;
/**
 * Options for configuring a NodeToken or MultiNodeToken.
 * @template T - The type of value the token represents
 */

export interface iNodeTokenBaseOptions<T> {
  /**
   * Optional factory function to create instances of this token.
   */
  factory?: () => NoInfer<T>;
}
/**
 * Provider that supplies a static value for a token.
 * @template T - The type of value being provided
 */

export interface iNodeValueProvider<T> {
  /** The token this provider is for */
  provide: Token<T>;
  /** The static value to provide */
  value: NoInfer<T>;
}
/**
 * Provider that uses a factory function to create instances.
 * @template T - The type of value being provided
 */

export interface iNodeFactoryProvider<T> {
  /** The token this provider is for */
  provide: Token<T>;
  /** Factory function to create the value */
  factory: () => NoInfer<T>;
}
/**
 * Provider that uses a class constructor to create instances.
 * @template T - The type of value being provided
 */

export interface iNodeClassProvider<T> {
  /** The token this provider is for */
  provide: Token<T>;
  /** The class to instantiate */
  useClass: new (
    ...args: any[]
  ) => NoInfer<T>;
}
/**
 * Provider that creates an alias to another token.
 * When this token is injected, the aliased token's value is returned instead.
 * @template T - The type of value being provided
 */

export interface iNodeAliasProvider<T> {
  /** The token this provider is for */
  provide: Token<T>;
  /** The token to alias to */
  alias: Token<T>;
}
/**
 * Union type of all possible provider configurations.
 * @template T - The type of value being provided
 */

export type iNodeProvider<T> =
  | iNodeValueProvider<T>
  | iNodeFactoryProvider<T>
  | iNodeClassProvider<T>
  | iNodeAliasProvider<T>; /**
 * Union type of all values that can be provided to a container.
 * @template T - The type of value being provided
 */

export type Providable<T> =
  | NodeBase<T>
  | iNodeProvider<T>
  | Ctor<T>
  | Providable<unknown>[];
