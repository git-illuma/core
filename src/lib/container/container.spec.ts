import { describe, expect, it, vi } from "vitest";
import {
  extractToken,
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
    it("should provide with arrow factory", () => {
      const container = new NodeContainer();
      const token = new NodeToken("plainToken");

      container.provide({
        provide: token,
        factory: () => "value",
      });

      container.bootstrap();
      expect(container.get(token)).toBe("value");
    });

    it("should provide with named factory", () => {
      const container = new NodeContainer();
      const token = new NodeToken("plainToken");

      function create() {
        return "value";
      }

      container.provide({
        provide: token,
        factory: create,
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

    it("should prefer token factory for decorated class", () => {
      const container = new NodeContainer();
      const spyFn = vi.fn(() => ({ value: "from-factory" }));

      @NodeInjectable()
      class TestClass {
        public readonly value = "class-value";
      }

      const t = extractToken(TestClass);
      if (!t.opts) throw new Error("Token options missing");
      (t.opts.factory as any) = spyFn;

      container.provide(TestClass);

      container.bootstrap();

      const instance = container.get(TestClass);
      expect(spyFn).toHaveBeenCalled();
      expect(instance.value).toBe("from-factory");
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
      const instance2 = container.get(AliasedClass);
      expect(instance).toBeInstanceOf(AliasedClass);
      expect(instance.value).toBe("aliased-value");
      expect(instance).toBe(instance2);
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

      @NodeInjectable()
      class TestClass {
        public readonly injected = nodeInject(token);
      }

      container.provide(TestClass);

      container.bootstrap();
      expect(container.get(token)).toEqual([]);

      const instance = container.get(TestClass);
      expect(instance.injected).toEqual([]);
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
});
