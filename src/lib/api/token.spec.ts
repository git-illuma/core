import { describe, expect, it } from "vitest";
import { ERR_CODES, InjectionError } from "../errors";
import { MultiNodeToken, NodeBase, NodeToken } from "./token";

describe("Token", () => {
  describe("provider helpers", () => {
    it("should create value provider with withValue", () => {
      const token = new NodeToken("test");
      const value = "test value";
      const provider = token.withValue(value);
      expect(provider).toEqual({
        provide: token,
        value,
      });
    });

    it("should create factory provider with withFactory", () => {
      const token = new NodeToken<string>("test");
      const factory = () => "test value";
      const provider = token.withFactory(factory);
      expect(provider).toEqual({
        provide: token,
        factory,
      });
    });

    it("should create class provider with withClass", () => {
      const token = new NodeToken<TestClass>("test");
      class TestClass {
        value = "test";
      }
      const provider = token.withClass(TestClass);
      expect(provider).toEqual({
        provide: token,
        useClass: TestClass,
      });
    });

    it("should create alias provider with withAlias", () => {
      const token = new NodeToken<string>("test");
      const aliasToken = new NodeToken<string>("alias");
      const provider = token.withAlias(aliasToken);
      expect(provider).toEqual({
        provide: token,
        alias: aliasToken,
      });
    });

    it("should implement provider with implement (value)", () => {
      const token = new NodeToken<string>("test");
      const provider = token.implement({ value: "test value" });
      expect(provider).toEqual({
        provide: token,
        value: "test value",
      });
    });

    it("should implement provider with implement (factory)", () => {
      const token = new NodeToken<string>("test");
      const factory = () => "test value";
      const provider = token.implement({ factory });
      expect(provider).toEqual({
        provide: token,
        factory,
      });
    });

    it("should implement provider with implement (class)", () => {
      const token = new NodeToken<TestClass>("test");
      class TestClass {
        value = "test";
      }
      const provider = token.implement({ useClass: TestClass });
      expect(provider).toEqual({
        provide: token,
        useClass: TestClass,
      });
    });

    it("should implement provider with implement (alias)", () => {
      const token = new NodeToken<string>("test");
      const aliasToken = new NodeToken<string>("alias");
      const provider = token.implement({ alias: aliasToken });
      expect(provider).toEqual({
        provide: token,
        alias: aliasToken,
      });
    });
  });

  describe("NodeToken", () => {
    it("should return correct toString", () => {
      const token = new NodeToken("test");
      expect(token.toString()).toBe("NodeToken[test]");
    });
  });

  describe("MultiNodeToken", () => {
    it("should return correct toString", () => {
      const token = new MultiNodeToken("test");
      expect(token.toString()).toBe("MultiNodeToken[test]");
    });

    describe("provider helpers", () => {
      it("should create value provider with withValue", () => {
        const token = new MultiNodeToken<string>("test");
        const value = "test value";
        const provider = token.withValue(value);
        expect(provider).toEqual({
          provide: token,
          value,
        });
      });

      it("should create factory provider with withFactory", () => {
        const token = new MultiNodeToken<string>("test");
        const factory = () => "test value";
        const provider = token.withFactory(factory);
        expect(provider).toEqual({
          provide: token,
          factory,
        });
      });

      it("should create class provider with withClass", () => {
        const token = new MultiNodeToken<TestClass>("test");
        class TestClass {
          value = "test";
        }
        const provider = token.withClass(TestClass);
        expect(provider).toEqual({
          provide: token,
          useClass: TestClass,
        });
      });

      it("should create alias provider with withAlias", () => {
        const token = new MultiNodeToken<string>("test");
        const aliasToken = new NodeToken<string>("alias");
        const provider = token.withAlias(aliasToken);
        expect(provider).toEqual({
          provide: token,
          alias: aliasToken,
        });
      });

      it("should implement provider with implement (value)", () => {
        const token = new MultiNodeToken<string>("test");
        const provider = token.implement({ value: "test value" });
        expect(provider).toEqual({
          provide: token,
          value: "test value",
        });
      });

      it("should implement provider with implement (factory)", () => {
        const token = new MultiNodeToken<string>("test");
        const factory = () => "test value";
        const provider = token.implement({ factory });
        expect(provider).toEqual({
          provide: token,
          factory,
        });
      });

      it("should implement provider with implement (class)", () => {
        const token = new MultiNodeToken<TestClass>("test");
        class TestClass {
          value = "test";
        }
        const provider = token.implement({ useClass: TestClass });
        expect(provider).toEqual({
          provide: token,
          useClass: TestClass,
        });
      });

      it("should implement provider with implement (alias)", () => {
        const token = new MultiNodeToken<string>("test");
        const aliasToken = new NodeToken<string>("alias");
        const provider = token.implement({ alias: aliasToken });
        expect(provider).toEqual({
          provide: token,
          alias: aliasToken,
        });
      });
    });
  });

  describe("toString", () => {
    it("should return correct token string", () => {
      const t = new NodeToken("myToooooken");
      expect(t.toString()).toBe("NodeToken[myToooooken]");
    });

    it("should return correct multi token string", () => {
      const t = new MultiNodeToken("myMultiToken");
      expect(t.toString()).toBe("MultiNodeToken[myMultiToken]");
    });

    it("should return base token string", () => {
      class CustomToken extends NodeBase<unknown> {
        public multi = false as const;
      }
      const t = new CustomToken("custom");
      expect(t.toString()).toBe("Token[custom]");
    });
  });
});

describe("global tokens", () => {
  it("dedupes a single token by name so independent constructions are identical", () => {
    const a = new NodeToken("seam.alpha", { global: true });
    const b = new NodeToken("seam.alpha", { global: true });
    expect(b).toBe(a);
  });

  it("dedupes multi tokens too", () => {
    const a = new MultiNodeToken("seam.beta", { global: true });
    const b = new MultiNodeToken("seam.beta", { global: true });
    expect(b).toBe(a);
  });

  it("leaves non-global tokens as distinct instances", () => {
    expect(new NodeToken("seam.gamma")).not.toBe(new NodeToken("seam.gamma"));
  });

  it("keeps a non-global token independent of a same-named global one", () => {
    const g = new NodeToken("seam.delta", { global: true });
    expect(new NodeToken("seam.delta")).not.toBe(g);
  });

  it("throws when a name is reused for a different token kind", () => {
    new NodeToken("seam.epsilon", { global: true });

    let err: unknown;
    try {
      new MultiNodeToken("seam.epsilon", { global: true });
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(InjectionError);
    expect((err as InjectionError).code).toBe(ERR_CODES.GLOBAL_TOKEN_CONFLICT);
    expect((err as InjectionError).message).toMatch(/already registered/);
  });

  it("the first registration's options win for the shared instance", () => {
    const factory = () => "x";
    const a = new NodeToken<string>("seam.zeta", { global: true, factory });
    const b = new NodeToken<string>("seam.zeta", { global: true });
    expect(b).toBe(a);
    expect(b.opts?.factory).toBe(factory);
  });
});
