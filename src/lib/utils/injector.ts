import type { MultiNodeToken } from "../api";
import { NodeToken } from "../api/token";
import type { Ctor, iDIContainer, Token } from "../types";

export interface iInjector {
  /** The DI container associated with this injector */
  readonly container: iDIContainer;

  /**
   * Retrieves an instance for the given token.
   * @template T - The type of value being retrieved
   * @param token - The token or constructor to retrieve
   * @returns The resolved instance
   */
  get<T>(token: MultiNodeToken<T>): T[];
  get<T>(token: NodeToken<T>): T;
  get<T>(token: Ctor<T>): T;

  /**
   * Instantiates a class with injections in runtime using current context.
   * Useful when creating an object that requires injections in runtime.
   * Class does not get registered in the container and cannot be retrieved via {@link get} or {@link nodeInject}.
   *
   * @template T - The type of the class being instantiated
   * @param ctor - The constructor of the class to instantiate
   * @returns A new instance of the class with dependencies injected
   * @throws {InjectionError} If called before bootstrap or if the constructor is invalid
   * Must be called after {@link bootstrap}.
   */
  produce<T>(token: Ctor<T>): T;
}

/**
 * Injector implementation that allows retrieving instances from the parent DI container.
 */
export class InjectorImpl implements iInjector {
  constructor(public readonly container: iDIContainer) {}

  public get<T>(token: MultiNodeToken<T>): T[];
  public get<T>(token: NodeToken<T>): T;
  public get<T>(token: Ctor<T>): T;
  public get<T>(token: Token<T>): T | T[] {
    return this.container.get<T>(token as any);
  }

  public produce<T>(token: Ctor<T>): T {
    return this.container.produce<T>(token);
  }
}

/**
 * Injector node that is used to access provider outside of injection context.
 * @example
 * ```typescript
 * import { Injector, nodeInject, NodeInjectable, NodeContainer } from "@zodyac/illuma";
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
export const Injector = new NodeToken<iInjector>("Injector");
