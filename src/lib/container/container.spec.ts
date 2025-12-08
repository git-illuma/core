import {
  createProviderSet,
  INJECTION_SYMBOL,
  MultiNodeToken,
  makeInjectable,
  NodeInjectable,
  NodeToken,
  nodeInject,
} from "../api";
import { InjectionError } from "../errors";
import { NodeContainer } from "./container";

describe("NodeContainer", () => {
  describe("token providers", () => {
    it("should provide with factory", () => {
      const container = new NodeContainer();
      const token = new NodeToken("plainToken");

      container.provide({
        provide: token,
        factory: () => "value",
      });

      container.bootstrap();
      expect(container.get(token)).toBe("value");
    });

    it("should provide with value", () => {
      const container = new NodeContainer();
      const token = new NodeToken("plainToken");

      container.provide({
        provide: token,
        value: "value",
      });

      container.bootstrap();
      expect(container.get(token)).toBe("value");
    });

    it("should provide with class", () => {
      const container = new NodeContainer();
      const token = new NodeToken<{ value: string }>("plainToken");

      class TestClass {
        public readonly value = "class-value";
      }

      container.provide({
        provide: token,
        useClass: TestClass,
      });

      container.bootstrap();
      const instance = container.get(token);
      expect(instance).toBeInstanceOf(TestClass);
      expect(instance.value).toBe("class-value");
    });

    it("should provide decorated class", () => {
      const container = new NodeContainer();

      @NodeInjectable()
      class TestClass {
        public readonly value = "class-value";
      }

      container.provide(TestClass);

      container.bootstrap();
      const instance = container.get(TestClass);
      expect(instance).toBeInstanceOf(TestClass);
      expect(instance.value).toBe("class-value");
    });

    it("should override with class", () => {
      const container = new NodeContainer();

      @NodeInjectable()
      class TestClass {
        public readonly value: string = "test-class-value";
      }

      class OverrideClass {
        public readonly value: string = "override-value";
      }

      container.provide({
        provide: TestClass,
        useClass: OverrideClass,
      });

      container.bootstrap();

      const instance = container.get(TestClass);
      expect(instance).toBeInstanceOf(OverrideClass);
      expect(instance.value).toBe("override-value");
    });

    it("should override with factory", () => {
      const container = new NodeContainer();

      @NodeInjectable()
      class TestClass {
        public readonly value: string = "test-class-value";
      }

      container.provide({
        provide: TestClass,
        factory: () => ({ value: "factory-value" }),
      });

      container.bootstrap();
      expect(container.get(TestClass).value).toBe("factory-value");
    });

    it("should override with value", () => {
      const container = new NodeContainer();

      @NodeInjectable()
      class TestClass {
        public readonly value: string = "test-class-value";
      }

      container.provide({
        provide: TestClass,
        value: { value: "static-value" },
      });

      container.bootstrap();
      expect(container.get(TestClass).value).toBe("static-value");
    });

    it("should alias tokens", () => {
      const container = new NodeContainer();

      @NodeInjectable()
      class TestClass {
        public readonly value: string = "test-class-value";
      }

      @NodeInjectable()
      class AliasedClass {
        public readonly value: string = "aliased-value";
      }

      container.provide(AliasedClass);
      container.provide({
        provide: TestClass,
        alias: AliasedClass,
      });

      container.bootstrap();

      const instance = container.get(TestClass);
      expect(instance).toBeInstanceOf(AliasedClass);
      expect(instance.value).toBe("aliased-value");
    });

    it("should use token built-in factory", () => {
      const container = new NodeContainer();
      const token = new NodeToken("plainToken", {
        factory: () => "built-in-value",
      });

      container.provide(token);

      container.bootstrap();
      expect(container.get(token)).toBe("built-in-value");
    });

    it("should override token declaration with decorated class", () => {
      const container = new NodeContainer();
      const token = new NodeToken<{ value: string }>("TOKEN");

      class TestClass {
        public readonly value = "decorated-value";
      }

      // Manually assign the token to make it "decorated"
      (TestClass as any)[INJECTION_SYMBOL] = token;

      container.provide(token);
      container.provide(TestClass);

      container.bootstrap();
      const instance = container.get(token);
      expect(instance).toBeInstanceOf(TestClass);
      expect(instance.value).toBe("decorated-value");
    });

    it("should throw when token not found", () => {
      const container = new NodeContainer();
      const token = new NodeToken("plainToken");

      container.bootstrap();
      expect(() => container.get(token)).toThrow(InjectionError.notFound(token));
    });

    it("should allow declaring token first then providing value", () => {
      const container = new NodeContainer();
      const token = new NodeToken<string>("token");

      container.provide(token); // Declare
      container.provide({ provide: token, value: "value" }); // Provide

      container.bootstrap();
      expect(container.get(token)).toBe("value");
    });

    it("should allow declaring token first then providing class", () => {
      const container = new NodeContainer();
      const token = new NodeToken<{ value: string }>("token");

      class TestClass {
        value = "value";
      }

      container.provide(token); // Declare
      container.provide({ provide: token, useClass: TestClass }); // Provide

      container.bootstrap();
      expect(container.get(token).value).toBe("value");
    });
  });

  describe("makeInjectable helper", () => {
    it("should make class injectable", () => {
      const container = new NodeContainer();

      class _TestClass {
        public readonly value = "class-value";
      }

      const TestClass = makeInjectable(_TestClass);
      container.provide(TestClass);

      container.bootstrap();
      const instance = container.get(TestClass);
      expect(instance).toBeInstanceOf(TestClass);
      expect(instance.value).toBe("class-value");
    });

    it("should work with override using class", () => {
      const container = new NodeContainer();

      class _TestClass {
        public readonly value: string = "test-class-value";
      }

      const TestClass = makeInjectable(_TestClass);

      class OverrideClass {
        public readonly value: string = "override-value";
      }

      container.provide({
        provide: TestClass,
        useClass: OverrideClass,
      });

      container.bootstrap();

      const instance = container.get(TestClass);
      expect(instance).toBeInstanceOf(OverrideClass);
      expect(instance.value).toBe("override-value");
    });

    it("should work with override using factory", () => {
      const container = new NodeContainer();

      class _TestClass {
        public readonly value: string = "test-class-value";
      }

      const TestClass = makeInjectable(_TestClass);

      container.provide({
        provide: TestClass,
        factory: () => ({ value: "factory-value" }),
      });

      container.bootstrap();
      expect(container.get(TestClass).value).toBe("factory-value");
    });

    it("should work with override using value", () => {
      const container = new NodeContainer();

      class _TestClass {
        public readonly value: string = "test-class-value";
      }

      const TestClass = makeInjectable(_TestClass);

      container.provide({
        provide: TestClass,
        value: { value: "static-value" },
      });

      container.bootstrap();
      expect(container.get(TestClass).value).toBe("static-value");
    });

    it("should work with aliasing", () => {
      const container = new NodeContainer();

      class _TestClass {
        public readonly value: string = "test-class-value";
      }

      const TestClass = makeInjectable(_TestClass);

      class _AliasedClass {
        public readonly value: string = "aliased-value";
      }

      const AliasedClass = makeInjectable(_AliasedClass);

      container.provide(AliasedClass);
      container.provide({
        provide: TestClass,
        alias: AliasedClass,
      });

      container.bootstrap();

      const instance = container.get(TestClass);
      expect(instance).toBeInstanceOf(AliasedClass);
      expect(instance.value).toBe("aliased-value");
    });

    it("should work with dependency injection", () => {
      const container = new NodeContainer();
      const dep = new NodeToken<string>("DEP");

      class _TestClass {
        public readonly injected = nodeInject(dep);
      }

      const TestClass = makeInjectable(_TestClass);

      container.provide(TestClass);
      container.provide({ provide: dep, value: "dep-value" });

      container.bootstrap();
      expect(container.get(TestClass).injected).toBe("dep-value");
    });

    it("should work with multi token injection", () => {
      const container = new NodeContainer();
      const multi = new MultiNodeToken<{ value: string }>("MULTI_TOKEN");

      class _TestClass {
        public readonly injected = nodeInject(multi);
      }

      const TestClass = makeInjectable(_TestClass);

      class Dep {
        public readonly value = "dep-value";
      }

      makeInjectable(Dep);

      container.provide({ provide: multi, alias: Dep });
      container.provide({ provide: multi, value: { value: "direct-value" } });
      container.provide(TestClass);

      container.bootstrap();

      const instance = container.get(TestClass);
      expect(instance.injected.length).toBe(2);
      expect(instance.injected.some((i) => i instanceof Dep)).toBe(true);
      expect(instance.injected.some((i) => i.value === "direct-value")).toBe(true);
    });

    it("should throw on duplicate class", () => {
      const container = new NodeContainer();

      class _TestClass {
        public readonly value = "test-value";
      }

      const TestClass = makeInjectable(_TestClass);

      container.provide(TestClass);
      expect(() => container.provide(_TestClass)).toThrow();
    });

    it("should work identically to NodeInjectable decorator", () => {
      const containerA = new NodeContainer();
      const containerB = new NodeContainer();

      @NodeInjectable()
      class DecoratedClass {
        public readonly value = "test-value";
      }

      class _ManualClass {
        public readonly value = "test-value";
      }

      const ManualClass = makeInjectable(_ManualClass);
      containerA.provide(DecoratedClass);
      containerB.provide(ManualClass);

      containerA.bootstrap();
      containerB.bootstrap();

      const instanceA = containerA.get(DecoratedClass);
      const instanceB = containerB.get(ManualClass);

      expect(instanceA).toBeInstanceOf(DecoratedClass);
      expect(instanceB).toBeInstanceOf(ManualClass);
      expect(instanceA.value).toBe(instanceB.value);
    });
  });

  describe("multi token providers", () => {
    it("should provide multiple factories", () => {
      const container = new NodeContainer();
      const token = new MultiNodeToken<string>("tokenValue");

      for (let i = 0; i < 3; i++) {
        container.provide({
          provide: token,
          factory: () => `value-${i}`,
        });
      }

      container.bootstrap();
      expect(container.get(token)).toEqual(["value-0", "value-1", "value-2"]);
    });

    it("should provide multiple values", () => {
      const container = new NodeContainer();
      const token = new MultiNodeToken<string>("tokenValue");

      for (let i = 0; i < 3; i++) {
        container.provide({
          provide: token,
          value: `value-${i}`,
        });
      }

      container.bootstrap();
      expect(container.get(token)).toEqual(["value-0", "value-1", "value-2"]);
    });

    it("should provide multiple classes", () => {
      const container = new NodeContainer();
      const token = new MultiNodeToken<{ value: string }>("tokenValue");

      for (let i = 0; i < 3; i++) {
        class TestClass {
          public readonly value = `value-${i}`;
        }

        container.provide({
          provide: token,
          useClass: TestClass,
        });
      }

      container.bootstrap();
      const values = container.get(token);
      expect(values.map((v) => v.value)).toEqual(["value-0", "value-1", "value-2"]);
    });

    it("should alias multiple decorated classes", () => {
      const container = new NodeContainer();
      const token = new MultiNodeToken<{ value: string }>("MULTI_TOKEN");

      for (let i = 0; i < 3; i++) {
        @NodeInjectable()
        class TestClass {
          public readonly value = `value-${i}`;
        }

        container.provide({
          provide: token,
          alias: TestClass,
        });
      }

      container.bootstrap();
      const values = container.get(token);
      expect(values.map((v) => v.value)).toEqual(["value-0", "value-1", "value-2"]);
    });

    it("should handle multi-token aliasing unregistered single tokens", () => {
      const container = new NodeContainer();
      const singleToken = new NodeToken<string>("SINGLE");
      const multiToken = new MultiNodeToken<string>("MULTI");

      // Alias a single token that was never registered
      container.provide({
        provide: multiToken,
        alias: singleToken,
      });

      // This should throw because the aliased token has no provider
      expect(() => container.bootstrap()).toThrow(InjectionError.notFound(singleToken));
    });

    it("should merge aliased multi tokens", () => {
      const container = new NodeContainer();
      const tokenA = new MultiNodeToken<string>("tokenValueA");
      const tokenB = new MultiNodeToken<string>("tokenValueB");

      for (let i = 0; i < 3; i++) {
        container.provide({
          provide: tokenA,
          factory: () => `A-${i}`,
        });
        container.provide({
          provide: tokenB,
          factory: () => `B-${i}`,
        });
      }

      container.provide({
        provide: tokenB,
        alias: tokenA,
      });

      container.bootstrap();
      const values = container.get(tokenB);
      expect(values.length).toBe(6);
      expect(values).toEqual(
        expect.arrayContaining(["B-0", "B-1", "B-2", "A-0", "A-1", "A-2"]),
      );
    });

    it("should mix provider types", () => {
      const container = new NodeContainer();
      const token = new MultiNodeToken<{ value: string }>("MULTI_TOKEN");

      for (let i = 0; i < 3; i++) {
        container.provide({
          provide: token,
          value: { value: `val-${i}` },
        });

        container.provide({
          provide: token,
          factory: () => ({ value: `fac-${i}` }),
        });

        class TestClass {
          public readonly value = `cls-${i}`;
        }

        container.provide({
          provide: token,
          useClass: TestClass,
        });
      }

      container.bootstrap();
      const values = container.get(token);
      expect(values.length).toBe(9);
      expect(values.map((v) => v.value)).toEqual([
        "val-0",
        "fac-0",
        "cls-0",
        "val-1",
        "fac-1",
        "cls-1",
        "val-2",
        "fac-2",
        "cls-2",
      ]);
    });

    it("should return empty array when multi token not found", () => {
      const container = new NodeContainer();
      const token = new MultiNodeToken<string>("plainToken");

      container.bootstrap();
      expect(container.get(token)).toEqual([]);
    });

    it("should handle aliasing unregistered multi-tokens", () => {
      const container = new NodeContainer();
      const tokenA = new MultiNodeToken<string>("TOKEN_A");
      const tokenB = new MultiNodeToken<string>("TOKEN_B");

      // Provide tokenB which aliases tokenA, but tokenA is never registered
      container.provide({
        provide: tokenB,
        value: "direct-value",
      });

      container.provide({
        provide: tokenB,
        alias: tokenA,
      });

      container.bootstrap();
      expect(container.get(tokenB)).toEqual(["direct-value"]);
      expect(container.get(tokenA)).toEqual([]);
    });
  });

  describe("injection", () => {
    it("should inject dependencies", () => {
      const container = new NodeContainer();
      const dep = new NodeToken<string>("DEP");

      @NodeInjectable()
      class TestClass {
        public readonly injected = nodeInject(dep);
      }

      container.provide(TestClass);
      container.provide({ provide: dep, value: "dep-value" });

      container.bootstrap();
      expect(container.get(TestClass).injected).toBe("dep-value");
    });

    it("should inject multi token dependencies", () => {
      const container = new NodeContainer();
      const multi = new MultiNodeToken<{ value: string }>("MULTI_TOKEN");

      @NodeInjectable()
      class TestClass {
        public readonly injected = nodeInject(multi);
      }

      @NodeInjectable()
      class Dep {
        public readonly value = "dep-value";
      }

      container.provide({ provide: multi, alias: Dep });
      container.provide({ provide: multi, value: { value: "direct-value" } });
      container.provide(TestClass);

      container.bootstrap();

      const instance = container.get(TestClass);
      expect(instance.injected.length).toBe(2);
      expect(instance.injected.some((i) => i instanceof Dep)).toBe(true);
      expect(instance.injected.some((i) => i.value === "direct-value")).toBe(true);
    });

    it("should inject in factories", () => {
      const container = new NodeContainer();
      const valueToken = new NodeToken<string>("VALUE_TOKEN");
      const factoryToken = new NodeToken<string>("FACTORY_TOKEN");

      container.provide({ provide: valueToken, value: "injected-value" });
      container.provide({
        provide: factoryToken,
        factory: () => `result-${nodeInject(valueToken)}`,
      });

      container.bootstrap();
      expect(container.get(factoryToken)).toBe("result-injected-value");
    });

    it("should support optional injection", () => {
      const container = new NodeContainer();
      const token = new NodeToken<string>("OPTIONAL_TOKEN");
      const target = new NodeToken<string | null>("TARGET_TOKEN");

      container.provide({
        provide: target,
        factory: () => nodeInject(token, { optional: true }),
      });

      container.bootstrap();
      expect(container.get(target)).toBeFalsy();
    });
  });

  describe("[BC] provider sets", () => {
    it("should include provider sets", () => {
      const container = new NodeContainer();
      const tokenA = new NodeToken<string>("TOKEN_A");
      const tokenB = new NodeToken<string>("TOKEN_B");

      const providerSet = createProviderSet(
        { provide: tokenA, value: "value-a" },
        { provide: tokenB, value: "value-b" },
      );

      container.include(providerSet);
      container.bootstrap();

      expect(container.get(tokenA)).toBe("value-a");
      expect(container.get(tokenB)).toBe("value-b");
    });
  });

  describe("Array providers", () => {
    it("should provide an array of providers", () => {
      const container = new NodeContainer();
      const tokenA = new NodeToken<string>("TOKEN_A");
      const tokenB = new NodeToken<string>("TOKEN_B");

      container.provide([
        { provide: tokenA, value: "value-a" },
        { provide: tokenB, value: "value-b" },
      ]);

      container.bootstrap();
      expect(container.get(tokenA)).toBe("value-a");
      expect(container.get(tokenB)).toBe("value-b");
    });

    it("should provide mixed array of providers", () => {
      const container = new NodeContainer();
      const tokenA = new NodeToken<string>("TOKEN_A");
      const tokenB = new NodeToken<string>("TOKEN_B");
      @NodeInjectable()
      class TestClass {
        public readonly value = "test-value";
      }

      container.provide([
        { provide: tokenA, value: "value-a" },
        { provide: tokenB, value: "value-b" },
        TestClass,
      ]);

      container.bootstrap();
      expect(container.get(tokenA)).toBe("value-a");
      expect(container.get(tokenB)).toBe("value-b");
      expect(container.get(TestClass).value).toBe("test-value");
    });

    it("should provide nested arrays of providers", () => {
      const container = new NodeContainer();
      const tokenA = new NodeToken<string>("TOKEN_A");
      const tokenB = new NodeToken<string>("TOKEN_B");
      @NodeInjectable()
      class TestClass {
        public readonly value = "test-value";
      }

      container.provide([
        [{ provide: tokenA, value: "value-a" }, [{ provide: tokenB, value: "value-b" }]],
        TestClass,
      ]);

      container.bootstrap();
      expect(container.get(tokenA)).toBe("value-a");
      expect(container.get(tokenB)).toBe("value-b");
      expect(container.get(TestClass).value).toBe("test-value");
    });

    it("should provide array with multi-token providers", () => {
      const container = new NodeContainer();
      const multiToken = new MultiNodeToken<{ name: string }>("MULTI_TOKEN");

      @NodeInjectable()
      class PluginA {
        public readonly name = "plugin-a";
      }

      @NodeInjectable()
      class PluginB {
        public readonly name = "plugin-b";
      }

      container.provide([
        { provide: multiToken, alias: PluginA },
        { provide: multiToken, alias: PluginB },
      ]);

      container.bootstrap();
      const plugins = container.get(multiToken);
      expect(plugins).toHaveLength(2);
      expect(plugins.map((p) => p.name)).toEqual(
        expect.arrayContaining(["plugin-a", "plugin-b"]),
      );
    });

    it("should provide array with factory providers", () => {
      const container = new NodeContainer();
      const tokenA = new NodeToken<string>("TOKEN_A");
      const tokenB = new NodeToken<number>("TOKEN_B");

      container.provide([
        { provide: tokenA, factory: () => "factory-a" },
        { provide: tokenB, factory: () => 42 },
      ]);

      container.bootstrap();
      expect(container.get(tokenA)).toBe("factory-a");
      expect(container.get(tokenB)).toBe(42);
    });

    it("should provide array with class providers", () => {
      const container = new NodeContainer();
      const token = new NodeToken<{ getValue: () => string }>("TOKEN");

      class Implementation {
        getValue() {
          return "implementation";
        }
      }

      container.provide([{ provide: token, useClass: Implementation }]);

      container.bootstrap();
      expect(container.get(token)).toBeInstanceOf(Implementation);
      expect(container.get(token).getValue()).toBe("implementation");
    });

    it("should provide array with alias providers", () => {
      const container = new NodeContainer();

      @NodeInjectable()
      class ServiceA {
        public readonly name = "service-a";
      }

      @NodeInjectable()
      class ServiceB {
        public readonly name = "service-b";
      }

      container.provide([ServiceA, { provide: ServiceB, alias: ServiceA }]);

      container.bootstrap();
      const instanceA = container.get(ServiceA);
      const instanceB = container.get(ServiceB);
      expect(instanceB).toBe(instanceA);
      expect(instanceB.name).toBe("service-a");
    });

    it("should handle dependencies with array providers", () => {
      const container = new NodeContainer();
      const depToken = new NodeToken<string>("DEP_TOKEN");

      @NodeInjectable()
      class DependencyService {
        public readonly value = nodeInject(depToken);
      }

      @NodeInjectable()
      class MainService {
        public readonly dep = nodeInject(DependencyService);
      }

      container.provide([
        MainService,
        DependencyService,
        { provide: depToken, value: "dependency-value" },
      ]);

      container.bootstrap();
      const main = container.get(MainService);
      expect(main.dep).toBeInstanceOf(DependencyService);
      expect(main.dep.value).toBe("dependency-value");
    });

    it("should allow empty arrays", () => {
      const container = new NodeContainer();
      const token = new NodeToken<string>("TOKEN");

      container.provide([]);
      container.provide({ provide: token, value: "value" });

      container.bootstrap();
      expect(container.get(token)).toBe("value");
    });

    it("should handle deeply nested arrays", () => {
      const container = new NodeContainer();
      const tokenA = new NodeToken<string>("TOKEN_A");
      const tokenB = new NodeToken<string>("TOKEN_B");
      const tokenC = new NodeToken<string>("TOKEN_C");
      const tokenD = new NodeToken<string>("TOKEN_D");

      container.provide([
        [[[{ provide: tokenA, value: "value-a" }]]],
        [
          { provide: tokenB, value: "value-b" },
          [
            [
              { provide: tokenC, value: "value-c" },
              [{ provide: tokenD, value: "value-d" }],
            ],
          ],
        ],
      ]);

      container.bootstrap();
      expect(container.get(tokenA)).toBe("value-a");
      expect(container.get(tokenB)).toBe("value-b");
      expect(container.get(tokenC)).toBe("value-c");
      expect(container.get(tokenD)).toBe("value-d");
    });

    it("should work with token declarations in arrays", () => {
      const container = new NodeContainer();
      const tokenA = new NodeToken<string>("TOKEN_A");
      const tokenB = new NodeToken<string>("TOKEN_B");

      container.provide([tokenA, tokenB]);
      container.provide([
        { provide: tokenA, value: "value-a" },
        { provide: tokenB, value: "value-b" },
      ]);

      container.bootstrap();
      expect(container.get(tokenA)).toBe("value-a");
      expect(container.get(tokenB)).toBe("value-b");
    });

    it("should combine array providers with include", () => {
      const container = new NodeContainer();
      const tokenA = new NodeToken<string>("TOKEN_A");
      const tokenB = new NodeToken<string>("TOKEN_B");

      const providerSet = createProviderSet({ provide: tokenA, value: "from-set" });

      container.include(providerSet);
      container.provide([{ provide: tokenB, value: "from-array" }]);

      container.bootstrap();
      expect(container.get(tokenA)).toBe("from-set");
      expect(container.get(tokenB)).toBe("from-array");
    });
  });

  describe("error handling", () => {
    it("should throw on duplicate token provider", () => {
      const container = new NodeContainer();
      const token = new NodeToken("DUPLICATE");

      container.provide(token);
      expect(() => container.provide(token)).toThrow(InjectionError.duplicate(token));
    });

    it("should throw on duplicate multi-token provider", () => {
      const container = new NodeContainer();
      const token = new MultiNodeToken("DUPLICATE_MULTI");

      container.provide(token);
      expect(() => container.provide(token)).toThrow(InjectionError.duplicate(token));
    });

    it("should throw on duplicate decorated class", () => {
      const container = new NodeContainer();

      @NodeInjectable()
      class TestClass {
        public readonly value = "test-value";
      }

      container.provide(TestClass);
      expect(() => container.provide(TestClass)).toThrow();
    });

    it("should throw when providing after bootstrap", () => {
      const container = new NodeContainer();
      const token = new NodeToken("TOKEN");

      container.bootstrap();
      expect(() => container.provide(token)).toThrow(InjectionError.bootstrapped());
    });

    it("should throw on double bootstrap", () => {
      const container = new NodeContainer();

      container.bootstrap();
      expect(() => container.bootstrap()).toThrow(InjectionError.doubleBootstrap());
    });

    it("should throw when getting before bootstrap", () => {
      const container = new NodeContainer();
      const token = new NodeToken("TOKEN");

      expect(() => container.get(token)).toThrow(InjectionError.notBootstrapped());
    });

    it("should throw on undecorated class", () => {
      const container = new NodeContainer();

      class TestClass {
        public readonly value = "test-value";
      }

      expect(() => container.provide(TestClass)).toThrow(
        InjectionError.invalidCtor(TestClass),
      );
    });

    it("should throw on invalid provider", () => {
      const container = new NodeContainer();

      expect(() => container.provide({} as any)).toThrow(/Cannot use provider/);
    });

    it("should throw on invalid alias", () => {
      const container = new NodeContainer();
      const token = new NodeToken("TOKEN");

      expect(() =>
        container.provide({
          provide: token,
          alias: "invalid" as any,
        }),
      ).toThrow(InjectionError.invalidAlias("invalid"));
    });

    it("should throw on self-aliasing token", () => {
      const container = new NodeContainer();
      const token = new NodeToken("TOKEN");

      expect(() =>
        container.provide({
          provide: token,
          alias: token,
        }),
      ).toThrow(InjectionError.loopAlias(token));
    });

    it("should throw on getting invalid token", () => {
      const container = new NodeContainer();

      container.bootstrap();
      expect(() => container.get({} as any)).toThrow();
    });

    it("should throw on getting undecorated class", () => {
      const container = new NodeContainer();

      class TestClass {
        public readonly value = "test-value";
      }

      container.bootstrap();
      expect(() => container.get(TestClass)).toThrow(
        InjectionError.invalidCtor(TestClass),
      );
    });

    it("should throw on circular dependency", () => {
      const container = new NodeContainer();
      const tokenA = new NodeToken<string>("TOKEN_A");
      const tokenB = new NodeToken<string>("TOKEN_B");

      container.provide({
        provide: tokenA,
        factory: () => nodeInject<NodeToken<string>>(tokenB),
      });
      container.provide({
        provide: tokenB,
        factory: () => nodeInject<NodeToken<string>>(tokenA),
      });

      expect(() => container.bootstrap()).toThrow(
        InjectionError.circularDependency(tokenA, [tokenA, tokenB, tokenA]),
      );
    });

    it("should throw when required dependency is missing", () => {
      const container = new NodeContainer();
      const missing = new NodeToken<string>("MISSING");
      const target = new NodeToken<string>("TARGET");

      container.provide({
        provide: target,
        factory: () => nodeInject(missing),
      });

      expect(() => container.bootstrap()).toThrow(InjectionError.notFound(missing));
    });
  });

  describe("provider inheritance", () => {
    it("should inherit single value providers from parent container", () => {
      const parent = new NodeContainer();
      const child = new NodeContainer({ parent });
      const token = new NodeToken<string>("TOKEN");

      parent.provide({ provide: token, value: "parent-value" });

      parent.bootstrap();
      child.bootstrap();

      expect(child.get(token)).toBe("parent-value");
    });

    it("should inherit single class providers from parent container", () => {
      const parent = new NodeContainer();
      const child = new NodeContainer({ parent });
      const token = new NodeToken<{ value: string }>("TOKEN");

      class TestClass {
        public readonly value = "parent-class-value";
      }

      parent.provide({ provide: token, useClass: TestClass });

      parent.bootstrap();
      child.bootstrap();

      const instance = child.get(token);
      expect(instance).toBeInstanceOf(TestClass);
      expect(instance.value).toBe("parent-class-value");
    });

    it("should override parent providers in child container", () => {
      const parent = new NodeContainer();
      const child = new NodeContainer({ parent });
      const token = new NodeToken<string>("TOKEN");

      parent.provide({ provide: token, value: "parent-value" });
      child.provide({ provide: token, value: "child-value" });

      parent.bootstrap();
      child.bootstrap();

      expect(child.get(token)).toBe("child-value");
    });

    it("should inherit injectable class providers from parent container", () => {
      const parent = new NodeContainer();
      const child = new NodeContainer({ parent });

      @NodeInjectable()
      class TestClass {
        public readonly value = "parent-decorated-value";
      }

      parent.provide(TestClass);

      parent.bootstrap();
      child.bootstrap();

      const instance = child.get(TestClass);
      expect(instance).toBeInstanceOf(TestClass);
      expect(instance.value).toBe("parent-decorated-value");
    });

    it("should inherit multi-token providers from parent container", () => {
      const parent = new NodeContainer();
      const child = new NodeContainer({ parent });
      const token = new MultiNodeToken<string>("TOKEN");

      parent.provide({ provide: token, value: "parent-value-1" });
      parent.provide({ provide: token, value: "parent-value-2" });

      parent.bootstrap();
      child.bootstrap();

      expect(child.get(token)).toEqual(["parent-value-1", "parent-value-2"]);
    });

    it("should inherit aliased providers from parent container", () => {
      const parent = new NodeContainer();
      const child = new NodeContainer({ parent });
      const tokenA = new NodeToken<string>("TOKEN_A");
      const tokenB = new NodeToken<string>("TOKEN_B");

      parent.provide({ provide: tokenA, value: "aliased-value" });
      parent.provide({ provide: tokenB, alias: tokenA });

      parent.bootstrap();
      child.bootstrap();

      expect(child.get(tokenB)).toBe("aliased-value");
    });

    it("should merge parent multi-token providers to child container", () => {
      const parent = new NodeContainer();
      const child = new NodeContainer({ parent });
      const token = new MultiNodeToken<string>("TOKEN");

      parent.provide({ provide: token, value: "parent-value-1" });
      parent.provide({ provide: token, value: "parent-value-2" });

      child.provide({ provide: token, value: "child-value-1" });
      child.provide({ provide: token, value: "child-value-2" });

      parent.bootstrap();
      child.bootstrap();

      expect(child.get(token)).toEqual([
        "parent-value-1",
        "parent-value-2",
        "child-value-1",
        "child-value-2",
      ]);
    });

    it("should override parent providers in child container", () => {
      const parent = new NodeContainer();
      const child = new NodeContainer({ parent });
      const token = new NodeToken<string>("TOKEN");

      parent.provide({ provide: token, value: "parent-value" });
      child.provide({ provide: token, value: "child-value" });

      parent.bootstrap();
      child.bootstrap();

      expect(child.get(token)).toBe("child-value");
    });
  });

  describe("Performance measurement", () => {
    it("should measure performance when enabled", () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const container = new NodeContainer({ measurePerformance: true });
      container.bootstrap();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Bootstrapped in"));
      consoleSpy.mockRestore();
    });
  });

  describe("produce", () => {
    it("should instantiate a class with dependencies at runtime", () => {
      const container = new NodeContainer();

      @NodeInjectable()
      class DependencyService {
        public readonly value = "dependency-value";
      }

      @NodeInjectable()
      class RuntimeClass {
        public readonly dep = nodeInject(DependencyService);
        public readonly id = Math.random();
      }

      container.provide(DependencyService);
      container.bootstrap();

      const instance = container.produce(RuntimeClass);

      expect(instance).toBeInstanceOf(RuntimeClass);
      expect(instance.dep).toBeInstanceOf(DependencyService);
      expect(instance.dep.value).toBe("dependency-value");
    });

    it("should create new instances on each call", () => {
      const container = new NodeContainer();

      @NodeInjectable()
      class RuntimeClass {
        public readonly id = Math.random();
      }

      container.bootstrap();

      const instance1 = container.produce(RuntimeClass);
      const instance2 = container.produce(RuntimeClass);

      expect(instance1).toBeInstanceOf(RuntimeClass);
      expect(instance2).toBeInstanceOf(RuntimeClass);
      expect(instance1.id).not.toBe(instance2.id);
    });

    it("should not register class in container", () => {
      const container = new NodeContainer();

      @NodeInjectable()
      class RuntimeClass {
        public readonly value = "runtime";
      }

      container.bootstrap();

      container.produce(RuntimeClass);

      // Trying to get the class should throw since it was never provided
      expect(() => container.get(RuntimeClass)).toThrow(InjectionError);
    });

    it("should throw if called before bootstrap", () => {
      const container = new NodeContainer();

      @NodeInjectable()
      class RuntimeClass {
        public readonly value = "runtime";
      }

      expect(() => container.produce(RuntimeClass)).toThrow(InjectionError);
    });

    it("should throw for invalid constructor", () => {
      const container = new NodeContainer();

      class NotInjectable {
        public readonly value = "not-injectable";
      }

      container.bootstrap();

      expect(() => container.produce(NotInjectable as any)).toThrow(InjectionError);
    });

    it("should work with complex dependency chains", () => {
      const container = new NodeContainer();

      @NodeInjectable()
      class ServiceA {
        public readonly name = "A";
      }

      @NodeInjectable()
      class ServiceB {
        public readonly dep = nodeInject(ServiceA);
        public readonly name = "B";
      }

      @NodeInjectable()
      class ServiceC {
        public readonly depB = nodeInject(ServiceB);
        public readonly name = "C";
      }

      @NodeInjectable()
      class RuntimeClass {
        public readonly serviceC = nodeInject(ServiceC);
      }

      container.provide(ServiceA);
      container.provide(ServiceB);
      container.provide(ServiceC);
      container.bootstrap();

      const instance = container.produce(RuntimeClass);

      expect(instance.serviceC).toBeInstanceOf(ServiceC);
      expect(instance.serviceC.name).toBe("C");
      expect(instance.serviceC.depB).toBeInstanceOf(ServiceB);
      expect(instance.serviceC.depB.name).toBe("B");
      expect(instance.serviceC.depB.dep).toBeInstanceOf(ServiceA);
      expect(instance.serviceC.depB.dep.name).toBe("A");
    });

    it("should share singleton instances with container", () => {
      const container = new NodeContainer();

      @NodeInjectable()
      class SingletonService {
        public readonly id = Math.random();
      }

      @NodeInjectable()
      class RuntimeClass {
        public readonly singleton = nodeInject(SingletonService);
      }

      container.provide(SingletonService);
      container.bootstrap();

      const containerInstance = container.get(SingletonService);
      const runtime1 = container.produce(RuntimeClass);
      const runtime2 = container.produce(RuntimeClass);

      // All should reference the same singleton
      expect(runtime1.singleton.id).toBe(containerInstance.id);
      expect(runtime2.singleton.id).toBe(containerInstance.id);
    });

    it("should work with token-based dependencies", () => {
      const container = new NodeContainer();
      const configToken = new NodeToken<{ apiKey: string }>("Config");
      const loggerToken = new NodeToken<{ log: (msg: string) => void }>("Logger");

      @NodeInjectable()
      class RuntimeClass {
        public readonly config = nodeInject(configToken);
        public readonly logger = nodeInject(loggerToken);
      }

      container.provide({
        provide: configToken,
        value: { apiKey: "test-key" },
      });

      container.provide({
        provide: loggerToken,
        factory: () => ({ log: (msg: string) => msg }),
      });

      container.bootstrap();

      const instance = container.produce(RuntimeClass);

      expect(instance.config.apiKey).toBe("test-key");
      expect(instance.logger.log("test")).toBe("test");
    });

    it("should work with optional dependencies", () => {
      const container = new NodeContainer();
      const optionalToken = new NodeToken<string>("Optional");
      const requiredToken = new NodeToken<string>("Required");

      @NodeInjectable()
      class RuntimeClass {
        public readonly optional = nodeInject(optionalToken, { optional: true });
        public readonly required = nodeInject(requiredToken);
      }

      container.provide({
        provide: requiredToken,
        value: "required-value",
      });

      container.bootstrap();

      const instance = container.produce(RuntimeClass);

      expect(instance.optional).toBeNull();
      expect(instance.required).toBe("required-value");
    });

    it("should throw when required dependency is missing", () => {
      const container = new NodeContainer();

      @NodeInjectable()
      class MissingService {
        public readonly value = "missing";
      }

      @NodeInjectable()
      class RuntimeClass {
        public readonly dep = nodeInject(MissingService);
      }

      container.bootstrap();

      expect(() => container.produce(RuntimeClass)).toThrow(InjectionError);
    });

    it("should work with multi-token dependencies", () => {
      const container = new NodeContainer();
      const pluginToken = new MultiNodeToken<{ name: string }>("Plugin");

      @NodeInjectable()
      class RuntimeClass {
        public readonly plugins = nodeInject(pluginToken);
      }

      container.provide({
        provide: pluginToken,
        value: { name: "plugin-1" },
      });

      container.provide({
        provide: pluginToken,
        value: { name: "plugin-2" },
      });

      container.bootstrap();

      const instance = container.produce(RuntimeClass);

      expect(instance.plugins).toHaveLength(2);
      expect(instance.plugins[0].name).toBe("plugin-1");
      expect(instance.plugins[1].name).toBe("plugin-2");
    });

    it("should allow producing classes with constructor parameters", () => {
      const container = new NodeContainer();

      @NodeInjectable()
      class DependencyService {
        public readonly value = "dependency";
      }

      @NodeInjectable()
      class RuntimeClass {
        public readonly dep = nodeInject(DependencyService);
        public readonly custom: string;

        constructor() {
          this.custom = "custom-value";
        }
      }

      container.provide(DependencyService);
      container.bootstrap();

      const instance = container.produce(RuntimeClass);

      expect(instance.dep.value).toBe("dependency");
      expect(instance.custom).toBe("custom-value");
    });
  });
});
