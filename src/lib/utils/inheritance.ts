import type { MultiNodeToken, NodeToken } from "../api";
import { extractToken, nodeInject } from "../api";
import { NodeContainer } from "../container";
import type { Ctor, iNodeProviderSet, Providable, Token } from "../types";
import type { iInjector } from "./injector";
import { Injector } from "./injector";

type MaybeAsyncFactory<T> = () => T | Promise<T>;
interface iInjectionOptions {
  /**
   * Whether to cache the result of the injection function
   * Prevents multiple invocations from creating multiple sub-containers or injections
   * @default true
   */
  withCache?: boolean;
}

/**
 * @deprecated Use array of providers with {@link injectGroupAsync} instead.
 *
 * Creates an async function that injects a sub-container with the given dependencies.
 * The returned function, when called, will create a new sub-container,
 * include the provided dependencies, bootstrap it, and return its injector.
 *
 * @note
 * `injectChildrenAsync` should be called within an injection context where the parent container is accessible.
 *
 * @param fn - A function that returns a provider set or a promise resolving to one
 * @returns A function that returns a promise resolving to the injector of the sub-container
 */
export function injectChildrenAsync(
  fn: MaybeAsyncFactory<iNodeProviderSet>,
  opts?: iInjectionOptions,
): () => Promise<iInjector> {
  const { container: parent } = nodeInject(Injector);
  const factory = async () => {
    const providerSet = await fn();

    const subContainer = new NodeContainer({ parent });
    subContainer.include(providerSet);
    subContainer.bootstrap();

    return subContainer.get(Injector);
  };

  const withCache = opts?.withCache ?? true;
  if (!withCache) return factory;

  let cache: Promise<iInjector> | null = null;
  return () => {
    cache ??= factory();
    return cache;
  };
}

/**
 * Creates an async function that injects a group of dependencies as a sub-container.
 * The returned function, when called, will create a new sub-container, provide the given dependencies,
 * bootstrap it, and return its injector.
 *
 * @note
 * `injectGroupAsync` should be called within an injection context where the parent container is accessible.
 *
 * @param fn - A function that returns an array of providers or a promise resolving to one
 * @returns A function that returns a promise resolving to the injector of the sub-container
 */
export function injectGroupAsync(
  fn: MaybeAsyncFactory<Providable<unknown>[]>,
  opts?: iInjectionOptions,
): () => Promise<iInjector> {
  const { container: parent } = nodeInject(Injector);
  const factory = async () => {
    const providers = await fn();

    const subContainer = new NodeContainer({ parent });
    subContainer.provide(providers);
    subContainer.bootstrap();

    return subContainer.get(Injector);
  };

  const withCache = opts?.withCache ?? true;
  if (!withCache) return factory;

  let cache: Promise<iInjector> | null = null;
  return () => {
    cache ??= factory();
    return cache;
  };
}

/**
 * Creates an async function that injects a dependency for the given token or constructor.
 * The returned function, when called, will create a new sub-container,
 * provide the token or constructor, bootstrap it, and return the resolved instance(s).
 *
 * @note
 * `injectAsync` should be called within an injection context where the parent container is accessible.
 *
 * @template T - The type of value being injected
 * @param fn - A function that returns a token, constructor, or a promise resolving to one
 * @returns A function that returns a promise resolving to the injected instance(s)
 */
export function injectAsync<T>(
  fn: MaybeAsyncFactory<MultiNodeToken<T>>,
  opts?: iInjectionOptions,
): () => Promise<T[]>;
export function injectAsync<T>(
  fn: MaybeAsyncFactory<NodeToken<T>>,
  opts?: iInjectionOptions,
): () => Promise<T>;
export function injectAsync<T>(
  fn: MaybeAsyncFactory<Ctor<T>>,
  opts?: iInjectionOptions,
): () => Promise<T>;
export function injectAsync<T>(
  fn: MaybeAsyncFactory<Token<T>>,
  opts?: iInjectionOptions,
): () => Promise<T | T[]> {
  const { container: parent } = nodeInject(Injector);
  const factory = (async () => {
    const token = await fn();
    const tempContainer = new NodeContainer({ parent });
    tempContainer.provide(token);
    tempContainer.bootstrap();

    return tempContainer.get(extractToken(token) as any);
  }) as () => Promise<T | T[]>;

  const withCache = opts?.withCache ?? true;
  if (!withCache) return factory;

  let cache: Promise<T | T[]> | null = null;
  return () => {
    cache ??= factory();
    return cache;
  };
}
