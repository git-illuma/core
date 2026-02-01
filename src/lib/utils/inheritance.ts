import { nodeInject } from "../api/injection";
import type { MultiNodeToken, NodeToken } from "../api/token";
import { extractToken } from "../api/token";
import { NodeContainer } from "../container";
import type { Ctor, Provider, Token } from "../provider/types";
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

  /**
   * Overrides to provide to the sub-container
   * These will be provided in addition to the main injection
   * @default []
   */
  overrides?: Provider[];

  /**
   * Allows to use the function with specified injector outside of Injection Context.
   * By default, the injector is obtained from the current injection context.
   * @default undefined
   */
  injector?: iInjector;
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
  fn: MaybeAsyncFactory<Provider[]>,
  opts?: iInjectionOptions,
): () => Promise<iInjector> {
  const { container: parent } = opts?.injector ?? nodeInject(Injector);
  const factory = async () => {
    const providers = await fn();

    const subContainer = new NodeContainer({ parent });

    if (opts?.overrides) subContainer.provide(opts.overrides);
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
  const { container: parent } = opts?.injector ?? nodeInject(Injector);
  const factory = (async () => {
    const token = await fn();
    const tempContainer = new NodeContainer({ parent });

    if (opts?.overrides) tempContainer.provide(opts.overrides);
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

export interface iEntrypointConfig<T extends Token<any>> {
  readonly entrypoint: T;
  readonly providers: Provider[];
}

/**
 * Creates an async function that injects a sub-container with a specific entrypoint.
 * The returned function, when called, will create a new sub-container,
 * provide the given providers, bootstrap it, and return the resolved instance(s) of the entrypoint.
 *
 * @note
 * `injectEntryAsync` should be called within an injection context where the parent container is accessible.
 *
 * @template T - The type of the entrypoint token
 * @param fn - A function that returns an entrypoint configuration or a promise resolving to one
 * @returns A function that returns a promise resolving to the injected instance(s) of the entrypoint
 */
export function injectEntryAsync<T>(
  fn: MaybeAsyncFactory<iEntrypointConfig<NodeToken<T>>>,
  opts?: iInjectionOptions,
): () => Promise<T[]>;
export function injectEntryAsync<T>(
  fn: MaybeAsyncFactory<iEntrypointConfig<Ctor<T>>>,
  opts?: iInjectionOptions,
): () => Promise<T>;
export function injectEntryAsync<T>(
  fn: MaybeAsyncFactory<iEntrypointConfig<MultiNodeToken<T>>>,
  opts?: iInjectionOptions,
): () => Promise<T>;
export function injectEntryAsync<T>(
  fn: MaybeAsyncFactory<iEntrypointConfig<Token<T>>>,
  opts?: iInjectionOptions,
): () => Promise<T | T[]> {
  const { container: parent } = opts?.injector ?? nodeInject(Injector);
  const factory = (async () => {
    const { entrypoint, providers } = await fn();

    const subContainer = new NodeContainer({ parent });

    if (opts?.overrides) subContainer.provide(opts.overrides);
    subContainer.provide(providers);
    subContainer.bootstrap();

    return subContainer.get(extractToken(entrypoint) as any);
  }) as () => Promise<T | T[]>;

  const withCache = opts?.withCache ?? true;
  if (!withCache) return factory;

  let cache: Promise<T | T[]> | null = null;
  return () => {
    cache ??= factory();
    return cache;
  };
}
