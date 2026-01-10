import type { iMiddleware } from "./types";

export const performanceDiagnostics: iMiddleware = (params, next) => {
  if (!params.deps.size) {
    return next(params);
  }

  const start = performance.now();
  const instance = next(params);
  const end = performance.now();
  const duration = end - start;

  console.log(`Instantiated ${params.token.name} in ${duration.toFixed(2)} ms`);
  return instance;
};
