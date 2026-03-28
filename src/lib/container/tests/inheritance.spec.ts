import { describe, expect, it } from "vitest";
import { MultiNodeToken, NodeInjectable, NodeToken } from "../../api";
import { NodeContainer } from "../container";

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
