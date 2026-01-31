import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { iInjectionNode } from "../../context";
import type { iContextScanner } from "../context/types";
import type { iDiagnosticsModule, iDiagnosticsReport } from "../diagnostics/types";
import { Illuma } from "./plugin-container";

// Test subclass to expose protected methods
class TestPluginContainer extends Illuma {
  public static triggerReport(report: iDiagnosticsReport): void {
    Illuma.onReport(report);
  }

  public static resetPlugins(): void {
    (Illuma as any)._diagnostics.length = 0;
    (Illuma as any)._scanners.length = 0;
  }
}

describe("Illuma", () => {
  beforeEach(() => {
    TestPluginContainer.resetPlugins();
  });

  afterEach(() => {
    TestPluginContainer.resetPlugins();
  });

  describe("extendDiagnostics", () => {
    it("should register and call diagnostics module", () => {
      const mockModule: iDiagnosticsModule = {
        onReport: vi.fn(),
      };

      Illuma.extendDiagnostics(mockModule);

      const report: iDiagnosticsReport = {
        totalNodes: 10,
        unusedNodes: [],
        bootstrapDuration: 50,
      };

      TestPluginContainer.triggerReport(report);

      expect(mockModule.onReport).toHaveBeenCalledWith(report);
    });

    it("should call multiple modules in order", () => {
      const callOrder: number[] = [];
      const mockModule1: iDiagnosticsModule = {
        onReport: vi.fn(() => callOrder.push(1)),
      };
      const mockModule2: iDiagnosticsModule = {
        onReport: vi.fn(() => callOrder.push(2)),
      };

      Illuma.extendDiagnostics(mockModule1);
      Illuma.extendDiagnostics(mockModule2);

      TestPluginContainer.triggerReport({
        totalNodes: 0,
        unusedNodes: [],
        bootstrapDuration: 0,
      });

      expect(callOrder).toEqual([1, 2]);
    });
  });

  describe("extendContextScanner", () => {
    it("should register context scanner", () => {
      const mockScanner: iContextScanner = {
        scan: vi.fn(() => new Set<iInjectionNode<unknown>>()),
      };

      Illuma.extendContextScanner(mockScanner);

      const scanners = Illuma.contextScanners;
      expect(scanners).toHaveLength(1);
      expect(scanners[0]).toBe(mockScanner);
    });

    it("should register multiple scanners in order", () => {
      const mockScanner1: iContextScanner = {
        scan: vi.fn(() => new Set<iInjectionNode<unknown>>()),
      };
      const mockScanner2: iContextScanner = {
        scan: vi.fn(() => new Set<iInjectionNode<unknown>>()),
      };

      Illuma.extendContextScanner(mockScanner1);
      Illuma.extendContextScanner(mockScanner2);

      const scanners = Illuma.contextScanners;
      expect(scanners).toEqual([mockScanner1, mockScanner2]);
    });
  });

  describe("contextScanners", () => {
    it("should return readonly array", () => {
      const scanners = Illuma.contextScanners;
      expect(Array.isArray(scanners)).toBe(true);
    });
  });
});
