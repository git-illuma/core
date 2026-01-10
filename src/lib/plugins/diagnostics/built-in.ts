import { Illuma } from "../core";
import { performanceDiagnostics } from "../middlewares/diagnostics.middleware";
import { DiagnosticsDefaultReporter } from "./default-impl";

const state = { enabled: false };

export function enableIllumaDiagnostics() {
  if (state.enabled) return;
  state.enabled = true;

  Illuma.extendDiagnostics(new DiagnosticsDefaultReporter());
  Illuma.registerGlobalMiddleware(performanceDiagnostics);
}

/**
 * @internal
 * Reset diagnostics state (for testing only)
 */
export function __resetDiagnosticsState() {
  state.enabled = false;
}
