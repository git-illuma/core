import { describe, expect, it } from "vitest";
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
