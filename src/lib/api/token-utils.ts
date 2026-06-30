import { InjectionError } from "../errors";
import type { Token } from "../provider";
import { getInjectableToken, isInjectable } from "./decorator";
import { MultiNodeToken, NodeToken } from "./token";

/**
 * Type guard to check if a value is a valid dependency injection token
 * (a `NodeToken` or `MultiNodeToken`). Useful when authoring plugins or
 * scanners that need to discriminate tokens from constructors or other values.
 *
 * Exposed via `@illuma/core/plugins`.
 *
 * @template T - The type of value the token represents
 * @param obj - The value to check
 * @returns True if the object is a NodeToken or MultiNodeToken, false otherwise
 */

export function isNodeBase<T>(obj: unknown): obj is NodeToken<T> | MultiNodeToken<T> {
  return obj instanceof NodeToken || obj instanceof MultiNodeToken;
}
/**
 * Extracts a `NodeBase` token from a value that may be either a token itself
 * or a constructor decorated with `@NodeInjectable`. Useful when authoring
 * plugins that accept the same `Token<T>` shape Illuma itself does.
 *
 * Exposed via `@illuma/core/plugins`.
 *
 * @template T - The type of value the token represents
 * @param provider - The provider to extract the token from
 * @param isAlias - Whether the provider is being used as an alias
 * @returns The extracted NodeBase token
 * @throws {InjectionError} If the provider is invalid
 */

export function extractToken<T>(
  provider: Token<T>,
  isAlias = false,
): NodeToken<T> | MultiNodeToken<T> {
  if (isNodeBase<T>(provider)) return provider;

  if (typeof provider === "function") {
    if (!isInjectable<T>(provider)) {
      if (isAlias) throw InjectionError.invalidAlias(provider);
      throw InjectionError.invalidCtor(provider);
    }

    return getInjectableToken<T>(provider);
  }

  if (isAlias) throw InjectionError.invalidAlias(provider);
  throw InjectionError.invalidProvider(String(provider));
}
