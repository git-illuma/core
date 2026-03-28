import { describe, expect, it } from "vitest";
import { MultiNodeToken, NodeInjectable, NodeToken, nodeInject } from "./api";
import { NodeContainer } from "./container";
import { InjectionError } from "./errors";

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
    expect(() => container.get(TestClass)).toThrow(InjectionError.invalidCtor(TestClass));
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
