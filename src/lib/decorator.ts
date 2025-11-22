import { NodeToken } from "./token";

/**
 * Symbol used to mark classes as injectable and store their associated token.
 * @internal
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
 *   getUser() { return { id: 1, name: 'John' }; }
 * }
 *
 * container.provide(UserService);
 * container.bootstrap();
 * const service = container.get(UserService);
 * ```
 */
export function NodeInjectable<T>() {
  return (ctor: new (...args: any[]) => T) => {
    const nodeToken = new NodeToken<T>(`_${ctor.name}`, {
      factory: () => new ctor(),
    });

    (ctor as any)[INJECTION_SYMBOL] = nodeToken;
  };
}
