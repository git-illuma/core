import { NodeToken } from "../api";
import { InjectionError } from "../errors";
import { InjectionContext } from "./context";
import { InjectionNode } from "./node";

describe("InjectionContext", () => {
  afterEach(() => {
    // Ensure context is closed after each test
    InjectionContext.close();
  });

  describe("open", () => {
    it("should open context with injector", () => {
      const mockInjector = jest.fn();
      InjectionContext.open(mockInjector);

      expect(InjectionContext.contextOpen).toBe(true);
      expect(InjectionContext.injector).toBe(mockInjector);
    });

    it("should reset state when reopening", () => {
      const token = new NodeToken("test");
      const node = new InjectionNode(token);

      InjectionContext.open();
      InjectionContext.calls.add(node);

      InjectionContext.open();
      expect(InjectionContext.calls.size).toBe(0);
    });
  });

  describe("close", () => {
    it("should close context and reset state", () => {
      const mockInjector = jest.fn();
      const token = new NodeToken("test");
      const node = new InjectionNode(token);

      InjectionContext.open(mockInjector);
      InjectionContext.calls.add(node);

      InjectionContext.close();

      expect(InjectionContext.contextOpen).toBe(false);
      expect(InjectionContext.injector).toBeNull();
      expect(InjectionContext.calls.size).toBe(0);
    });
  });

  describe("getCalls", () => {
    it("should return copy of calls when context is open", () => {
      const token = new NodeToken("test");
      const node = new InjectionNode(token);

      InjectionContext.open();
      InjectionContext.calls.add(node);

      const calls = InjectionContext.getCalls();

      expect(calls.size).toBe(1);
      expect(calls.has(node)).toBe(true);
      expect(calls).not.toBe(InjectionContext.calls);
    });

    it("should throw error when context is not open", () => {
      expect(() => {
        InjectionContext.getCalls();
      }).toThrow(InjectionError.calledUtilsOutsideContext());
    });
  });

  describe("scan", () => {
    it("should scan factory and return injection calls", () => {
      const token1 = new NodeToken("token1");
      const token2 = new NodeToken("token2");
      const node1 = new InjectionNode(token1);
      const node2 = new InjectionNode(token2);

      const factory = () => {
        InjectionContext.calls.add(node1);
        InjectionContext.calls.add(node2);
      };

      const injections = InjectionContext.scan(factory);

      expect(injections.size).toBe(2);
      expect(injections.has(node1)).toBe(true);
      expect(injections.has(node2)).toBe(true);
      expect(InjectionContext.contextOpen).toBe(false);
    });

    it("should handle factory errors gracefully", () => {
      const token = new NodeToken("test");
      const node = new InjectionNode(token);

      const factory = () => {
        InjectionContext.calls.add(node);
        throw new Error("Factory error");
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
      const mockInjector = jest.fn();
      const factory = () => "result";

      const result = InjectionContext.instantiate(factory, mockInjector);

      expect(result).toBe("result");
      expect(InjectionContext.contextOpen).toBe(false);
    });

    it("should make injector available during factory execution", () => {
      const mockInjector = jest.fn();
      let injectorDuringExecution: any = null;

      const factory = () => {
        injectorDuringExecution = InjectionContext.injector;
        return "result";
      };

      InjectionContext.instantiate(factory, mockInjector);

      expect(injectorDuringExecution).toBe(mockInjector);
    });

    it("should close context even if factory throws", () => {
      const mockInjector = jest.fn();
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
