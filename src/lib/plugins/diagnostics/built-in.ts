import { Illuma } from "../../global";
import { performanceDiagnostics } from "../middlewares/diagnostics.middleware";
import { DiagnosticsDefaultReporter } from "./default-impl";

// The idempotency flag lives on globalThis (like the registries it guards) so a
// dual-installed copy of @illuma/core can't double-register the reporter +
// middleware, and a global plugin reset clears it too.
export const DIAGNOSTICS_ENABLED_KEY = Symbol.for("@illuma/core/DiagnosticsEnabled");
const diagGlobal = globalThis as typeof globalThis & {
  [DIAGNOSTICS_ENABLED_KEY]?: boolean;
};

/** @internal */
export function enableIllumaDiagnostics() {
  if (diagGlobal[DIAGNOSTICS_ENABLED_KEY]) return;
  diagGlobal[DIAGNOSTICS_ENABLED_KEY] = true;

  Illuma.extendDiagnostics(new DiagnosticsDefaultReporter());
  Illuma.registerGlobalMiddleware(performanceDiagnostics);
}

/**
 * @internal
 * Reset diagnostics state (for testing only)
 */
export function __resetDiagnosticsState() {
  diagGlobal[DIAGNOSTICS_ENABLED_KEY] = false;
}
