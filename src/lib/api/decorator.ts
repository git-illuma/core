import { InjectionError } from "../errors";
import { Illuma } from "../global/global";
import type { Ctor } from "../provider/types";
import { NodeToken } from "./token";

/** Options for marking a class as injectable. */
export interface iNodeInjectableOptions {
  /**
   * Marks injectable as root-scoped singleton in hierarchical containers.
   * This injectable will be provided automatically without calling `provide`.
   */
  readonly singleton?: boolean;
}

/**
 * Decorator that marks a class as injectable in the dependency injection system.
 * Automatically creates and associates a NodeToken with the class.
 *
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
export function NodeInjectable(opts?: iNodeInjectableOptions): ClassDecorator {
  return (ctor: any) => {
    const nodeToken = new NodeToken<unknown>(`_${ctor.name}`, {
      factory: () => new ctor(),
      singleton: opts?.singleton,
    });

    registerClassAsInjectable(ctor, nodeToken);
    return ctor;
  };
}

/**
 * Alternative function to mark a class as injectable in the dependency injection system for environments
 * that do not support decorators.
 *
 * @template T - The type of the class being registered
 * @param ctor - The class constructor to mark as injectable
 * @param opts - Optional injectable behavior configuration
 * @returns The same constructor, now registered as injectable
 *
 * @example
 * ```typescript
 * import { makeInjectable } from '@illuma/core';
import { Illuma } from '../plugins/core/plugin-container';
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
export function makeInjectable<T>(ctor: Ctor<T>, opts?: iNodeInjectableOptions): Ctor<T> {
  const nodeToken = new NodeToken<T>(`_${ctor.name}`, {
    factory: () => new ctor(),
    singleton: opts?.singleton,
  });

  registerClassAsInjectable(ctor, nodeToken);
  return ctor;
}

/**
 * Decorator that marks a class as a root-scoped singleton service.
 *
 * Equivalent to `@NodeInjectable({ singleton: true })`. The class is shared
 * across the entire container tree, including all descendants, unless a child
 * explicitly overrides it via `.provide()`.
 *
 * @returns A class decorator function
 *
 * @example
 * ```typescript
 * @Service()
 * class UserService {
 *   public getUser() {
 *     return { id: 1, name: 'John' };
 *   }
 * }
 * ```
 */
export function Service(): ClassDecorator {
  return NodeInjectable({ singleton: true });
}

/**
 * Alternative to {@link Service} for environments that do not support decorators.
 * Marks a class as a root-scoped singleton service.
 *
 * @template T - The type of the class being registered
 * @param ctor - The class constructor to mark as a singleton service
 * @returns The same constructor, now registered as an injectable singleton
 *
 * @example
 * ```typescript
 * import { makeService } from '@illuma/core';
 *
 * class _UserService {
 *   public getUser() { return { id: 1, name: 'John Doe' }; }
 * }
 *
 * export type UserService = _UserService;
 * export const UserService = makeService(_UserService);
 * ```
 */
export function makeService<T>(ctor: Ctor<T>): Ctor<T> {
  return makeInjectable(ctor, { singleton: true });
}

/**
 * Decorator that marks a class as a node-scoped injectable.
 *
 * Equivalent to `@NodeInjectable()`. The class is resolved within the container
 * (or sub-container) that provides it, and is not shared globally across the
 * container tree.
 *
 * @returns A class decorator function
 *
 * @example
 * ```typescript
 * @Scoped()
 * class RequestContext {
 *   public readonly id = crypto.randomUUID();
 * }
 * ```
 */
export function Scoped(): ClassDecorator {
  return NodeInjectable();
}

/**
 * Alternative to {@link Scoped} for environments that do not support decorators.
 * Marks a class as a node-scoped injectable.
 *
 * @template T - The type of the class being registered
 * @param ctor - The class constructor to mark as node-scoped injectable
 * @returns The same constructor, now registered as an injectable
 *
 * @example
 * ```typescript
 * import { makeScoped } from '@illuma/core';
 *
 * class _RequestContext {
 *   public readonly id = crypto.randomUUID();
 * }
 *
 * export type RequestContext = _RequestContext;
 * export const RequestContext = makeScoped(_RequestContext);
 * ```
 */
export function makeScoped<T>(ctor: Ctor<T>): Ctor<T> {
  return makeInjectable(ctor);
}

/**
 * Registers a class as injectable with a specific token.
 * Use this function to manually associate a class with a token.
 *
 * Normally, the {@link NodeInjectable} decorator and {@link makeInjectable}
 * helper are used to mark classes as injectable, but if developing a plugin
 * that requires manual registration, this function can be used.
 *
 * @param ctor - The class constructor to register
 * @param token - The token to associate with the class
 */
export function registerClassAsInjectable<T>(ctor: Ctor<T>, token: NodeToken<T>): void {
  Illuma._classRegistry.set(ctor, token);
}

/** @internal */
export function isInjectable<T>(ctor: unknown): ctor is Ctor<T> {
  return isConstructor(ctor) && Illuma._classRegistry.has(ctor);
}

/** @internal */
export function getInjectableToken<T>(ctor: Ctor<T>): NodeToken<T> {
  // biome-ignore lint/style/noNonNullAssertion: We explicitly check for existence above
  if (Illuma._classRegistry.has(ctor)) return Illuma._classRegistry.get(ctor)!;
  throw InjectionError.invalidCtor(ctor);
}

/** @internal */
export function isConstructor(fn: unknown): fn is Ctor<any> {
  return typeof fn === "function" && fn.prototype && fn.prototype.constructor === fn;
}
