import type { MultiNodeToken, NodeBase, NodeToken } from "./token";

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
  useClass: new (...args: any[]) => NoInfer<T>;
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
  | iNodeAliasProvider<T>;

/**
 * Interface for dependency injection containers.
 * Defines the core methods that all DI containers must implement.
 */
export interface iDIContainer {
  /**
   * Registers a provider in the container.
   * @template T - The type of value being provided
   * @param provider - The provider configuration
   */
  provide<T>(provider: Providable<T>): void;
  /**
   * Includes a provider set into the container.
   * @param group - A provider set created with createProviderSet
   */
  include(group: iNodeProviderSet): void;
}

/**
 * Represents a function that registers multiple providers in a container.
 * Created using {@link createProviderSet}.
 */
export type iNodeProviderSet = (container: iDIContainer) => void;

/**
 * Union type of all values that can be provided to a container.
 * @template T - The type of value being provided
 */
export type Providable<T> = NodeBase<T> | iNodeProvider<T> | Ctor<T>;

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
export type ExtractInjectedType<Node> = Node extends MultiNodeToken<infer T>
  ? T[]
  : Node extends NodeToken<infer T>
    ? T
    : never;
