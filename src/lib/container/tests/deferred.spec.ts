import { describe, expect, it, vi } from "vitest";
import { MultiNodeToken, NodeInjectable, NodeToken, nodeInject } from "../../api";
import { InjectionError } from "../../errors";
import { NodeContainer } from "../container";

describe("deferred instantiation", () => {
  const params = { instant: false };

  it("should defer instantiation until first get", () => {
    const container = new NodeContainer(params);
    const token = new NodeToken<number>("TOKEN");
    const tFactorySpy = vi.fn(() => 42);

    container.provide(token.withFactory(tFactorySpy));

    // Dry run
    expect(tFactorySpy).toHaveBeenCalledTimes(1);

    container.bootstrap();
    // Still not called
    expect(tFactorySpy).toHaveBeenCalledTimes(1);

    const value = container.get(token);
    expect(value).toBe(42);
    // Actually constructed now
    expect(tFactorySpy).toHaveBeenCalledTimes(2);

    const value2 = container.get(token);
    expect(value2).toBe(42);
    // Still only called once more
    expect(tFactorySpy).toHaveBeenCalledTimes(2);
  });

  it("should defer instantiation of dependencies", () => {
    const container = new NodeContainer(params);
    const tokenA = new NodeToken<number>("TOKEN_A");
    const tokenB = new NodeToken<number>("TOKEN_B");
    const factoryASpy = vi.fn(() => 7);
    const factoryBSpy = vi.fn(() => {
      const a = nodeInject(tokenA);
      return a * 3;
    });

    container.provide(tokenA.withFactory(factoryASpy));
    container.provide(tokenB.withFactory(factoryBSpy));

    // Dry run
    expect(factoryASpy).toHaveBeenCalledTimes(1);
    expect(factoryBSpy).toHaveBeenCalledTimes(1);

    container.bootstrap();
    // Still not called
    expect(factoryASpy).toHaveBeenCalledTimes(1);
    expect(factoryBSpy).toHaveBeenCalledTimes(1);

    const valueB = container.get(tokenB);
    expect(valueB).toBe(21);
    // Both factories called now
    expect(factoryASpy).toHaveBeenCalledTimes(2);
    expect(factoryBSpy).toHaveBeenCalledTimes(2);

    const valueA = container.get(tokenA);
    expect(valueA).toBe(7);
    // Token A factory not called again
    expect(factoryASpy).toHaveBeenCalledTimes(2);
    expect(factoryBSpy).toHaveBeenCalledTimes(2);
  });

  it("should defer instantiation in injectable classes", () => {
    const container = new NodeContainer(params);
    const token = new NodeToken<string>("TOKEN");
    const factorySpy = vi.fn(() => "deferred-value");

    @NodeInjectable()
    class TestClass {
      public readonly value = nodeInject(token);
    }

    container.provide(TestClass);
    container.provide(token.withFactory(factorySpy));

    // Dry run
    expect(factorySpy).toHaveBeenCalledTimes(1);

    container.bootstrap();
    // Still not called
    expect(factorySpy).toHaveBeenCalledTimes(1);

    const instance = container.get(TestClass);
    expect(instance.value).toBe("deferred-value");
    // Factory called now
    expect(factorySpy).toHaveBeenCalledTimes(2);
  });

  it("should retrieve optional dependencies as null", () => {
    const container = new NodeContainer(params);
    const token = new NodeToken<string>("TOKEN");

    @NodeInjectable()
    class TestClass {
      public readonly value = nodeInject(token, { optional: true });
    }

    container.provide(TestClass);
    container.bootstrap();
    const instance = container.get(TestClass);
    expect(instance.value).toBeNull();
  });

  it("should work fine when retrieving from the middle of a dependency chain", () => {
    const container = new NodeContainer(params);
    const tokenA = new NodeToken<string>("TOKEN_A");
    const tokenB = new NodeToken<string>("TOKEN_B");

    const factoryASpy = vi.fn(() => "value-a");
    const factoryBSpy = vi.fn(() => {
      const a = nodeInject(tokenA);
      return `value-b-depends-on-${a}`;
    });

    const classSpy = vi.fn();
    @NodeInjectable()
    class MainService {
      public readonly depB = nodeInject(tokenB);
      constructor() {
        classSpy();
      }
    }

    container.provide(MainService);
    container.provide(tokenA.withFactory(factoryASpy));
    container.provide(tokenB.withFactory(factoryBSpy));

    // Dry run
    expect(factoryASpy).toHaveBeenCalledTimes(1);
    expect(factoryBSpy).toHaveBeenCalledTimes(1);
    expect(classSpy).toHaveBeenCalledTimes(1);

    container.bootstrap();
    // Still not called
    expect(factoryASpy).toHaveBeenCalledTimes(1);
    expect(factoryBSpy).toHaveBeenCalledTimes(1);
    expect(classSpy).toHaveBeenCalledTimes(1);

    const instance = container.get(tokenB);
    expect(instance).toBe("value-b-depends-on-value-a");

    // Both factories called now
    expect(factoryASpy).toHaveBeenCalledTimes(2);
    expect(factoryBSpy).toHaveBeenCalledTimes(2);
    expect(classSpy).toHaveBeenCalledTimes(1);
  });

  it("should work with produce()", () => {
    const container = new NodeContainer(params);
    const token = new NodeToken<string>("TOKEN");
    const factorySpy = vi.fn(() => "deferred-value");

    container.provide(token.withFactory(factorySpy));
    container.bootstrap();

    // Still not called
    expect(factorySpy).toHaveBeenCalledTimes(1);

    const instance = container.produce(() => {
      return { value: nodeInject(token) };
    });

    expect(instance.value).toBe("deferred-value");
    // Factory called now
    expect(factorySpy).toHaveBeenCalledTimes(2);
  });

  it("should handle multi nodes in produce() within injectable class", () => {
    const container = new NodeContainer(params);
    const token = new MultiNodeToken<string>("TOKEN");
    const factorySpy1 = vi.fn(() => "deferred-value-1");
    const factorySpy2 = vi.fn(() => "deferred-value-2");

    @NodeInjectable()
    class TestClass {
      public readonly values = container.produce(() => {
        return nodeInject(token);
      });
    }

    container.provide(TestClass);
    container.provide(token.withFactory(factorySpy1));
    container.provide(token.withFactory(factorySpy2));

    // Dry run
    expect(factorySpy1).toHaveBeenCalledTimes(1);
    expect(factorySpy2).toHaveBeenCalledTimes(1);

    container.bootstrap();

    // Still not called
    expect(factorySpy1).toHaveBeenCalledTimes(1);
    expect(factorySpy2).toHaveBeenCalledTimes(1);

    const instance = container.get(TestClass);
    expect(instance.values).toEqual(["deferred-value-1", "deferred-value-2"]);
    // Both factories called now
    expect(factorySpy1).toHaveBeenCalledTimes(2);
    expect(factorySpy2).toHaveBeenCalledTimes(2);
  });

  it("should throw on circular dependencies", () => {
    const container = new NodeContainer(params);
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

  it("should work with parent containers", () => {
    const parent = new NodeContainer(params);
    const child = new NodeContainer({ parent, ...params });
    const token = new NodeToken<string>("TOKEN");
    const factorySpy = vi.fn(() => "deferred-value");

    parent.provide(token.withFactory(factorySpy));

    // Dry run
    expect(factorySpy).toHaveBeenCalledTimes(1);

    parent.bootstrap();
    child.bootstrap();
    // Still not called
    expect(factorySpy).toHaveBeenCalledTimes(1);

    const value = child.get(token);
    expect(value).toBe("deferred-value");
    // Actually constructed now
    expect(factorySpy).toHaveBeenCalledTimes(2);
  });

  it("should work with multi-token providers", () => {
    const container = new NodeContainer(params);
    const token = new MultiNodeToken<string>("TOKEN");
    const factorySpy1 = vi.fn(() => "deferred-value-1");
    const factorySpy2 = vi.fn(() => "deferred-value-2");

    container.provide(token.withFactory(factorySpy1));
    container.provide(token.withFactory(factorySpy2));

    // Dry run
    expect(factorySpy1).toHaveBeenCalledTimes(1);
    expect(factorySpy2).toHaveBeenCalledTimes(1);

    container.bootstrap();
    // Still not called
    expect(factorySpy1).toHaveBeenCalledTimes(1);
    expect(factorySpy2).toHaveBeenCalledTimes(1);

    const values = container.get(token);
    expect(values).toEqual(["deferred-value-1", "deferred-value-2"]);
    // Both factories called now
    expect(factorySpy1).toHaveBeenCalledTimes(2);
    expect(factorySpy2).toHaveBeenCalledTimes(2);
  });

  it("should work with alias providers", () => {
    const container = new NodeContainer(params);
    const tokenA = new NodeToken<string>("TOKEN_A");
    const tokenB = new NodeToken<string>("TOKEN_B");
    const factorySpy = vi.fn(() => "deferred-value");

    container.provide(tokenA.withFactory(factorySpy));
    container.provide({ provide: tokenB, alias: tokenA });

    // Dry run
    expect(factorySpy).toHaveBeenCalledTimes(1);

    container.bootstrap();
    // Still not called
    expect(factorySpy).toHaveBeenCalledTimes(1);

    const value = container.get(tokenB);
    expect(value).toBe("deferred-value");
    // Actually constructed now
    expect(factorySpy).toHaveBeenCalledTimes(2);
  });

  it("should work with optional dependencies", () => {
    const container = new NodeContainer(params);
    const token = new NodeToken<string>("TOKEN");

    @NodeInjectable()
    class TestClass {
      public readonly value = nodeInject(token, { optional: true });
    }

    container.provide(TestClass);
    container.bootstrap();

    const instance = container.get(TestClass);
    expect(instance.value).toBeNull();
  });

  it("should work with anonymous classes", () => {
    const container = new NodeContainer(params);
    const token = new NodeToken<string>("TOKEN");
    const classToken = new NodeToken<any>("ANONYMOUS_CLASS");

    const TestClass = class {
      public readonly value = nodeInject(token);
    };

    container.provide(token.withValue("hello"));
    container.provide(classToken.withClass(TestClass));
    container.bootstrap();

    const instance = container.get(classToken);
    expect(instance.value).toBe("hello");
  });

  it("should work with class factories", () => {
    const container = new NodeContainer(params);
    const token = new MultiNodeToken<string>("TOKEN");
    const classToken = new NodeToken<BaseClass>("BASE_CLASS");

    abstract class BaseClass {
      constructor(public readonly value: string[]) {}
      public getValues(): string[] {
        return this.value;
      }
    }

    const factory = (t: MultiNodeToken<string>) => {
      return class extends BaseClass {
        constructor() {
          super(nodeInject(t));
        }
      };
    };

    container.provide(token.withFactory(() => "value-1"));
    container.provide(token.withFactory(() => "value-2"));
    container.provide(classToken.withClass(factory(token)));

    container.bootstrap();

    const instance = container.get(classToken);
    expect(instance).toBeInstanceOf(BaseClass);
    expect(instance.getValues()).toEqual(["value-1", "value-2"]);
  });
});
