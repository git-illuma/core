import type { iContextScanner } from "../context";
import type { iDiagnosticsModule, iDiagnosticsReport } from "../diagnostics/types";
import type { iMiddleware } from "../middlewares/types";

/**
 * Global plugin container for managing core plugins such as diagnostics and context scanners.
 */
export abstract class Illuma {
  private static readonly _diagnostics = new Set<iDiagnosticsModule>();
  private static readonly _scanners = [] as iContextScanner[];
  protected static readonly _middlewares = [] as iMiddleware[];

  /** @internal */
  public static get contextScanners(): ReadonlyArray<iContextScanner> {
    return Illuma._scanners;
  }

  /**
   * Extends the diagnostics with a new diagnostics module.
   * These will be run on diagnostics reports after container bootstrap.
   *
   * @param m - The diagnostics module instance to add
   */
  public static extendDiagnostics(m: iDiagnosticsModule): void {
    Illuma._diagnostics.add(m);
  }

  /**
   * Extends the context scanners with a new context scanner.
   * These will be run in injection context scans to detect additional injections (alongside `nodeInject` calls).
   *
   * @param scanner - The context scanner instance to add
   */
  public static extendContextScanner(scanner: iContextScanner): void {
    Illuma._scanners.push(scanner);
  }

  /**
   * Registers a global middleware to be applied during instance creation.
   * Typically used for cross-cutting concerns like logging, profiling, or custom instantiation logic.
   * Function should accept instantiation parameters and a `next` function to proceed with the next middleware or actual instantiation.
   *
   * @param m - The middleware function to register
   */
  public static registerGlobalMiddleware(m: iMiddleware): void {
    Illuma._middlewares.push(m);
  }

  protected readonly middlewares = [] as iMiddleware[];
  public registerMiddleware(m: iMiddleware): void {
    this.middlewares.push(m);
  }

  protected static onReport(report: iDiagnosticsReport): void {
    for (const diag of Illuma._diagnostics) diag.onReport(report);
  }

  /**
   * @internal
   * Check if diagnostics modules are registered
   */
  protected static hasDiagnostics(): boolean {
    return Illuma._diagnostics.size > 0;
  }

  /**
   * @internal
   * Reset all plugin registrations
   */
  protected static __resetPlugins(): void {
    Illuma._diagnostics.clear();
    Illuma._scanners.length = 0;
    Illuma._middlewares.length = 0;
  }
}
