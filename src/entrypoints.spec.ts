describe("Package Entrypoints", () => {
  describe("Main entrypoint (@zodyac/illuma)", () => {
    it("should export core API modules", async () => {
      const mainExports = await import("./index");

      // API exports
      expect(mainExports.NodeToken).toBeDefined();
      expect(mainExports.MultiNodeToken).toBeDefined();
      expect(mainExports.NodeBase).toBeDefined();
      expect(mainExports.nodeInject).toBeDefined();
      expect(mainExports.NodeInjectable).toBeDefined();
      expect(mainExports.makeInjectable).toBeDefined();
      expect(mainExports.isInjectable).toBeDefined();
      expect(mainExports.getInjectableToken).toBeDefined();
      expect(mainExports.isNodeBase).toBeDefined();
      expect(mainExports.extractToken).toBeDefined();
      expect(mainExports.createProviderSet).toBeDefined();
      expect(mainExports.INJECTION_SYMBOL).toBeDefined();
      expect(mainExports.INJECTION_GROUP_SYMBOL).toBeDefined();
      expect(mainExports.NodeContainer).toBeDefined();
      expect(mainExports.InjectionContext).toBeDefined();
    });
  });

  describe("Testkit entrypoint (@zodyac/illuma/testkit)", () => {
    it("should export testkit utilities", async () => {
      const testkitExports = await import("./testkit");

      expect(testkitExports.createTestFactory).toBeDefined();
      expect(typeof testkitExports.createTestFactory).toBe("function");
    });
  });

  describe("Plugins entrypoint (@zodyac/illuma/plugins)", () => {
    it("should export plugin modules", async () => {
      const pluginsExports = await import("./plugins");

      expect(pluginsExports.PluginContainer).toBeDefined();
      expect(pluginsExports.DiagnosticsDefaultReporter).toBeDefined();
    });
  });
});
