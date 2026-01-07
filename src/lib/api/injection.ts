import { InjectionContext } from "../context";
import { InjectionError } from "../errors";
import type { ExtractInjectedType, iNodeInjectorOptions } from "../types";
import { getInjectableToken, isInjectable } from "./decorator";
import { SHAPE_SHIFTER } from "./proxy";
import type { MultiNodeToken, NodeToken } from "./token";
import { isNodeBase } from "./token";

/**
 * Injects a dependency within a factory function or constructor.
 * This function must be called within an injection context (during provider instantiation).
 *
 * @template N - The token or constructor type
 * @param token - The token or class to inject
 * @param options - Optional configuration for the injection
 * @returns The injected instance(s). For MultiNodeToken returns an array, for NodeToken returns a single instance.
 *          When optional is true, may return null if the dependency is not found, type-safely.
 * @throws {InjectionError} If called outside an injection context or if a required dependency is not found
 *
 * @example
 * ```typescript
 * const LoggerToken = new NodeToken<Logger>('Logger');
 * const ConfigToken = new NodeToken<Config>('Config');
 *
 * container.provide({
 *   provide: UserServiceToken,
 *   factory: () => {
 *     const logger = nodeInject(LoggerToken);
 *     const config = nodeInject(ConfigToken, { optional: true });
 *     return new UserService(logger, config);
 *   }
 * });
 * ```
 */
export function nodeInject<N>(
  token: N,
  options: iNodeInjectorOptions & { optional: true },
): N extends MultiNodeToken<infer V>
  ? V[]
  : N extends NodeToken<infer U>
    ? U | null
    : N extends new (
          ...args: any[]
        ) => infer T
      ? T | null
      : never;
export function nodeInject<N>(
  token: N,
  options?: iNodeInjectorOptions,
): N extends MultiNodeToken<infer V>
  ? V[]
  : N extends NodeToken<infer U>
    ? U
    : N extends new (
          ...args: any
        ) => infer T
      ? T
      : never;
export function nodeInject<N extends NodeToken<unknown> | MultiNodeToken<unknown>>(
  token: N,
  options?: iNodeInjectorOptions,
): ExtractInjectedType<N>;
export function nodeInject<
  N extends
    | NodeToken<unknown>
    | MultiNodeToken<unknown>
    | (new (
        ...args: any[]
      ) => unknown) = NodeToken<unknown>,
>(provider: N, options?: iNodeInjectorOptions) {
  let token: any = provider;
  if (isInjectable(provider)) token = getInjectableToken(provider);

  if (!InjectionContext.contextOpen) {
    throw InjectionError.outsideContext(token);
  }

  if (!isNodeBase(token)) throw InjectionError.invalidProvider(String(token));

  const injection = { token, optional: options?.optional ?? false };
  InjectionContext.addDep(injection);

  if (InjectionContext.injector) {
    return InjectionContext.injector(token, options?.optional);
  }

  return SHAPE_SHIFTER;
}

/**
 * Type of the {@link nodeInject} function.
 * @internal
 */
export type NodeInjectFn = typeof nodeInject;
