import type { iContextScanner } from "../context/types";
import type { iDiagnosticsModule, iDiagnosticsReport } from "../diagnostics/types";
import { PluginContainer } from "./plugin-container";

// Test subclass to expose protected methods
class TestPluginContainer extends PluginContainer {
  public static triggerReport(report: iDiagnosticsReport): void {
    PluginContainer.onReport(report);
  }

  public static resetPlugins(): void {
    (PluginContainer as any)._diagnostics.length = 0;
    (PluginContainer as any)._scanners.length = 0;
  }
}

describe("PluginContainer", () => {
  beforeEach(() => {
    TestPluginContainer.resetPlugins();
  });

  afterEach(() => {
    TestPluginContainer.resetPlugins();
  });

  describe("extendDiagnostics", () => {
    it("should register and call diagnostics module", () => {
      const mockModule: iDiagnosticsModule = {
        onReport: jest.fn(),
      };

      PluginContainer.extendDiagnostics(mockModule);

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
        onReport: jest.fn(() => callOrder.push(1)),
      };
      const mockModule2: iDiagnosticsModule = {
        onReport: jest.fn(() => callOrder.push(2)),
      };

      PluginContainer.extendDiagnostics(mockModule1);
      PluginContainer.extendDiagnostics(mockModule2);

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
        scan: jest.fn(() => new Set()),
      };

      PluginContainer.extendContextScanner(mockScanner);

      const scanners = PluginContainer.contextScanners;
      expect(scanners).toHaveLength(1);
      expect(scanners[0]).toBe(mockScanner);
    });

    it("should register multiple scanners in order", () => {
      const mockScanner1: iContextScanner = { scan: jest.fn(() => new Set()) };
      const mockScanner2: iContextScanner = { scan: jest.fn(() => new Set()) };

      PluginContainer.extendContextScanner(mockScanner1);
      PluginContainer.extendContextScanner(mockScanner2);

      const scanners = PluginContainer.contextScanners;
      expect(scanners).toEqual([mockScanner1, mockScanner2]);
    });
  });

  describe("contextScanners", () => {
    it("should return readonly array", () => {
      const scanners = PluginContainer.contextScanners;
      expect(Array.isArray(scanners)).toBe(true);
    });
  });
});
