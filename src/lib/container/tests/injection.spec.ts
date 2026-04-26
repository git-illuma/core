import { describe, expect, it } from "vitest";
import { MultiNodeToken, NodeInjectable, NodeToken, nodeInject } from "../../api";
import { ERR_CODES, InjectionError } from "../../errors";
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

  it("should throw CONFLICTING_STRATEGIES when self and skipSelf are used together", () => {
    const TokenA = new NodeToken<string>("TokenA");
    const DummyToken = new NodeToken<string>("Dummy");

    const container = new NodeContainer();
    container.provide({
      provide: TokenA,
      factory: () => nodeInject(DummyToken, { self: true, skipSelf: true }),
    });

    expect(() => container.bootstrap()).toThrowError(InjectionError);
    try {
      container.bootstrap();
    } catch (e: any) {
      expect(e.code).toBe(ERR_CODES.CONFLICTING_STRATEGIES);
    }
  });

  it("should restrict resolution to local container when using self: true", () => {
    const TokenA = new NodeToken<string>("TokenA");
    const TokenB = new NodeToken<string>("TokenB");

    const parent = new NodeContainer();
    parent.provide(TokenA.withValue("parent-value"));
    parent.bootstrap();

    const child = new NodeContainer({ parent });
    child.provide(
      TokenB.withFactory(
        () => nodeInject(TokenA, { self: true, optional: true }) as string,
      ),
    );
    child.bootstrap();

    expect(child.get(TokenB)).toBe(null);
  });

  it("should bypass local container and resolve from parent when using skipSelf: true", () => {
    const TokenA = new NodeToken<string>("TokenA");
    const TokenB = new NodeToken<string>("TokenB");

    const parent = new NodeContainer();
    parent.provide(TokenA.withValue("parent-value"));
    parent.bootstrap();

    const child = new NodeContainer({ parent });
    child.provide(TokenA.withValue("child-value"));
    child.provide(TokenB.withFactory(() => nodeInject(TokenA, { skipSelf: true })));
    child.bootstrap();

    expect(child.get(TokenB)).toBe("parent-value");
  });

  it("should fail validation if skipSelf is true but parent doesn't have it (even if local does)", () => {
    const TokenA = new NodeToken<string>("TokenA");
    const TokenB = new NodeToken<string>("TokenB");

    const parent = new NodeContainer();
    parent.bootstrap();

    const child = new NodeContainer({ parent });
    child.provide(TokenA.withValue("child-value"));
    child.provide(TokenB.withFactory(() => nodeInject(TokenA, { skipSelf: true })));

    let errorCode: number | undefined;
    try {
      child.bootstrap();
    } catch (err: any) {
      errorCode = err.code;
    }
    expect(errorCode).toBe(ERR_CODES.NOT_FOUND);
  });

  it("should respect self and skipSelf correctly inside container.produce() via dynamic InjectorFn", () => {
    const TokenA = new NodeToken<string>("TokenA");

    const parent = new NodeContainer();
    parent.provide({ provide: TokenA, value: "parent-value" });
    parent.bootstrap();

    const child = new NodeContainer({ parent });
    child.provide({ provide: TokenA, value: "child-value" });
    child.bootstrap();

    const normal = child.produce(() => nodeInject(TokenA));
    expect(normal).toBe("child-value");

    const skipped = child.produce(() => nodeInject(TokenA, { skipSelf: true }));
    expect(skipped).toBe("parent-value");

    const selfVal = child.produce(() => nodeInject(TokenA, { self: true }));
    expect(selfVal).toBe("child-value");

    const missingParentSkipSelf = child.produce(() =>
      nodeInject(new NodeToken("Dummy"), { skipSelf: true, optional: true }),
    );
    expect(missingParentSkipSelf).toBe(null);

    const missingLocalSelf = child.produce(() => {
      const dummy = new NodeToken("Dummy");
      return nodeInject(dummy, { self: true, optional: true });
    });
    expect(missingLocalSelf).toBe(null);
  });
});
