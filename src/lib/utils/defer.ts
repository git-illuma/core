import { getInjectableToken, isInjectable } from "../api/decorator";
import { nodeInject } from "../api/injection";
import { SHAPE_SHIFTER } from "../api/proxy";
import type { MultiNodeToken, NodeToken } from "../api/token";
import { isNodeBase } from "../api/token";
import { InjectionError, isNotFoundError } from "../errors";
import type { ExtractInjectedType, iNodeInjectorOptions } from "../types/injection";
import { Injector } from "./injector";

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

  let token: any = provider;

  if (isInjectable(provider)) token = getInjectableToken(provider);
  if (!isNodeBase(token)) throw InjectionError.invalidProvider(String(token));

  let resolved = false;
  let instance: ExtractInjectedType<N> | typeof SHAPE_SHIFTER | null = SHAPE_SHIFTER;

  return () => {
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
