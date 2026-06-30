import { nodeInject } from "../api/injection";
import { SHAPE_SHIFTER } from "../api/proxy";
import type { MultiNodeToken, NodeToken } from "../api/token";
import { extractToken } from "../api/token-utils";
import type { ExtractInjectedType, iNodeInjectorOptions } from "../api/types";
import { LifecycleRef } from "../container/lifecycle";
import { InjectionError } from "../errors";
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

  // No beforeDestroy hook resets this state: the getter already refuses to
  // resolve once the container is destroyed, and a per-call hook on the shared
  // lifecycle would leak one callback per produce()d instance.
  let resolved = false;
  let instance: ExtractInjectedType<N> | typeof SHAPE_SHIFTER | null = SHAPE_SHIFTER;

  return () => {
    if (lifecycle.destroyed) throw InjectionError.destroyed();
    if (resolved) return instance;

    // Forward every modifier: get() honors them natively, so deferred resolution
    // resolves from the same scope an eager nodeInject(token, options) would.
    instance = injector.get(token as any, options) as ExtractInjectedType<N>;
    resolved = true;
    return instance;
  };
}
