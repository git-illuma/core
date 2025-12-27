import type { iContextScanner } from "../context";
import type { iDiagnosticsModule, iDiagnosticsReport } from "../diagnostics/types";

/**
 * Global plugin container for managing core plugins such as diagnostics and context scanners.
 */
export abstract class PluginContainer {
  private static readonly _diagnostics = [] as iDiagnosticsModule[];
  private static readonly _scanners = [] as iContextScanner[];

  /** @internal */
  public static get contextScanners(): ReadonlyArray<iContextScanner> {
    return PluginContainer._scanners;
  }

  /**
   * Extends the diagnostics with a new diagnostics module.
   * These will be run on diagnostics reports after container bootstrap.
   *
   * @param m - The diagnostics module instance to add
   */
  public static extendDiagnostics(m: iDiagnosticsModule): void {
    PluginContainer._diagnostics.push(m);
  }

  /**
   * Extends the context scanners with a new context scanner.
   * These will be run in injection context scans to detect additional injections (alongside `nodeInject` calls).
   *
   * @param scanner - The context scanner instance to add
   */
  public static extendContextScanner(scanner: iContextScanner): void {
    PluginContainer._scanners.push(scanner);
  }

  protected static onReport(report: iDiagnosticsReport): void {
    for (const diag of PluginContainer._diagnostics) diag.onReport(report);
  }
}
