import type { InjectorFn } from "../api/types";
import { InjectionError } from "../errors";
import { Illuma } from "../global/global";
import type { iContextScanner } from "../plugins/context/types";
import type { iInjectionNode } from "./types";

interface iInjectionContextFrame {
  contextOpen: boolean;
  injector: InjectorFn | null;
  calls: Set<iInjectionNode<any>>;
}

interface iInjectionContextState extends iInjectionContextFrame {
  stack: iInjectionContextFrame[];
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
    stack: [],
  };
}

const injectionContextState = contextGlobal[INJECTION_CONTEXT_STATE_KEY];
// Backfill if state was created by an older version of @illuma/core sharing
// the same globalThis (npm + jsr, dual-installs, etc.)
injectionContextState.stack ??= [];

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

  protected static get _scanners(): readonly iContextScanner[] {
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
   * Opens a new injection context, suspending the current one.
   * The previous context (open flag, injector, and collected calls) is pushed
   * onto a stack and restored by the matching {@link close}, so a factory that
   * triggers a nested instantiation/scan does not clobber its outer context.
   *
   * @param injector - Optional injector function to use for resolving dependencies
   */
  public static open(injector?: InjectorFn): void {
    injectionContextState.stack.push({
      contextOpen: injectionContextState.contextOpen,
      injector: injectionContextState.injector,
      calls: injectionContextState.calls,
    });

    injectionContextState.contextOpen = true;
    injectionContextState.injector = injector || null;
    injectionContextState.calls = new Set<iInjectionNode<any>>();
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
    const baseDepth = injectionContextState.stack.length;

    // close() must run on every path: a throwing context scanner would
    // otherwise orphan the frame opened above and leave the context corrupted
    // for every subsequent instantiation sharing this globalThis state.
    try {
      try {
        factory();
      } catch {
        // No-op: dry-run, unresolved injections are expected here
      }

      for (const scanner of InjectionContextBase._scanners) {
        try {
          const scanned = scanner.scan(factory);
          for (const node of scanned) InjectionContextBase._calls.add(node);
        } catch (err) {
          // A misbehaving scanner must not break provide() or corrupt the
          // shared context, but the error must not vanish silently.
          Illuma.logger.error(
            "[Illuma] A context scanner threw during dependency scan; its injections were skipped:",
            err,
          );
        }
      }

      InjectionContextBase._flushInto(target);
    } finally {
      // Discard any frames a re-entrant scanner opened without closing, then
      // close this scan's own frame, so the stack returns to its prior depth.
      while (injectionContextState.stack.length > baseDepth) {
        InjectionContextBase.close();
      }
      InjectionContextBase.close();
    }
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

  /**
   * Closes the current injection context, restoring the one suspended by the
   * matching {@link open}. Falls back to a fully-closed state when there is no
   * outer context to restore.
   */
  public static close(): void {
    const previous = injectionContextState.stack.pop();
    if (previous) {
      injectionContextState.contextOpen = previous.contextOpen;
      injectionContextState.injector = previous.injector;
      injectionContextState.calls = previous.calls;
      return;
    }

    injectionContextState.contextOpen = false;
    injectionContextState.injector = null;
    injectionContextState.calls = new Set<iInjectionNode<any>>();
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
