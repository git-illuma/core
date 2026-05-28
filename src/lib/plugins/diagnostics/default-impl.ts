import { Illuma } from "../../global";
import type { iDiagnosticsModule, iDiagnosticsReport } from "./types";

/** @internal */
export class DiagnosticsDefaultReporter implements iDiagnosticsModule {
  public onReport(report: iDiagnosticsReport): void {
    const logger = Illuma.logger;
    logger.log("[Illuma] 🧹 Diagnostics:");
    logger.log(`  Total: ${report.totalNodes} node(s)`);
    logger.log(`  ${report.unusedNodes.length} were not used while bootstrap:`);
    for (const node of report.unusedNodes) logger.log(`    - ${node.toString()}`);
  }
}
