import type { NodeBase } from "../api/token";
import { InjectionError } from "../errors";
import type { iContextScanner } from "../plugins/context/types";
import { PluginContainer } from "../plugins/core/plugin-container";
import type { InjectionNode } from "./node";

/** @internal */
export type InjectorFn = (token: NodeBase<any>, optional?: boolean) => any;

/**
 * Internal context manager for tracking dependency injections during factory execution.
 * This class manages the injection context lifecycle and tracks all injection calls.
 *
 * @internal
 */
export abstract class InjectionContext {
  public static contextOpen = false;
  public static calls = new Set<InjectionNode<any>>();
  public static injector: InjectorFn | null = null;
  private static readonly _scanners = PluginContainer.contextScanners;

  public static open(injector?: InjectorFn): void {
    InjectionContext.calls = new Set();
    InjectionContext.contextOpen = true;
    InjectionContext.injector = injector || null;
  }

  public static getCalls(): Set<InjectionNode<any>> {
    if (!InjectionContext.contextOpen) {
      throw InjectionError.calledUtilsOutsideContext();
    }

    return new Set(InjectionContext.calls);
  }

  public static scan(factory: any): Set<InjectionNode<any>> {
    if (typeof factory !== "function") return new Set();
    InjectionContext.open();

    try {
      factory();
    } catch {
      // No-op
    }

    const scanners = InjectionContext._scanners;
    for (const scanner of scanners) {
      const scanned = scanner.scan(factory);
      for (const node of scanned) InjectionContext.calls.add(node);
    }

    const injections = new Set(InjectionContext.calls);
    InjectionContext.close();
    return injections;
  }

  public static instantiate<T>(factory: () => T, injector: InjectorFn): T {
    InjectionContext.open(injector);
    try {
      return factory();
    } finally {
      InjectionContext.close();
    }
  }

  public static close(): void {
    InjectionContext.contextOpen = false;
    InjectionContext.calls = new Set();
    InjectionContext.injector = null;
  }
}

// Checks that default context implementation satisfies the scanner interface
InjectionContext satisfies iContextScanner;
