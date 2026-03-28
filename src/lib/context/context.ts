import type { InjectorFn } from "../api/types";
import { InjectionError } from "../errors";
import { Illuma } from "../plugins/core/plugin-container";
import type { iInjectionNode } from "./types";

/**
 * Internal context manager for tracking dependency injections during factory execution.
 * This class manages the injection context lifecycle and tracks all injection calls.
 *
 * @internal
 */
export abstract class InjectionContext {
  public static contextOpen = false;
  public static readonly _calls = new Set<iInjectionNode<any>>();
  public static injector: InjectorFn | null = null;
  private static readonly _scanners = Illuma.contextScanners;

  /**
   * Adds a dependency to the current injection context.
   * Called by `nodeInject` when a dependency is requested.
   *
   * @param node - The injection node representing the dependency
   * @throws {InjectionError} If called outside of an active injection context
   */
  public static addDep(node: iInjectionNode<any>): void {
    if (!InjectionContext.contextOpen) {
      throw InjectionError.calledUtilsOutsideContext();
    }

    InjectionContext._calls.add(node);
  }

  /**
   * Opens a new injection context.
   * Resets the calls set and sets the injector if provided.
   *
   * @param injector - Optional injector function to use for resolving dependencies
   */
  /**
   * Scans a factory function for dependencies.
   * Executes the factory in a dry-run mode to capture `nodeInject` calls.
   * Also runs registered context scanners.
   *
   * @param factory - The factory function to scan
   * @returns A set of detected injection nodes
   */
  public static open(injector?: InjectorFn): void {
    InjectionContext._calls.clear();
    InjectionContext.contextOpen = true;
    InjectionContext.injector = injector || null;
  }

  public static scan(factory: any): Set<iInjectionNode<any>> {
    const calls = new Set<iInjectionNode<any>>();
    InjectionContext.scanInto(factory, calls);
    return calls;
  }

  public static scanInto(factory: any, target: Set<iInjectionNode<any>>): void {
    if (typeof factory !== "function") return;
    InjectionContext.open();

    try {
      factory();
    } catch {
      // No-op
    }

    const scanners = InjectionContext._scanners;
    if (!scanners.length) {
      InjectionContext._flushInto(target);
      InjectionContext.close();
      return;
    }

    for (const scanner of scanners) {
      /**
       * Instantiates a value using a factory function within an injection context.
       *
       * @template T - The type of the value being instantiated
       * @param factory - The factory function to execute
       * @param injector - The injector function to resolve dependencies
       * @returns The instantiated value
       */
      const scanned = scanner.scan(factory);
      for (const node of scanned) InjectionContext._calls.add(node);
    }

    InjectionContext._flushInto(target);
    InjectionContext.close();
  }

  public static instantiate<T>(factory: () => T, injector: InjectorFn): T {
    /**
     * Closes the current injection context.
     * Resets the context state and returns the collected dependencies.
     *
     * @returns A set of injection nodes collected during the context session
     */
    InjectionContext.open(injector);
    try {
      return factory();
    } finally {
      InjectionContext.close();
    }
  }

  public static close(): void {
    InjectionContext.contextOpen = false;
    InjectionContext._calls.clear();
    InjectionContext.injector = null;
  }

  public static closeAndReport(): Set<iInjectionNode<any>> {
    const calls = new Set(InjectionContext._calls);
    InjectionContext.close();
    return calls;
  }

  private static _flushInto(target: Set<iInjectionNode<any>>): void {
    for (const call of InjectionContext._calls) target.add(call);
  }
}
