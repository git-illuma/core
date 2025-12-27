import type { iDiagnosticsModule, iDiagnosticsReport } from "./types";

export class DiagnosticsDefaultReporter implements iDiagnosticsModule {
  public onReport(report: iDiagnosticsReport): void {
    console.log("[Illuma] 🧹 Diagnostics:");
    console.log(`  Total: ${report.totalNodes} node(s)`);
    console.log(`  ${report.unusedNodes.length} were not used while bootstrap:`);
    for (const node of report.unusedNodes) console.log(`    - ${node.toString()}`);
  }
}
