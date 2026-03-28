import type { iInstantiationParams, iMiddleware } from "./types";

export function runMiddlewares<T>(
  middlewares: iMiddleware[],
  params: iInstantiationParams<T>,
): T {
  const ms = middlewares as iMiddleware<T>[];
  if (ms.length === 0) return params.factory();

  let i = 0;
  const next = (current: iInstantiationParams<T>): T => {
    if (i >= ms.length) return current.factory();
    return ms[i++](current, next);
  };

  return next(params);
}
