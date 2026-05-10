import type { InjectorFn } from "../api/types";
import { InjectionError } from "../errors";
import { Illuma } from "../global/global";
import type { iInjectionNode } from "./types";

interface iInjectionContextState {
  contextOpen: boolean;
  injector: InjectorFn | null;
  calls: Set<iInjectionNode<any>>;
}

const INJECTION_CONTEXT_KEY = Symbol.for("@illuma/core/InjectionContext");
const INJECTION_CONTEXT_STATE_KEY = Symbol.for("@illuma/core/InjectionContextState");

type iInjectionContextGlobalThis = typeof globalThis & {
  [INJECTION_CONTEXT_KEY]?: typeof InjectionContextBase;
  [INJECTION_CONTEXT_STATE_KEY]?: iInjectionContextState;
};

const contextGlobal = globalThis as iInjectionContextGlobalThis;

if (!contextGlobal[INJECTION_CONTEXT_STATE_KEY]) {
  contextGlobal[INJECTION_CONTEXT_STATE_KEY] = {
    contextOpen: false,
    injector: null,
    calls: new Set<iInjectionNode<any>>(),
  };
}

const injectionContextState = contextGlobal[INJECTION_CONTEXT_STATE_KEY];

/**
 * Internal context manager for tracking dependency injections during factory execution.
 * This class manages the injection context lifecycle and tracks all injection calls.
 *
 * @internal
 */
abstract class InjectionContextBase {
  public static get contextOpen(): boolean {
    return injectionContextState.contextOpen;
  }

  private static set contextOpen(value: boolean) {
    injectionContextState.contextOpen = value;
  }

  public static get injector(): InjectorFn | null {
    return injectionContextState.injector;
  }

  private static set injector(value: InjectorFn | null) {
    injectionContextState.injector = value;
  }

  protected static get _calls(): Set<iInjectionNode<any>> {
    return injectionContextState.calls;
  }

  protected static get _scanners() {
    return Illuma.contextScanners;
  }

  /**
   * Adds a dependency to the current injection context.
   * Called by `nodeInject` when a dependency is requested.
   *
   * @param node - The injection node representing the dependency
   * @throws {InjectionError} If called outside of an active injection context
   */
  public static addDep(node: iInjectionNode<any>): void {
    if (!InjectionContextBase.contextOpen) {
      throw InjectionError.calledUtilsOutsideContext();
    }

    InjectionContextBase._calls.add(node);
  }

  /**
   * Opens a new injection context.
   * Resets the calls set and sets the injector if provided.
   *
   * @param injector - Optional injector function to use for resolving dependencies
   */
  public static open(injector?: InjectorFn): void {
    InjectionContextBase._calls.clear();
    InjectionContextBase.contextOpen = true;
    InjectionContextBase.injector = injector || null;
  }

  /**
   * Scans a factory function for dependencies and puts them into the target set.
   * Executes the factory in a dry-run mode to capture `nodeInject` calls.
   * Also runs registered context scanners.
   *
   * @param factory - The factory function to scan
   * @param target - The set to populate with detected injection nodes
   */
  public static scanInto(factory: any, target: Set<iInjectionNode<any>>): void {
    if (typeof factory !== "function") return;
    InjectionContextBase.open();

    try {
      factory();
    } catch {
      // No-op
    }

    const scanners = InjectionContextBase._scanners;
    if (!scanners.length) {
      InjectionContextBase._flushInto(target);
      InjectionContextBase.close();
      return;
    }

    for (const scanner of scanners) {
      const scanned = scanner.scan(factory);
      for (const node of scanned) InjectionContextBase._calls.add(node);
    }

    InjectionContextBase._flushInto(target);
    InjectionContextBase.close();
  }

  /**
   * Scans a factory function for dependencies and returns a set of injection nodes.
   *
   * @param factory - The factory function to scan
   * @returns A set of injection nodes detected during the scan
   */
  public static scan(factory: any): Set<iInjectionNode<any>> {
    const deps = new Set<iInjectionNode<any>>();
    InjectionContextBase.scanInto(factory, deps);
    return deps;
  }

  /**
   * Instantiates a value using a factory function within an injection context.
   *
   * @template T - The type of the value being instantiated
   * @param factory - The factory function to execute
   * @param injector - The injector function to resolve dependencies
   * @returns The instantiated value
   */
  public static instantiate<T>(factory: () => T, injector: InjectorFn): T {
    InjectionContextBase.open(injector);

    try {
      return factory();
    } finally {
      InjectionContextBase.close();
    }
  }

  /** Closes the current injection context. */
  public static close(): void {
    InjectionContextBase.contextOpen = false;
    InjectionContextBase._calls.clear();
    InjectionContextBase.injector = null;
  }

  /**
   * Closes current injection context and returns the set of injection nodes
   * that were called during the context.
   * @returns A set of injection nodes that were called during the context
   */
  public static closeAndReport(): Set<iInjectionNode<any>> {
    const calls = new Set(InjectionContextBase._calls);
    InjectionContextBase.close();
    return calls;
  }

  /** @internal */
  private static _flushInto(target: Set<iInjectionNode<any>>): void {
    for (const call of InjectionContextBase._calls) target.add(call);
  }
}

if (!contextGlobal[INJECTION_CONTEXT_KEY]) {
  contextGlobal[INJECTION_CONTEXT_KEY] = class InjectionContext extends (
    InjectionContextBase
  ) {};
}

/**
 * Global context manager for tracking dependency injections during factory execution.
 * This class manages the injection context lifecycle and tracks all injection calls.
 *
 * @example
 * ```typescript
 * // Scanning a factory for dependencies
 * const deps = InjectionContext.scan(() => {
 *   const logger = nodeInject(LoggerToken);
 *   const config = nodeInject(ConfigToken);
 * });
 *
 * // Instantiating a value with an injector
 * const instance = InjectionContext.instantiate(() => new MyClass(nodeInject(Dep1), nodeInject(Dep2)), myInjector);
 * ```
 */
export const InjectionContext: typeof InjectionContextBase =
  contextGlobal[INJECTION_CONTEXT_KEY];
