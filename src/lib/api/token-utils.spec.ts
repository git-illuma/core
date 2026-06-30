import { describe, expect, it } from "vitest";
import { ERR_CODES, InjectionError } from "../errors";
import type { Token } from "../provider/types";
import { NodeInjectable } from "./decorator";
import { MultiNodeToken, NodeToken } from "./token";
import { extractToken, isNodeBase } from "./token-utils";

describe("Token Utils", () => {
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
      @NodeInjectable()
      class TestClass {}
      expect(extractToken(TestClass)).toBeInstanceOf(NodeToken);
    });

    it("should throw if provider is invalid", () => {
      expect(() => extractToken({} as Token<unknown>)).toThrow(InjectionError);
    });

    it("should throw invalid alias error if isAlias is true", () => {
      expect(() => extractToken({} as Token<unknown>, true)).toThrow(InjectionError);
    });
  });
});

describe("extractToken alias target error (#35)", () => {
  it("throws invalidAlias (i200) for a non-injectable function used as an alias target", () => {
    function NotInjectable() {}

    let code: number | undefined;
    try {
      extractToken(NotInjectable as unknown as Token<unknown>, true);
    } catch (e) {
      code = (e as InjectionError).code;
    }
    expect(code).toBe(ERR_CODES.INVALID_ALIAS);
  });

  it("still throws invalidCtor (i102) for a non-injectable function NOT used as an alias", () => {
    function NotInjectable() {}

    let code: number | undefined;
    try {
      extractToken(NotInjectable as unknown as Token<unknown>);
    } catch (e) {
      code = (e as InjectionError).code;
    }
    expect(code).toBe(ERR_CODES.INVALID_CTOR);
  });
});
