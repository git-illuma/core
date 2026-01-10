import { InjectionError } from "../errors";
import type { Ctor } from "../provider/types";
import { NodeToken } from "./token";

/**
 * Registry to store associated tokens for injectable classes.
 * Uses WeakMap to ensure metadata doesn't prevent garbage collection of classes.
 */
const tokenRegistry = new WeakMap<object, NodeToken<any>>();

/**
 * Symbol used to mark classes as injectable and store their associated token.
 * @internal
 * @deprecated Use internal registry instead. Will be removed in next major versions.
 */
export const INJECTION_SYMBOL = Symbol("Injectable");

/**
 * Decorator that marks a class as injectable in the dependency injection system.
 * Automatically creates and associates a NodeToken with the class.
 *
 * @template T - The type of the class being decorated
 * @returns A class decorator function
 *
 * @example
 * ```typescript
 * @NodeInjectable()
 * class UserService {
 *   public getUser() {
 *     return { id: 1, name: 'John' };
 *   }
 * }
 *
 * container.provide(UserService);
 * container.bootstrap();
 * const service = container.get(UserService);
 * ```
 */
export function NodeInjectable<T>() {
  return (ctor: Ctor<T>): Ctor<T> => {
    const nodeToken = new NodeToken<T>(`_${ctor.name}`, {
      factory: () => new ctor(),
    });

    registerClassAsInjectable(ctor, nodeToken);
    return ctor;
  };
}

/**
 * Alternative function to mark a class as injectable in the dependency injection system for environments
 * that do not support decorators.
 * @param ctor
 * @returns
 *
 * @example
 * ```typescript
 * import { makeInjectable } from '@illuma/core';
import { InjectionError } from '../errors';
 *
 * class _UserService {
 *   public getUser() {
 *     return { id: 1, name: "John Doe" };
 *    }
 * }
 *
 * export type UserService = _UserService;
 * export const UserService = makeInjectable(_UserService);
 * ```
 */
export function makeInjectable<T>(ctor: Ctor<T>): Ctor<T> {
  const nodeToken = new NodeToken<T>(`_${ctor.name}`, {
    factory: () => new ctor(),
  });

  registerClassAsInjectable(ctor, nodeToken);
  return ctor;
}

/** @internal */
export function isInjectable<T>(ctor: unknown): ctor is Ctor<T> {
  return (
    typeof ctor === "function" &&
    isConstructor(ctor) &&
    (tokenRegistry.has(ctor) || INJECTION_SYMBOL in ctor)
  );
}

/** @internal */
export function getInjectableToken<T>(ctor: Ctor<T>): NodeToken<T> {
  // biome-ignore lint/style/noNonNullAssertion: We explicitly check for existence above
  if (tokenRegistry.has(ctor)) return tokenRegistry.get(ctor)!;

  // Deprecated path for backward compatibility
  if (INJECTION_SYMBOL in ctor) {
    return (ctor as any)[INJECTION_SYMBOL] as NodeToken<T>;
  }

  throw InjectionError.invalidCtor(ctor);
}

export function isConstructor(fn: unknown): fn is Ctor<any> {
  return typeof fn === "function" && fn.prototype && fn.prototype.constructor === fn;
}

/**
 * Registers a class as injectable with a specific token.
 * Use this function to manually associate a class with a token.
 *
 * Normally, the {@link NodeInjectable} and {@link makeInjectable} decorator is used to mark classes as injectable,
 * but if developing a plugin that requires manual registration, this function can be used.
 *
 * @param ctor - The class constructor to register
 * @param token - The token to associate with the class
 */
export function registerClassAsInjectable<T>(ctor: Ctor<T>, token: NodeToken<T>): void {
  tokenRegistry.set(ctor, token);
}
