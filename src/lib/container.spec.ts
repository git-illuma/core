import { NodeContainer } from "./container";
import { INJECTION_SYMBOL, NodeInjectable, makeInjectable } from "./decorator";
import { InjectionError } from "./errors";
import { createProviderSet } from "./helpers";
import { nodeInject } from "./injector";
import { MultiNodeToken, NodeToken } from "./token";

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
      expect(() => container.provide(TestClass)).toThrow();
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

  describe("provider sets", () => {
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
});
