import { describe, expect, it } from "vitest";
import { InjectionError } from "../errors";
import type { Token } from "../provider/types";
import { INJECTION_SYMBOL } from "./decorator";
import { extractToken, isNodeBase, MultiNodeToken, NodeBase, NodeToken } from "./token";

describe("Token", () => {
  describe("NodeBase", () => {
    it("should create with name and options", () => {
      const opts = { factory: () => "test" };
      const token = new NodeBase("test", opts);
      expect(token.name).toBe("test");
      expect(token.opts).toBe(opts);
    });

    it("should return correct toString", () => {
      const token = new NodeBase("test");
      expect(token.toString()).toBe("Token[test]");
    });

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
    });
  });

  describe("isNodeBase", () => {
    it("should return true for NodeToken", () => {
      expect(isNodeBase(new NodeToken("test"))).toBe(true);
    });

    it("should return true for MultiNodeToken", () => {
      expect(isNodeBase(new MultiNodeToken("test"))).toBe(true);
    });

    it("should return false for other values", () => {
      expect(isNodeBase({})).toBe(false);
      expect(isNodeBase("test")).toBe(false);
      expect(isNodeBase(null)).toBe(false);
    });
  });

  describe("extractToken", () => {
    it("should return token if provider is token", () => {
      const token = new NodeToken("test");
      expect(extractToken(token)).toBe(token);
    });

    it("should extract token from decorated class", () => {
      const token = new NodeToken("test");
      class TestClass {}
      (TestClass as any)[INJECTION_SYMBOL] = token;
      expect(extractToken(TestClass)).toBe(token);
    });

    it("should throw if provider is invalid", () => {
      expect(() => extractToken({} as Token<unknown>)).toThrow(InjectionError);
    });

    it("should throw invalid alias error if isAlias is true", () => {
      expect(() => extractToken({} as Token<unknown>, true)).toThrow(InjectionError);
    });

    it("should throw on invalid token in class", () => {
      class TestClass {}
      (TestClass as any)[INJECTION_SYMBOL] = "invalid";
      expect(() => extractToken(TestClass)).toThrow(InjectionError);
    });
  });
});
