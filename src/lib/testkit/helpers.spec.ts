import {
  createProviderSet,
  MultiNodeToken,
  NodeInjectable,
  NodeToken,
  nodeInject,
} from "../api";
import { InjectionError } from "../errors";
import { createTestFactory } from "./helpers";

describe("Testkit Helpers", () => {
  it("should create an instantiatable test factory", () => {
    @NodeInjectable()
    class SampleService {
      getValue() {
        return "sample";
      }
    }

    const createProvider = createTestFactory({ target: SampleService });
    const spectator = createProvider();

    expect(spectator.instance).toBeInstanceOf(SampleService);
    expect(spectator.instance.getValue()).toBe("sample");
  });

  it("should include additional providers", () => {
    @NodeInjectable()
    class DependentService {
      public getData() {
        return 42;
      }
    }

    @NodeInjectable()
    class MainService {
      private readonly dep = nodeInject(DependentService);

      public fetchData() {
        return this.dep.getData();
      }
    }

    const createProvider = createTestFactory({
      target: MainService,
      providers: createProviderSet(DependentService),
    });

    const spectator = createProvider();
    expect(spectator.instance).toBeInstanceOf(MainService);
    expect(spectator.instance.fetchData()).toBe(42);

    expect(spectator.nodeInject(DependentService)).toBeInstanceOf(DependentService);
  });

  it("should work with token provider using factory", () => {
    const token = new NodeToken<string>("TEST_TOKEN", {
      factory: () => "factory-value",
    });

    const createProvider = createTestFactory({
      target: token,
    });

    const spectator = createProvider();
    expect(spectator.instance).toBe("factory-value");
  });

  it("should work with token provider using value", () => {
    const depToken = new NodeToken<{ message: string }>("DEP_TOKEN");

    @NodeInjectable()
    class Service {
      public readonly dep = nodeInject(depToken);
    }

    const createProvider = createTestFactory({
      target: Service,
      providers: createProviderSet({
        provide: depToken,
        value: { message: "static-value" },
      }),
    });

    const spectator = createProvider();
    expect(spectator.instance.dep.message).toBe("static-value");
  });

  it("should inject multi-token dependencies", () => {
    const multiToken = new MultiNodeToken<{ name: string }>("MULTI_TOKEN");

    @NodeInjectable()
    class ServiceA {
      public readonly name = "service-a";
    }

    @NodeInjectable()
    class ServiceB {
      public readonly name = "service-b";
    }

    @NodeInjectable()
    class Consumer {
      public readonly items = nodeInject(multiToken);
    }

    const createProvider = createTestFactory({
      target: Consumer,
      providers: createProviderSet(
        { provide: multiToken, alias: ServiceA },
        { provide: multiToken, alias: ServiceB },
      ),
    });

    const spectator = createProvider();
    expect(spectator.instance.items).toHaveLength(2);
    expect(spectator.instance.items.map((i) => i.name)).toEqual(
      expect.arrayContaining(["service-a", "service-b"]),
    );
  });

  it("should support optional injection via nodeInject", () => {
    const missingToken = new NodeToken<string>("MISSING_TOKEN");
    const presentToken = new NodeToken<string>("PRESENT_TOKEN");

    @NodeInjectable()
    class Service {
      public readonly value = "present";
    }

    const createProvider = createTestFactory({
      target: Service,
      providers: createProviderSet({ provide: presentToken, value: "present" }),
    });

    const spectator = createProvider();

    expect(spectator.nodeInject(missingToken, { optional: true })).toBeNull();
    expect(spectator.nodeInject(presentToken)).toBe("present");
  });

  it("should allow overriding target with custom provider", () => {
    @NodeInjectable()
    class DependencyService {
      getInfo() {
        return "dependency";
      }
    }

    class MockDependency {
      getInfo() {
        return "mocked-dependency";
      }
    }

    @NodeInjectable()
    class Consumer {
      private readonly dep = nodeInject(DependencyService);

      getValue() {
        return this.dep.getInfo();
      }
    }

    const createProvider = createTestFactory({
      target: Consumer,
      providers: createProviderSet({
        provide: DependencyService,
        useClass: MockDependency,
      }),
    });

    const spectator = createProvider();
    expect(spectator.instance.getValue()).toBe("mocked-dependency");
  });

  it("should rethrow error from container when token is missing and not optional", () => {
    const token = new NodeToken("token", { factory: () => "val" });
    const createProvider = createTestFactory({ target: token });
    const spectator = createProvider();

    const missingToken = new NodeToken("missing");
    expect(() => spectator.nodeInject(missingToken)).toThrow(InjectionError);
  });

  describe("Array providers API", () => {
    it("should support array of providers via provide property", () => {
      const tokenA = new NodeToken<string>("TOKEN_A");
      const tokenB = new NodeToken<number>("TOKEN_B");

      @NodeInjectable()
      class Service {
        public readonly a = nodeInject(tokenA);
        public readonly b = nodeInject(tokenB);
      }

      const createProvider = createTestFactory({
        target: Service,
        provide: [
          { provide: tokenA, value: "value-a" },
          { provide: tokenB, value: 42 },
        ],
      });

      const spectator = createProvider();
      expect(spectator.instance.a).toBe("value-a");
      expect(spectator.instance.b).toBe(42);
    });

    it("should support mixed array of providers and classes", () => {
      const token = new NodeToken<string>("TOKEN");

      @NodeInjectable()
      class DependencyService {
        public readonly value = "dependency";
      }

      @NodeInjectable()
      class Service {
        public readonly dep = nodeInject(DependencyService);
        public readonly tokenValue = nodeInject(token);
      }

      const createProvider = createTestFactory({
        target: Service,
        provide: [DependencyService, { provide: token, value: "token-value" }],
      });

      const spectator = createProvider();
      expect(spectator.instance.dep).toBeInstanceOf(DependencyService);
      expect(spectator.instance.dep.value).toBe("dependency");
      expect(spectator.instance.tokenValue).toBe("token-value");
    });

    it("should support nested arrays of providers", () => {
      const tokenA = new NodeToken<string>("TOKEN_A");
      const tokenB = new NodeToken<string>("TOKEN_B");
      const tokenC = new NodeToken<string>("TOKEN_C");

      @NodeInjectable()
      class Service {
        public readonly a = nodeInject(tokenA);
        public readonly b = nodeInject(tokenB);
        public readonly c = nodeInject(tokenC);
      }

      const createProvider = createTestFactory({
        target: Service,
        provide: [
          [{ provide: tokenA, value: "value-a" }],
          [
            { provide: tokenB, value: "value-b" },
            [{ provide: tokenC, value: "value-c" }],
          ],
        ],
      });

      const spectator = createProvider();
      expect(spectator.instance.a).toBe("value-a");
      expect(spectator.instance.b).toBe("value-b");
      expect(spectator.instance.c).toBe("value-c");
    });

    it("should support multi-token providers in arrays", () => {
      const multiToken = new MultiNodeToken<{ name: string }>("MULTI");

      @NodeInjectable()
      class PluginA {
        public readonly name = "plugin-a";
      }

      @NodeInjectable()
      class PluginB {
        public readonly name = "plugin-b";
      }

      @NodeInjectable()
      class Service {
        public readonly plugins = nodeInject(multiToken);
      }

      const createProvider = createTestFactory({
        target: Service,
        provide: [
          { provide: multiToken, alias: PluginA },
          { provide: multiToken, alias: PluginB },
        ],
      });

      const spectator = createProvider();
      expect(spectator.instance.plugins).toHaveLength(2);
      expect(spectator.instance.plugins.map((p) => p.name)).toEqual(
        expect.arrayContaining(["plugin-a", "plugin-b"]),
      );
    });

    it("should allow combining provide array with deprecated providers", () => {
      const tokenA = new NodeToken<string>("TOKEN_A");
      const tokenB = new NodeToken<string>("TOKEN_B");

      @NodeInjectable()
      class Service {
        public readonly a = nodeInject(tokenA);
        public readonly b = nodeInject(tokenB);
      }

      const createProvider = createTestFactory({
        target: Service,
        providers: createProviderSet({ provide: tokenA, value: "from-provider-set" }),
        provide: [{ provide: tokenB, value: "from-provide-array" }],
      });

      const spectator = createProvider();
      expect(spectator.instance.a).toBe("from-provider-set");
      expect(spectator.instance.b).toBe("from-provide-array");
    });

    it("should support factory providers in arrays", () => {
      const tokenA = new NodeToken<string>("TOKEN_A");
      const tokenB = new NodeToken<() => string>("TOKEN_B");

      @NodeInjectable()
      class Service {
        public readonly a = nodeInject(tokenA);
        public readonly b = nodeInject(tokenB);
      }

      const createProvider = createTestFactory({
        target: Service,
        provide: [
          { provide: tokenA, factory: () => "factory-a" },
          { provide: tokenB, factory: () => () => "factory-b" },
        ],
      });

      const spectator = createProvider();
      expect(spectator.instance.a).toBe("factory-a");
      expect(spectator.instance.b()).toBe("factory-b");
    });

    it("should support class providers in arrays", () => {
      const token = new NodeToken<{ getValue: () => string }>("TOKEN");

      class Implementation {
        getValue() {
          return "implementation";
        }
      }

      @NodeInjectable()
      class Service {
        public readonly impl = nodeInject(token);
      }

      const createProvider = createTestFactory({
        target: Service,
        provide: [{ provide: token, useClass: Implementation }],
      });

      const spectator = createProvider();
      expect(spectator.instance.impl).toBeInstanceOf(Implementation);
      expect(spectator.instance.impl.getValue()).toBe("implementation");
    });
  });
});
