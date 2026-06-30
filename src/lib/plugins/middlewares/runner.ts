import { InjectionError } from "../../errors";
import type { iInstantiationParams, iMiddleware } from "./types";

/** @internal */
export function runMiddlewares<T>(
  middlewares: iMiddleware[],
  params: iInstantiationParams<T>,
): T {
  const ms = middlewares as iMiddleware<T>[];
  if (ms.length === 0) return params.factory();

  // Dispatch by index so each middleware's `next` continues from its own
  // position, and reject a double next() explicitly rather than letting it
  // silently skip downstream middlewares.
  const dispatch = (index: number, current: iInstantiationParams<T>): T => {
    if (index >= ms.length) return current.factory();

    let called = false;
    return ms[index](current, (forwarded) => {
      if (called) {
        throw InjectionError.middlewareNextReused();
      }
      called = true;
      return dispatch(index + 1, forwarded);
    });
  };

  return dispatch(0, params);
}
