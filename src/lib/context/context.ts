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
  public static readonly _calls: Set<iInjectionNode<any>> = new Set();
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
  public static open(injector?: InjectorFn): void {
    InjectionContext._calls.clear();
    InjectionContext.contextOpen = true;
    InjectionContext.injector = injector || null;
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
      const scanned = scanner.scan(factory);
      for (const node of scanned) InjectionContext._calls.add(node);
    }

    InjectionContext._flushInto(target);
    InjectionContext.close();
  }

  /**
   * Scans a factory function for dependencies and returns a set of injection nodes.
   *
   * @param factory - The factory function to scan
   * @returns A set of injection nodes detected during the scan
   */
  public static scan(factory: any): Set<iInjectionNode<any>> {
    const deps = new Set<iInjectionNode<any>>();
    InjectionContext.scanInto(factory, deps);
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
    InjectionContext.open(injector);

    try {
      return factory();
    } finally {
      InjectionContext.close();
    }
  }

  /** Closes the current injection context. */
  public static close(): void {
    InjectionContext.contextOpen = false;
    InjectionContext._calls.clear();
    InjectionContext.injector = null;
  }

  /**
   * Closes current injection context and returns the set of injection nodes
   * that were called during the context.
   * @returns A set of injection nodes that were called during the context
   */
  public static closeAndReport(): Set<iInjectionNode<any>> {
    const calls = new Set(InjectionContext._calls);
    InjectionContext.close();
    return calls;
  }

  private static _flushInto(target: Set<iInjectionNode<any>>): void {
    for (const call of InjectionContext._calls) target.add(call);
  }
}
