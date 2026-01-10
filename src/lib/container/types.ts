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
   * @deprecated Will be removed in next major versions.
   *
   * When true, enables diagnostics reporting after bootstrap.
   * @default false
   */
  diagnostics?: boolean;

  /**
   * @internal
   * The parent container for hierarchical dependency resolution.
   */
  parent?: iDIContainer;

  /**
   * @experimental
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

  produce<T>(fn: Ctor<T> | (() => T)): T;
}
