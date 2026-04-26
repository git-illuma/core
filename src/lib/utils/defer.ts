import { nodeInject } from "../api/injection";
import { SHAPE_SHIFTER } from "../api/proxy";
import type { MultiNodeToken, NodeToken } from "../api/token";
import { extractToken } from "../api/token";
import type { ExtractInjectedType, iNodeInjectorOptions } from "../api/types";
import { LifecycleRef } from "../container/lifecycle";
import { InjectionError, isNotFoundError } from "../errors";
import type { Token } from "../provider/types";
import { Injector } from "./injector";

/**
 * Injects a dependency wrapped in a getter function, deferring its resolution
 * until the getter is called.
 * @template N - The token or constructor type
 * @param token - The token or class to inject
 * @param options - Configuration options
 * @returns A getter function returning the injected dependency
 */
export function injectDefer<N>(
  token: N,
  options: iNodeInjectorOptions & { optional: true },
): () => N extends MultiNodeToken<infer V>
  ? V[]
  : N extends NodeToken<infer U>
    ? U | null
    : N extends new (
          ...args: any[]
        ) => infer T
      ? T | null
      : never;
export function injectDefer<N>(
  token: N,
  options?: iNodeInjectorOptions,
): () => N extends MultiNodeToken<infer V>
  ? V[]
  : N extends NodeToken<infer U>
    ? U
    : N extends new (
          ...args: any
        ) => infer T
      ? T
      : never;
export function injectDefer<N extends NodeToken<unknown> | MultiNodeToken<unknown>>(
  token: N,
  options?: iNodeInjectorOptions,
): () => ExtractInjectedType<N>;
export function injectDefer<
  N extends
    | NodeToken<unknown>
    | MultiNodeToken<unknown>
    | (new (
        ...args: any[]
      ) => unknown) = NodeToken<unknown>,
>(provider: N, options?: iNodeInjectorOptions) {
  const injector = nodeInject(Injector);
  const lifecycle = nodeInject(LifecycleRef);

  const token = extractToken(provider as Token<unknown>);

  let resolved = false;
  let instance: ExtractInjectedType<N> | typeof SHAPE_SHIFTER | null = SHAPE_SHIFTER;

  lifecycle.beforeDestroy(() => {
    resolved = false;
    instance = null;
  });

  return () => {
    if (lifecycle.destroyed) throw InjectionError.destroyed();

    if (resolved) return instance;
    if (options?.optional) {
      try {
        instance = injector.get(token as any) as ExtractInjectedType<N>;
        resolved = true;
        return instance;
      } catch (e) {
        if (isNotFoundError(e)) {
          resolved = true;
          instance = null;
          return instance;
        }

        throw e;
      }
    }

    instance = injector.get(token as any) as ExtractInjectedType<N>;
    resolved = true;
    return instance;
  };
}
