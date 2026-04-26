/**
 * Main entrypoint for `@illuma/core`.
 *
 * Provides the main dependency injection container, API decorators, tokens,
 * context types, error definitions, and core utility functions.
 *
 * @module
 */
export * from "./lib/api";
export * from "./lib/container";
export * from "./lib/context";
export { ERR_CODES as ILLUMA_ERR_CODES, InjectionError } from "./lib/errors";
export * from "./lib/provider/types";
export * from "./lib/utils";
