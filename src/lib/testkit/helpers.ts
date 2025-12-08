import type { NodeInjectFn } from "../api";
import { NodeContainer } from "../container";
import { InjectionError } from "../errors";
import type { iNodeInjectorOptions, iNodeProviderSet, Providable, Token } from "../types";

/**
 * Spectator object returned by test factory functions.
 * Provides access to the tested instance and dependency injection capabilities.
 * @template T - The type of the instance being tested
 */
export interface iSpectator<T> {
  readonly instance: T;
  readonly nodeInject: NodeInjectFn;
}

/**
 * Extension interface for test factory functions.
 * Reserved for future factory features and capabilities.
 * @template T - The type of the instance being tested
 */
// biome-ignore lint/suspicious/noEmptyInterface: Place for new factory features
export interface iTestFactory {}

/**
 * Test factory function type that creates spectator instances.
 * Combines a factory function with test factory capabilities.
 * @template T - The type of the instance being tested
 */
export type TestFactoryFn<T> = (() => iSpectator<T>) & iTestFactory;

/**
 * Configuration for creating a test factory.
 * @template T - The type of the instance being tested
 */
export interface iTestFactoryConfig<T> {
  readonly target: Token<T>;
  /** @deprecated */
  readonly providers?: iNodeProviderSet;
  readonly provide?: Providable<unknown>[];
}

/**
 * Creates a test factory function for testing dependency injection.
 * The factory sets up a container with the specified target and providers,
 * bootstraps it, and returns a spectator with the instance and injection capabilities.
 * @template T - The type of the instance being tested
 * @param cfg - Configuration object specifying the target token and optional providers
 * @returns A test factory function that creates spectator instances
 */
export function createTestFactory<T>(cfg: iTestFactoryConfig<T>): TestFactoryFn<T> {
  const factorySelf: TestFactoryFn<T> = () => {
    const container = new NodeContainer();

    if (cfg.providers) container.include(cfg.providers);
    if (cfg.provide) container.provide(cfg.provide);
    container.provide(cfg.target);

    container.bootstrap();

    const instance = container.get<T>(cfg.target as any);
    const nodeInject = <T>(token: Token<T>, opts?: iNodeInjectorOptions) => {
      try {
        return container.get(token as any);
      } catch (e) {
        if (e instanceof InjectionError && e.code === 400 && opts?.optional) {
          return null as any;
        }

        throw e;
      }
    };

    return {
      instance,
      nodeInject,
    } as iSpectator<T>;
  };

  return factorySelf;
}
