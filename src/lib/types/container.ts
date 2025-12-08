import type { MultiNodeToken, NodeToken } from "../api";
import type { TreeNode } from "../provider";
import type { Ctor, Providable, Token } from "./providers";
import type { iNodeProviderSet } from "./set";

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

  produce<T>(token: Ctor<T>): T;
}
