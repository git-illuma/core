import type { NodeToken } from "../api/token";
import type { iContextScanner } from "../plugins/context";
import type {
  iDiagnosticsModule,
  iDiagnosticsReport,
} from "../plugins/diagnostics/types";
import type { iMiddleware } from "../plugins/middlewares/types";

interface iIllumaGlobalState {
  diagnostics: Set<iDiagnosticsModule>;
  scanners: iContextScanner[];
  middlewares: iMiddleware[];
  classRegistry: WeakMap<object, NodeToken<any>>;
}

const ILLUMA_CLASS_KEY = Symbol.for("@illuma/core/Illuma");
const ILLUMA_STATE_KEY = Symbol.for("@illuma/core/IllumaState");

type iIllumaGlobalThis = typeof globalThis & {
  [ILLUMA_CLASS_KEY]?: typeof IllumaBase;
  [ILLUMA_STATE_KEY]?: iIllumaGlobalState;
};

const illumaGlobal = globalThis as iIllumaGlobalThis;

if (!illumaGlobal[ILLUMA_STATE_KEY]) {
  illumaGlobal[ILLUMA_STATE_KEY] = {
    diagnostics: new Set<iDiagnosticsModule>(),
    scanners: [] as iContextScanner[],
    middlewares: [] as iMiddleware[],
    classRegistry: new WeakMap<object, NodeToken<any>>(),
  };
}

const illumaState = illumaGlobal[ILLUMA_STATE_KEY];

/**
 * Global plugin container for managing core plugins such as diagnostics and context scanners.
 */
abstract class IllumaBase {
  private static get _diagnostics(): Set<iDiagnosticsModule> {
    return illumaState.diagnostics;
  }

  private static get _scanners(): iContextScanner[] {
    return illumaState.scanners;
  }

  protected static get _middlewares(): iMiddleware[] {
    return illumaState.middlewares;
  }

  /**
   * Registry to store associated tokens for injectable classes.
   * Uses WeakMap to ensure metadata doesn't prevent garbage collection of classes.
   */
  public static get _classRegistry(): WeakMap<object, NodeToken<any>> {
    return illumaState.classRegistry;
  }

  /** @internal */
  public static get contextScanners(): ReadonlyArray<iContextScanner> {
    return IllumaBase._scanners;
  }

  /**
   * Extends the diagnostics with a new diagnostics module.
   * These will be run on diagnostics reports after container bootstrap.
   *
   * @param m - The diagnostics module instance to add
   */
  public static extendDiagnostics(m: iDiagnosticsModule): void {
    IllumaBase._diagnostics.add(m);
  }

  /**
   * Extends the context scanners with a new context scanner.
   * These will be run in injection context scans to detect additional injections (alongside `nodeInject` calls).
   *
   * @param scanner - The context scanner instance to add
   */
  public static extendContextScanner(scanner: iContextScanner): void {
    IllumaBase._scanners.push(scanner);
  }

  /**
   * Registers a global middleware to be applied during instance creation.
   * Typically used for cross-cutting concerns like logging, profiling, or custom instantiation logic.
   * Function should accept instantiation parameters and a `next` function to proceed with the next middleware or actual instantiation.
   *
   * @param m - The middleware function to register
   */
  public static registerGlobalMiddleware(m: iMiddleware): void {
    IllumaBase._middlewares.push(m);
  }

  protected readonly middlewares = [] as iMiddleware[];
  public registerMiddleware(m: iMiddleware): void {
    this.middlewares.push(m);
  }

  protected static onReport(report: iDiagnosticsReport): void {
    for (const diag of IllumaBase._diagnostics) diag.onReport(report);
  }

  /**
   * @internal
   * Check if diagnostics modules are registered
   */
  protected static hasDiagnostics(): boolean {
    return IllumaBase._diagnostics.size > 0;
  }

  /**
   * @internal
   * Reset all plugin registrations
   */
  protected static __resetPlugins(): void {
    IllumaBase._diagnostics.clear();
    IllumaBase._scanners.length = 0;
    IllumaBase._middlewares.length = 0;
  }
}

if (!illumaGlobal[ILLUMA_CLASS_KEY]) {
  illumaGlobal[ILLUMA_CLASS_KEY] = class Illuma extends IllumaBase {};
}

/**
 * Global plugin container for managing core plugins such as diagnostics and context scanners.
 */
export const Illuma: typeof IllumaBase = illumaGlobal[ILLUMA_CLASS_KEY];
