import { Illuma } from "../../global";
import { now } from "../../utils/clock";
import type { iMiddleware } from "./types";

export const performanceDiagnostics: iMiddleware = (params, next) => {
  if (!params.deps.size) {
    return next(params);
  }

  const start = now();
  const instance = next(params);
  const end = now();
  const duration = end - start;

  Illuma.logger.log(`Instantiated ${params.token.name} in ${duration.toFixed(2)} ms`);
  return instance;
};
