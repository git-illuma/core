import type { MultiNodeToken } from "../api/token";
import { NodeToken } from "../api/token";
import type { iNodeInjectorOptions } from "../api/types";
import type { iDIContainer } from "../container/types";
import { InjectionError } from "../errors";
import type { Ctor, Token } from "../provider/types";

const INJECTOR_TOKEN_KEY = Symbol.for("@illuma/core/InjectorToken");

type iInjectorGlobalThis = typeof globalThis & {
  [INJECTOR_TOKEN_KEY]?: NodeToken<iInjector>;
};

const injectorGlobal = globalThis as iInjectorGlobalThis;

/** @internal */
export interface iInjector {
  /** The DI container associated with this injector */
  readonly container: iDIContainer;

  /** Indicates whether the injector or its associated container has been destroyed */
  readonly destroyed: boolean;

  /**
   * Retrieves an instance for the given token.
   * @template T - The type of value being retrieved
   * @param token - The token or constructor to retrieve
   * @param options - Optional configuration for injection modifiers
   * @returns The resolved instance
   */
  get<T>(token: MultiNodeToken<T>, options?: iNodeInjectorOptions): T[];
  get<T>(
    token: NodeToken<T>,
    options: iNodeInjectorOptions & { optional: true },
  ): T | null;
  get<T>(token: NodeToken<T>, options?: iNodeInjectorOptions): T;
  get<T>(token: Ctor<T>, options: iNodeInjectorOptions & { optional: true }): T | null;
  get<T>(token: Ctor<T>, options?: iNodeInjectorOptions): T;

  /**
   * Instantiates a class with injections in runtime using current context.
   * Useful when creating an object that requires injections in runtime.
   * Class does not get registered in the container and cannot be retrieved via {@link get} or {@link nodeInject}.
   *
   * @template T - The type of the class being instantiated
   * @param fn - Factory function or class constructor to instantiate
   * @returns A new instance of the class with dependencies injected
   * @throws {InjectionError} If called before bootstrap or if the constructor is invalid
   * Must be called after {@link bootstrap}.
   */
  produce<T>(fn: Ctor<T> | (() => T)): T;

  /**
   * Creates a new child DI container that inherits from the current injector's container.
   * The child container can be used to provide additional providers that are only available within the child context.
   * @returns A new child DI container
   * @throws {InjectionError} If called before bootstrap or if the injector has been destroyed
   */
  spawnChild(): iDIContainer;

  /**
   * Destroys the injector's associated container and releases any resources it holds.
   * After calling this method, the injector and the container should not be used to retrieve instances or produce new ones.
   */
  destroy(): void;
}

/**
 * Injector implementation that allows retrieving instances from the parent DI container.
 */
export class InjectorImpl implements iInjector {
  constructor(public readonly container: iDIContainer) {}

  public get destroyed(): boolean {
    return this.container.destroyed;
  }

  public get<T>(token: MultiNodeToken<T>, options?: iNodeInjectorOptions): T[];
  public get<T>(
    token: NodeToken<T>,
    options: iNodeInjectorOptions & { optional: true },
  ): T | null;
  public get<T>(token: NodeToken<T>, options?: iNodeInjectorOptions): T;
  public get<T>(
    token: Ctor<T>,
    options: iNodeInjectorOptions & { optional: true },
  ): T | null;
  public get<T>(token: Ctor<T>, options?: iNodeInjectorOptions): T;
  public get<T>(token: Token<T>, options?: iNodeInjectorOptions): T | T[] | null {
    if (this.container.destroyed) throw InjectionError.destroyed();
    return this.container.get<T>(token as any, options);
  }

  public produce<T>(fn: Ctor<T> | (() => T)): T {
    if (this.container.destroyed) throw InjectionError.destroyed();
    return this.container.produce<T>(fn);
  }

  public spawnChild(): iDIContainer {
    if (this.container.destroyed) throw InjectionError.destroyed();
    return this.container.child();
  }

  public destroy(): void {
    if (this.container.destroyed) throw InjectionError.destroyed();
    this.container.destroy();
  }
}

/**
 * Injector node that is used to access provider outside of injection context.
 * @example
 * ```typescript
 * import { Injector, nodeInject, NodeInjectable, NodeContainer } from "@illuma/core";
import { NodeContainer } from '../container/container';
 *
 * @NodeInjectable()
 * class MyService {
 *   private readonly _injector = nodeInject(Injector);
 *   public doSomething() {
 *     const otherService = this._injector.get(OtherService);
 *     // Use otherService...
 *   }
 * }
 * ```
 */
export const Injector: NodeToken<iInjector> =
  injectorGlobal[INJECTOR_TOKEN_KEY] ??
  (injectorGlobal[INJECTOR_TOKEN_KEY] = new NodeToken<iInjector>("Injector"));
