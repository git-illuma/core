import type { NodeBase } from "../api/token";
import { extractToken } from "../api/token-utils";
import { InjectionError } from "../errors";
import type { iNodeProvider } from "./types";

/** @internal */
export function extractProvider<T>(provider: iNodeProvider<T>): NodeBase<T> | (() => T) {
  if ("value" in provider) return () => provider.value;
  if ("factory" in provider) return provider.factory;
  if ("useClass" in provider) return () => new provider.useClass();
  if ("alias" in provider) return extractToken(provider.alias, true);

  throw InjectionError.invalidProvider(JSON.stringify(provider));
}
