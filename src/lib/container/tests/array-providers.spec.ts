import { describe, expect, it } from "vitest";
import { MultiNodeToken, NodeInjectable, NodeToken, nodeInject } from "../../api";
import { NodeContainer } from "../container";

describe("array providers", () => {
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
});
