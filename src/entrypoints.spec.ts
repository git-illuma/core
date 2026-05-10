import { describe, expect, it, vi } from "vitest";

describe("Package Entrypoints", () => {
  describe("Main entrypoint (@illuma/core)", () => {
    it("should export core API modules", async () => {
      const mainExports = await import("./index");

      // API exports
      expect(mainExports.NodeToken).toBeDefined();
      expect(mainExports.MultiNodeToken).toBeDefined();
      expect(mainExports.NodeBase).toBeDefined();
      expect(mainExports.nodeInject).toBeDefined();
      expect(mainExports.injectDefer).toBeDefined();
      expect(mainExports.NodeInjectable).toBeDefined();
      expect(mainExports.makeInjectable).toBeDefined();
      expect(mainExports.isInjectable).toBeDefined();
      expect(mainExports.getInjectableToken).toBeDefined();
      expect(mainExports.isNodeBase).toBeDefined();
      expect(mainExports.extractToken).toBeDefined();
      expect(mainExports.registerClassAsInjectable).toBeDefined();
      expect(mainExports.Injector).toBeDefined();
      expect(mainExports.LifecycleRef).toBeDefined();
      expect(mainExports.NodeContainer).toBeDefined();
      expect(mainExports.InjectionContext).toBeDefined();
      expect(mainExports.InjectionError).toBeDefined();
      expect(mainExports.ILLUMA_ERR_CODES).toBeDefined();

      // @ts-expect-error Accessing internal API for testing
      expect(mainExports.Illuma).not.toBeDefined();

      // @ts-expect-error Accessing internal API for testing
      expect(mainExports.DiagnosticsDefaultReporter).not.toBeDefined();

      // @ts-expect-error Accessing internal API for testing
      expect(mainExports.enableIllumaDiagnostics).not.toBeDefined();

      // @ts-expect-error Accessing internal API for testing
      expect(mainExports.createTestFactory).not.toBeDefined();
    });
  });

  describe("Testkit entrypoint (@illuma/core/testkit)", () => {
    it("should export testkit utilities", async () => {
      const testkitExports = await import("./testkit");

      expect(testkitExports.createTestFactory).toBeDefined();
      expect(typeof testkitExports.createTestFactory).toBe("function");
    });

    it("should share runtime singletons across separately evaluated entrypoints", async () => {
      vi.resetModules();
      const coreExports = await import("./index");

      vi.resetModules();
      const testkitExports = await import("./testkit");

      const token = new coreExports.NodeToken("TOKEN");

      class DecoratedClass {
        public readonly value = coreExports.nodeInject(token);

        public getValue(): string {
          return this.value;
        }
      }

      coreExports.NodeInjectable()(DecoratedClass);

      class ManualClass {
        public readonly value = coreExports.nodeInject(token);

        public getValue(): string {
          return this.value;
        }
      }

      coreExports.makeInjectable(ManualClass);

      for (const target of [DecoratedClass, ManualClass]) {
        const create = testkitExports.createTestFactory({
          target,
          provide: [token.withValue("ok")],
        });

        expect(create().instance.getValue()).toBe("ok");
      }

      class NeedsBuiltins {
        public readonly injector = coreExports.nodeInject(coreExports.Injector);
        public readonly lifecycle = coreExports.nodeInject(coreExports.LifecycleRef);

        public isReady(): boolean {
          return !!this.injector && !!this.lifecycle;
        }
      }

      coreExports.NodeInjectable()(NeedsBuiltins);

      const create = testkitExports.createTestFactory({ target: NeedsBuiltins });
      expect(create().instance.isReady()).toBe(true);
    });
  });

  describe("Plugins entrypoint (@illuma/core/plugins)", () => {
    it("should export plugin modules", async () => {
      const pluginsExports = await import("./plugins");

      expect(pluginsExports.Illuma).toBeDefined();
      expect(pluginsExports.DiagnosticsDefaultReporter).toBeDefined();
      expect(pluginsExports.enableIllumaDiagnostics).toBeDefined();
      expect(typeof pluginsExports.enableIllumaDiagnostics).toBe("function");
    });
  });
});
