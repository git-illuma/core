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
      expect(mainExports.INJECTION_SYMBOL).toBeDefined();
      expect(mainExports.Injector).toBeDefined();
      expect(mainExports.InjectorImpl).toBeDefined();
      expect(mainExports.NodeContainer).toBeDefined();
      expect(mainExports.InjectionContext).toBeDefined();
      expect(mainExports.InjectionError).toBeDefined();
      expect(mainExports.ILLUMA_ERR_CODES).toBeDefined();
    });
  });

  describe("Testkit entrypoint (@illuma/core/testkit)", () => {
    it("should export testkit utilities", async () => {
      const testkitExports = await import("./testkit");

      expect(testkitExports.createTestFactory).toBeDefined();
      expect(typeof testkitExports.createTestFactory).toBe("function");
    });
  });

  describe("Plugins entrypoint (@illuma/core/plugins)", () => {
    it("should export plugin modules", async () => {
      const pluginsExports = await import("./plugins");

      expect(pluginsExports.Illuma).toBeDefined();
      expect(pluginsExports.DiagnosticsDefaultReporter).toBeDefined();
    });
  });
});
