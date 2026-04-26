import type { MultiNodeToken, NodeToken } from "../api/token";
import type { TreeNode } from "../provider/tree-node";
import type { Ctor, Provider, Token } from "../provider/types";

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

  /**
   * @internal
   * The parent container for hierarchical dependency resolution.
   */
  parent?: iDIContainer;

  /**
   * Whether to instantiate dependencies immediately.
   * If disabled, providers instantiation will happen when first requested.
   * This helps improve startup performance for large containers.
   * Enabled by default until stable.
   *
   * @default true
   */
  instant?: boolean;
}

/**
 * Interface for dependency injection containers.
 * Defines the core methods that all DI containers must implement.
 */
export interface iDIContainer {
  readonly destroyed: boolean;

  /**
   * Registers a provider in the container.
   * @template T - The type of value being provided
   * @param provider - The provider configuration
   */
  provide<T>(provider: Provider<T>): void;

  /**
   * @internal Finds the tree node associated with the given token.
   * @template T - The type of value being searched
   * @param token - The token or constructor to find
   * @returns The associated tree node, or null if not found
   */
  findNode<T>(token: Token<T>): TreeNode<T> | null;

  /**
   * Retrieves an instance for the given token.
   * @template T - The type of value being retrieved
   * @param token - The token or constructor to retrieve
   * @returns The resolved instance
   */
  get<T>(token: MultiNodeToken<T>): T[];
  get<T>(token: NodeToken<T>): T;
  get<T>(token: Ctor<T>): T;

  /**
   * Instantiates a class outside injection context. Primarily used to create instances via Injector.
   * Class does not get registered in the container and cannot be retrieved via {@link get} or {@link nodeInject}.
   * Must be called after {@link bootstrap}.
   *
   * @template T - The type of the class being instantiated
   * @param fn - Factory function or class constructor to instantiate
   * @returns A new instance of the class with dependencies injected
   * @throws {InjectionError} If called before bootstrap or if the constructor is invalid
   */
  produce<T>(fn: Ctor<T> | (() => T)): T;

  /**
   * Destroys the container and releases any resources it holds.
   * Runs all registered beforeDestroyed hooks bottom-up and clears all providers and instances.
   */
  destroy(): void;
}
