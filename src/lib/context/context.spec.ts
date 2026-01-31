import { vi } from "vitest";
import { NodeToken } from "../api";
import { InjectionError } from "../errors";
import { InjectionContext } from "./context";

describe("InjectionContext", () => {
  afterEach(() => {
    // Ensure context is closed after each test
    InjectionContext.closeAndReport();
  });

  describe("open", () => {
    it("should open context with injector", () => {
      const mockInjector = vi.fn();
      InjectionContext.open(mockInjector);

      expect(InjectionContext.contextOpen).toBe(true);
      expect(InjectionContext.injector).toBe(mockInjector);
    });

    it("should reset state when reopening", () => {
      const token = new NodeToken("test");

      InjectionContext.open();
      InjectionContext.addDep({ token, optional: false });

      InjectionContext.open();
      expect(InjectionContext.closeAndReport().size).toBe(0);
    });
  });

  describe("close", () => {
    it("should close context and reset state", () => {
      const mockInjector = vi.fn();
      const token = new NodeToken("test");

      InjectionContext.open(mockInjector);
      InjectionContext.addDep({ token, optional: false });
      InjectionContext.closeAndReport();

      expect(InjectionContext.contextOpen).toBe(false);
      expect(InjectionContext.injector).toBeNull();
      // biome-ignore lint/complexity/useLiteralKeys: Checking against original set ref
      expect(InjectionContext["_calls"].size).toBe(0);
    });
  });

  describe("getCalls", () => {
    it("should return copy of calls when context is open", () => {
      const token = new NodeToken("test");
      const node = { token, optional: false };

      InjectionContext.open();
      InjectionContext.addDep(node);

      const calls = InjectionContext.closeAndReport();

      expect(calls.size).toBe(1);
      expect(calls.has(node)).toBe(true);
      // biome-ignore lint/complexity/useLiteralKeys: Checking against original set ref
      expect(calls).not.toBe(InjectionContext["_calls"]);
    });

    it("should throw error when context is not open", () => {
      expect(() => {
        InjectionContext.addDep({ token: new NodeToken("test"), optional: false });
      }).toThrow(InjectionError.calledUtilsOutsideContext());
    });
  });

  describe("scan", () => {
    it("should scan factory and return injection calls", () => {
      const token1 = new NodeToken("token1");
      const token2 = new NodeToken("token2");

      const node1 = { token: token1, optional: false };
      const node2 = { token: token2, optional: false };

      const factory = () => {
        InjectionContext.addDep(node1);
        InjectionContext.addDep(node2);
      };

      const injections = InjectionContext.scan(factory);

      expect(injections.size).toBe(2);
      expect(injections.has(node1)).toBe(true);
      expect(injections.has(node2)).toBe(true);
      expect(InjectionContext.contextOpen).toBe(false);
    });

    it("should handle factory errors gracefully", () => {
      const token = new NodeToken("test");
      const token2 = new NodeToken("other");

      const node = { token, optional: false };
      const node2 = { token: token2, optional: false };

      const factory = () => {
        InjectionContext.addDep(node);
        throw new Error("Factory error");
        // biome-ignore lint/correctness/noUnreachable: Obvious example
        InjectionContext.addDep(node2);
      };

      const injections = InjectionContext.scan(factory);

      expect(injections.size).toBe(1);
      expect(InjectionContext.contextOpen).toBe(false);
    });

    it("should return empty set for non-function", () => {
      expect(InjectionContext.scan("not a function" as any).size).toBe(0);
      expect(InjectionContext.scan(null as any).size).toBe(0);
    });
  });

  describe("instantiate", () => {
    it("should instantiate factory with injector and return result", () => {
      const mockInjector = vi.fn();
      const factory = () => "result";

      const result = InjectionContext.instantiate(factory, mockInjector);

      expect(result).toBe("result");
      expect(InjectionContext.contextOpen).toBe(false);
    });

    it("should make injector available during factory execution", () => {
      const mockInjector = vi.fn();
      let injectorDuringExecution: any = null;

      const factory = () => {
        injectorDuringExecution = InjectionContext.injector;
        return "result";
      };

      InjectionContext.instantiate(factory, mockInjector);

      expect(injectorDuringExecution).toBe(mockInjector);
    });

    it("should close context even if factory throws", () => {
      const mockInjector = vi.fn();
      const factory = () => {
        throw new Error("Factory error");
      };

      expect(() => {
        InjectionContext.instantiate(factory, mockInjector);
      }).toThrow("Factory error");

      expect(InjectionContext.contextOpen).toBe(false);
    });
  });
});
