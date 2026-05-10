import { InjectionError } from "../errors";
import type { Token } from "../provider";
import { getInjectableToken, isInjectable } from "./decorator";
import { MultiNodeToken, NodeToken } from "./token";

/**
 * Type guard to check if a value is a valid dependency injection token.
 *
 * @template T - The type of value the token represents
 * @param obj - The value to check
 * @returns True if the object is a NodeToken or MultiNodeToken, false otherwise
 * @internal
 */

export function isNodeBase<T>(obj: unknown): obj is NodeToken<T> | MultiNodeToken<T> {
  return obj instanceof NodeToken || obj instanceof MultiNodeToken;
}
/**
 * Extracts a valid NodeBase token from a given provider.
 * If the provider is a class constructor decorated with @NodeInjectable, it retrieves the associated token.
 * If the provider is already a NodeBase token, it returns it directly.
 * Throws an InjectionError if the provider is invalid.
 *
 * @template T - The type of value the token represents
 * @param provider - The provider to extract the token from
 * @param isAlias - Whether the provider is being used as an alias
 * @returns The extracted NodeBase token
 * @throws {InjectionError} If the provider is invalid
 * @internal
 */

export function extractToken<T>(
  provider: Token<T>,
  isAlias = false,
): NodeToken<T> | MultiNodeToken<T> {
  if (isNodeBase<T>(provider)) return provider;

  if (typeof provider === "function") {
    if (!isInjectable<T>(provider)) throw InjectionError.invalidCtor(provider);
    return getInjectableToken<T>(provider);
  }

  if (isAlias) throw InjectionError.invalidAlias(provider);
  throw InjectionError.invalidProvider(String(provider));
}
