import { describe, expect, it } from "vitest";
import { MultiNodeToken, NodeInjectable, NodeToken, nodeInject } from "../../api";
import { NodeContainer } from "../container";

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
