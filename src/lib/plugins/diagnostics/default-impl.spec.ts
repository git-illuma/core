import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiagnosticsDefaultReporter } from "./default-impl";
import type { iDiagnosticsReport } from "./types";

describe("DiagnosticsDefaultReporter", () => {
  let consoleLogSpy: import("vitest").MockInstance<typeof console.log>;
  let reporter: DiagnosticsDefaultReporter;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    reporter = new DiagnosticsDefaultReporter();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("should log diagnostics header and total", () => {
    const report: iDiagnosticsReport = {
      totalNodes: 42,
      unusedNodes: [],
      bootstrapDuration: 0,
    };

    reporter.onReport(report);

    expect(consoleLogSpy).toHaveBeenCalledWith("[Illuma] 🧹 Diagnostics:");
    expect(consoleLogSpy).toHaveBeenCalledWith("  Total: 42 node(s)");
  });

  it("should log unused nodes", () => {
    const report: iDiagnosticsReport = {
      totalNodes: 10,
      unusedNodes: [
        { toString: () => "ServiceA" } as any,
        { toString: () => "ServiceB" } as any,
      ],
      bootstrapDuration: 0,
    };

    reporter.onReport(report);

    expect(consoleLogSpy).toHaveBeenCalledWith("  2 were not used while bootstrap:");
    expect(consoleLogSpy).toHaveBeenCalledWith("    - ServiceA");
    expect(consoleLogSpy).toHaveBeenCalledWith("    - ServiceB");
  });

  it("should handle zero unused nodes", () => {
    const report: iDiagnosticsReport = {
      totalNodes: 15,
      unusedNodes: [],
      bootstrapDuration: 0,
    };

    reporter.onReport(report);

    expect(consoleLogSpy).toHaveBeenCalledWith("  0 were not used while bootstrap:");
  });
});
