import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractToken,
  MultiNodeToken,
  NodeInjectable,
  NodeToken,
  nodeInject,
} from "../../api";
import { NodeContainer } from "../../container";
import type { TreeNode } from "../../provider";
import { Illuma } from "../core";
import * as builtIn from "./built-in";

describe("Performance measurement", () => {
  it("should measure performance when enabled", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const container = new NodeContainer({ measurePerformance: true });
    container.bootstrap();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Bootstrapped in"));
    consoleSpy.mockRestore();
  });
});

describe("allocation tracking", () => {
  it("should track allocations for single nodes", () => {
    const container = new NodeContainer();
    const tokenA = new NodeToken<string>("A");
    const tokenB = new NodeToken<string>("B");

    container.provide({
      provide: tokenA,
      value: "a",
    });

    container.provide({
      provide: tokenB,
      factory: () => {
        nodeInject(tokenA);
        return "b";
      },
    });

    container.bootstrap();

    const rootNode = (container as any)._rootNode;
    const nodeA = rootNode.find(tokenA);
    const nodeB = rootNode.find(tokenB);

    expect(nodeA.allocations).toBe(1); // Used by B
    expect(nodeB.allocations).toBe(0); // Not used by anyone
  });

  it("should track allocations for multi nodes", () => {
    const container = new NodeContainer();
    const pluginToken = new MultiNodeToken<string>("Plugin");
    const serviceToken = new NodeToken<string>("Service");

    container.provide({
      provide: pluginToken,
      value: "plugin-1",
    });

    container.provide({
      provide: pluginToken,
      value: "plugin-2",
    });

    container.provide({
      provide: serviceToken,
      factory: () => {
        const plugins = nodeInject(pluginToken);
        return `service-${plugins.length}`;
      },
    });

    container.bootstrap();

    const rootNode = (container as any)._rootNode;
    const pluginNode = rootNode.find(pluginToken);
    const serviceNode = rootNode.find(serviceToken);

    expect(pluginNode.allocations).toBe(1); // Used by service
    expect(serviceNode.allocations).toBe(0); // Not used
  });

  it("should track multiple allocations", () => {
    const container = new NodeContainer();
    const sharedToken = new NodeToken<string>("Shared");
    const serviceA = new NodeToken<string>("ServiceA");
    const serviceB = new NodeToken<string>("ServiceB");
    const serviceC = new NodeToken<string>("ServiceC");

    container.provide({
      provide: sharedToken,
      value: "shared",
    });

    container.provide({
      provide: serviceA,
      factory: () => {
        nodeInject(sharedToken);
        return "a";
      },
    });

    container.provide({
      provide: serviceB,
      factory: () => {
        nodeInject(sharedToken);
        return "b";
      },
    });

    container.provide({
      provide: serviceC,
      factory: () => {
        nodeInject(serviceA);
        nodeInject(serviceB);
        return "c";
      },
    });

    container.bootstrap();

    const rootNode = (container as any)._rootNode;
    const sharedNode = rootNode.find(sharedToken);
    const nodeA = rootNode.find(serviceA);
    const nodeB = rootNode.find(serviceB);
    const nodeC = rootNode.find(serviceC);

    expect(sharedNode.allocations).toBe(2); // Used by A and B
    expect(nodeA.allocations).toBe(1); // Used by C
    expect(nodeB.allocations).toBe(1); // Used by C
    expect(nodeC.allocations).toBe(0); // Not used
  });

  it("should track allocations with injectable classes", () => {
    const container = new NodeContainer();

    @NodeInjectable()
    class Logger {
      log() {
        return "logging";
      }
    }

    @NodeInjectable()
    class Database {
      query() {
        return "querying";
      }
    }

    @NodeInjectable()
    class UserService {
      public readonly logger = nodeInject(Logger);
      public readonly db = nodeInject(Database);
    }

    container.provide(Logger);
    container.provide(Database);
    container.provide(UserService);

    container.bootstrap();

    const rootNode = (container as any)._rootNode;
    const loggerNode = rootNode.find(extractToken(Logger));
    const dbNode = rootNode.find(extractToken(Database));
    const userServiceNode = rootNode.find(extractToken(UserService));

    expect(loggerNode.allocations).toBe(1);
    expect(dbNode.allocations).toBe(1);
    expect(userServiceNode.allocations).toBe(0);
  });
});

describe("Plugin: Diagnostics", () => {
  let consoleLogSpy: import("vitest").MockInstance;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    // Reset the enabled flag and plugin registrations before each test
    builtIn.__resetDiagnosticsState();
    // biome-ignore lint/complexity/useLiteralKeys: Accessing internal reset method for testing
    Illuma["__resetPlugins"]();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("should not call diagnostics plugins when not enabled", () => {
    const container = new NodeContainer();
    const token = new NodeToken<string>("Token");

    container.provide({
      provide: token,
      value: "value",
    });

    container.bootstrap();

    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Diagnostics"),
    );
  });

  it("should call registered diagnostics modules when enabled", () => {
    const mockDiagnosticsModule = {
      onReport: vi.fn(),
    };

    builtIn.enableIllumaDiagnostics();
    Illuma.extendDiagnostics(mockDiagnosticsModule);

    const container = new NodeContainer();
    const token = new NodeToken<string>("Token");

    container.provide({
      provide: token,
      value: "value",
    });

    container.bootstrap();

    expect(mockDiagnosticsModule.onReport).toHaveBeenCalledWith(
      expect.objectContaining({
        totalNodes: expect.any(Number),
        unusedNodes: expect.any(Array),
        bootstrapDuration: expect.any(Number),
      }),
    );
  });

  it("should pass correct report data to diagnostics modules", () => {
    const mockDiagnosticsModule = {
      onReport: vi.fn(),
    };

    builtIn.enableIllumaDiagnostics();
    Illuma.extendDiagnostics(mockDiagnosticsModule);

    const container = new NodeContainer();
    const usedToken = new NodeToken<string>("Used");
    const unusedToken = new NodeToken<string>("Unused");

    container.provide({
      provide: usedToken,
      value: "used",
    });

    container.provide({
      provide: unusedToken,
      value: "unused",
    });

    container.bootstrap();

    expect(mockDiagnosticsModule.onReport).toHaveBeenCalled();
    const report = mockDiagnosticsModule.onReport.mock.calls[0][0];

    expect(report.totalNodes).toBeGreaterThan(0);
    expect(report.unusedNodes).toBeInstanceOf(Array);
    expect(report.bootstrapDuration).toBeGreaterThanOrEqual(0);
    expect(
      report.unusedNodes.some((node: TreeNode) => node.toString().includes("Unused")),
    ).toBe(true);
  });

  it("should call default diagnostics reporter when enabled", () => {
    builtIn.enableIllumaDiagnostics();
    const container = new NodeContainer();
    const token = new NodeToken<string>("Token");

    container.provide({
      provide: token,
      value: "value",
    });

    container.bootstrap();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Illuma] 🧹 Diagnostics:"),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Total:"));
  });

  it("should report unused nodes in diagnostics", () => {
    builtIn.enableIllumaDiagnostics();
    const container = new NodeContainer();
    const usedToken = new NodeToken<string>("Used");
    const unusedToken = new NodeToken<string>("Unused");

    container.provide({
      provide: usedToken,
      value: "used",
    });

    container.provide({
      provide: unusedToken,
      value: "unused",
    });

    container.bootstrap();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("were not used while bootstrap:"),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Unused"));
  });

  it("should not list nodes with allocations as unused", () => {
    builtIn.enableIllumaDiagnostics();
    const container = new NodeContainer();
    const usedToken = new NodeToken<string>("Used");
    const consumerToken = new NodeToken<string>("Consumer");

    container.provide({
      provide: usedToken,
      value: "used",
    });

    container.provide({
      provide: consumerToken,
      factory: () => {
        nodeInject(usedToken);
        return "consumer";
      },
    });

    container.bootstrap();

    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining("Used"));
  });

  it("should work with multi-node tokens in diagnostics", () => {
    builtIn.enableIllumaDiagnostics();
    const container = new NodeContainer();
    const multiToken = new MultiNodeToken<string>("Multi");

    container.provide({ provide: multiToken, value: "item1" });
    container.provide({ provide: multiToken, value: "item2" });

    container.bootstrap();

    // Multi token should be unused if not injected
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("1 were not used"),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Multi"));
  });

  it("should call multiple diagnostics modules in sequence", () => {
    const mockModule1 = {
      onReport: vi.fn(),
    };
    const mockModule2 = {
      onReport: vi.fn(),
    };

    builtIn.enableIllumaDiagnostics();
    Illuma.extendDiagnostics(mockModule1);
    Illuma.extendDiagnostics(mockModule2);

    const container = new NodeContainer();
    const token = new NodeToken<string>("Token");

    container.provide({
      provide: token,
      value: "value",
    });

    container.bootstrap();

    expect(mockModule1.onReport).toHaveBeenCalled();
    expect(mockModule2.onReport).toHaveBeenCalled();

    // Both should receive the same report
    const report1 = mockModule1.onReport.mock.calls[0][0];
    const report2 = mockModule2.onReport.mock.calls[0][0];

    expect(report1.totalNodes).toBe(report2.totalNodes);
    expect(report1.unusedNodes.length).toBe(report2.unusedNodes.length);
  });

  it("should include bootstrap duration in diagnostics report", () => {
    const mockDiagnosticsModule = {
      onReport: vi.fn(),
    };

    builtIn.enableIllumaDiagnostics();
    Illuma.extendDiagnostics(mockDiagnosticsModule);

    const container = new NodeContainer();
    const token = new NodeToken<string>("Token");

    container.provide({
      provide: token,
      value: "value",
    });

    container.bootstrap();

    const report = mockDiagnosticsModule.onReport.mock.calls[0][0];
    expect(report.bootstrapDuration).toBeGreaterThanOrEqual(0);
    expect(typeof report.bootstrapDuration).toBe("number");
  });
});
