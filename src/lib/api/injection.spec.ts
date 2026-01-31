import { afterEach, describe, expect, it, vi } from "vitest";
import { NodeContainer } from "../container/container";
import { InjectionContext } from "../context";
import { InjectionError } from "../errors";
import { getInjectableToken, NodeInjectable } from "./decorator";
import { nodeInject } from "./injection";
import { SHAPE_SHIFTER } from "./proxy";
import { MultiNodeToken, NodeToken } from "./token";

describe("nodeInject", () => {
  afterEach(() => {
    InjectionContext.closeAndReport();
  });

  describe("Context validation", () => {
    it("should throw error when called outside injection context", () => {
      const token = new NodeToken<string>("TestToken");

      expect(() => nodeInject(token)).toThrow(InjectionError);
      expect(() => nodeInject(token)).toThrow(
        /Cannot inject "NodeToken\[TestToken\]" outside of an injection context/,
      );
    });

    it("should work when injection context is open", () => {
      const token = new NodeToken<string>("TestToken");
      InjectionContext.open();

      const result = nodeInject(token);

      expect(result).toBe(SHAPE_SHIFTER);
      const calls = InjectionContext.closeAndReport();
      expect(calls.size).toBe(1);
      expect(Array.from(calls)[0].token).toBe(token);
    });
  });

  describe("Token validation", () => {
    it("should throw error for invalid provider (not a token)", () => {
      InjectionContext.open();
      const invalidProvider = "not a token" as any;

      expect(() => nodeInject(invalidProvider)).toThrow(InjectionError);
      expect(() => nodeInject(invalidProvider)).toThrow(
        /Cannot use provider as it is neither a NodeToken nor MultiNodeToken/,
      );
    });

    it("should accept class decorated with @NodeInjectable", () => {
      @NodeInjectable()
      class TestService {}

      InjectionContext.open();

      nodeInject(TestService);
      const token = getInjectableToken(TestService);

      const calls = InjectionContext.closeAndReport();
      expect(calls.size).toBe(1);
      expect(Array.from(calls)[0].token).toBe(token);
    });

    it("should throw error for undecorated class", () => {
      class UnDecoratedService {}

      InjectionContext.open();

      expect(() => nodeInject(UnDecoratedService as any)).toThrow(InjectionError);
      expect(() => nodeInject(UnDecoratedService as any)).toThrow(
        /Cannot use provider as it is neither a NodeToken nor MultiNodeToken/,
      );
    });
  });

  describe("InjectionNode registration", () => {
    it("should register injection call in context", () => {
      const token = new NodeToken<string>("TestToken");
      InjectionContext.open();

      nodeInject(token);

      const calls = InjectionContext.closeAndReport();
      expect(calls.size).toBe(1);
      const [call] = Array.from(calls);
      expect(call.token).toBe(token);
    });

    it("should register multiple injection calls", () => {
      const token1 = new NodeToken<string>("Token1");
      const token2 = new NodeToken<number>("Token2");
      const token3 = new MultiNodeToken<boolean>("Token3");

      InjectionContext.open();

      nodeInject(token1);
      nodeInject(token2);
      nodeInject(token3);

      const calls = InjectionContext.closeAndReport();
      expect(calls.size).toBe(3);
    });

    it("should register same token multiple times", () => {
      const token = new NodeToken<string>("TestToken");
      InjectionContext.open();

      nodeInject(token);
      nodeInject(token);
      nodeInject(token);

      const calls = InjectionContext.closeAndReport();
      expect(calls.size).toBe(3);
    });
  });

  describe("Optional parameter", () => {
    it("should create InjectionNode with optional=true when specified", () => {
      const token = new NodeToken<string>("TestToken");
      InjectionContext.open();

      const result = nodeInject(token, { optional: true });
      const calls = InjectionContext.closeAndReport();

      expect(result).toBe(SHAPE_SHIFTER);
      expect(calls.size).toBe(1);
      expect(Array.from(calls)[0].optional).toBe(true);
    });

    it("should create InjectionNode with optional=false when explicitly specified", () => {
      const token = new NodeToken<string>("TestToken");
      InjectionContext.open();

      const result = nodeInject(token, { optional: false });
      const calls = InjectionContext.closeAndReport();

      expect(result).toBe(SHAPE_SHIFTER);
      expect(calls.size).toBe(1);
      expect(Array.from(calls)[0].optional).toBe(false);
    });
  });

  describe("Injector function delegation", () => {
    it("should delegate to injector function when set", () => {
      const token = new NodeToken<string>("TestToken");
      const mockInjector = vi.fn().mockReturnValue("injected value");

      InjectionContext.open(mockInjector);

      const result = nodeInject(token);

      expect(mockInjector).toHaveBeenCalledWith(token, undefined);
      expect(result).toBe("injected value");
    });

    it("should pass optional parameter to injector", () => {
      const token = new NodeToken<string>("TestToken");
      const mockInjector = vi.fn().mockReturnValue(null);

      InjectionContext.open(mockInjector);

      const result = nodeInject(token, { optional: true });

      expect(mockInjector).toHaveBeenCalledWith(token, true);
      expect(result).toBe(null);
    });

    it("should pass correct token when using decorated class", () => {
      @NodeInjectable()
      class TestService {}

      const mockInjector = vi.fn().mockReturnValue(new TestService());
      InjectionContext.open(mockInjector);

      nodeInject(TestService);

      expect(mockInjector).toHaveBeenCalledWith(
        getInjectableToken(TestService),
        undefined,
      );
    });

    it("should still register injection even when injector is present", () => {
      const token = new NodeToken<string>("TestToken");
      const mockInjector = vi.fn().mockReturnValue("value");

      InjectionContext.open(mockInjector);

      nodeInject(token);

      const calls = InjectionContext.closeAndReport();
      expect(calls.size).toBe(1);
    });
  });

  describe("Return type behavior", () => {
    it("should return array type for MultiNodeToken with injector", () => {
      const token = new MultiNodeToken<string>("MultiToken");
      const mockInjector = vi.fn().mockReturnValue(["value1", "value2"]);

      InjectionContext.open(mockInjector);

      const result = nodeInject(token);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(["value1", "value2"]);
    });

    it("should return single value for NodeToken with injector", () => {
      const token = new NodeToken<string>("SingleToken");
      const mockInjector = vi.fn().mockReturnValue("single value");

      InjectionContext.open(mockInjector);

      const result = nodeInject(token);

      expect(result).toBe("single value");
    });

    it("should return null for optional NodeToken when not found", () => {
      const token = new NodeToken<string>("OptionalToken");
      const mockInjector = vi.fn().mockReturnValue(null);

      InjectionContext.open(mockInjector);

      const result = nodeInject(token, { optional: true });

      expect(result).toBe(null);
    });

    it("should return empty array for MultiNodeToken when no providers exist", () => {
      const token = new MultiNodeToken<string>("EmptyMultiToken");
      const mockInjector = vi.fn().mockReturnValue([]);

      InjectionContext.open(mockInjector);

      const result = nodeInject(token);

      expect(result).toEqual([]);
    });
  });

  describe("INJECTION_SYMBOL handling", () => {
    it("should extract token from class with getInjectableToken", () => {
      @NodeInjectable()
      class ServiceA {}

      const extractedToken = getInjectableToken(ServiceA);
      expect(extractedToken).toBeInstanceOf(NodeToken);

      InjectionContext.open();
      const result = nodeInject(ServiceA);
      expect(result).toBe(SHAPE_SHIFTER);

      const calls = InjectionContext.closeAndReport();
      expect(calls.size).toBe(1);
      const [call] = Array.from(calls);
      expect(call.token).toBe(extractedToken);
    });

    it("should handle class without INJECTION_SYMBOL", () => {
      class PlainClass {}

      InjectionContext.open();

      expect(() => nodeInject(PlainClass as any)).toThrow(InjectionError);
    });
  });

  describe("Edge cases", () => {
    it("should handle null injector (explicitly set to null)", () => {
      const token = new NodeToken<string>("TestToken");
      InjectionContext.open(null as any);

      const result = nodeInject(token);
      expect(result).toBe(SHAPE_SHIFTER);
    });

    it("should handle injector throwing error", () => {
      const token = new NodeToken<string>("TestToken");
      const mockInjector = vi.fn().mockImplementation(() => {
        throw new Error("Injector error");
      });

      InjectionContext.open(mockInjector);

      expect(() => nodeInject(token)).toThrow("Injector error");
    });

    it("should handle rapid context open/close cycles", () => {
      const token = new NodeToken<string>("TestToken");

      InjectionContext.open();
      nodeInject(token);
      InjectionContext.closeAndReport();

      InjectionContext.open();
      nodeInject(token);
      InjectionContext.closeAndReport();

      InjectionContext.open();
      const result = nodeInject(token);

      expect(result).toBe(SHAPE_SHIFTER);
      const injections = InjectionContext.closeAndReport();
      expect(injections.size).toBe(1);
      expect(Array.from(injections)[0].token).toBe(token);
    });
  });

  describe("Integration with InjectionContext", () => {
    it("should maintain separate call sets across context reopens", () => {
      const token1 = new NodeToken<string>("Token1");
      const token2 = new NodeToken<number>("Token2");

      InjectionContext.open();
      nodeInject(token1);
      const calls1 = InjectionContext.closeAndReport();

      InjectionContext.open();
      nodeInject(token2);
      const calls2 = InjectionContext.closeAndReport();

      expect(calls1.size).toBe(1);
      expect(calls2.size).toBe(1);
      expect(Array.from(calls1)[0].token).toBe(token1);
      expect(Array.from(calls2)[0].token).toBe(token2);
    });

    it("should work with InjectionContext.scan pattern", () => {
      const token = new NodeToken<string>("TestToken");

      const factory = () => {
        nodeInject(token);
      };

      const injections = InjectionContext.scan(factory);

      expect(injections.size).toBe(1);
      expect(Array.from(injections)[0].token).toBe(token);
    });

    it("should work with InjectionContext.instantiate pattern", () => {
      const token = new NodeToken<string>("TestToken");
      const mockInjector = vi.fn().mockReturnValue("instantiated");

      const factory = () => {
        return nodeInject(token);
      };

      const result = InjectionContext.instantiate(factory, mockInjector);

      expect(result).toBe("instantiated");
      expect(mockInjector).toHaveBeenCalledWith(token, undefined);
    });
  });

  describe("Proxy", () => {
    it("should not throw when accessing injected node while scanning", () => {
      const token = new NodeToken<{ test: () => { hello: string } }>("TestToken");
      const container = new NodeContainer();

      const target = { test: () => ({ hello: "world" }) };
      container.provide(token.withValue(target));

      @NodeInjectable()
      class TestService {
        public readonly injected = nodeInject(token).test().hello;
      }

      container.provide(TestService);

      container.bootstrap();

      const service = container.get(TestService);
      expect(service.injected).toBe("world");
    });
  });
});
