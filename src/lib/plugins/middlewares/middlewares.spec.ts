import { NodeToken } from "../../api/token";
import { NodeContainer } from "../../container/container";
import { Illuma } from "../core/plugin-container";
import type { iMiddleware } from "./types";

describe("Plugin: Middlewares", () => {
  afterEach(() => {
    // Clear global middlewares after each test to avoid pollution
    // biome-ignore lint/complexity/useLiteralKeys: Accessing protected static member
    Illuma["_middlewares"].length = 0;
  });

  it("should transform instance via proxy middleware", () => {
    const Token = new NodeToken<any>("Token");
    const container = new NodeContainer();

    const proxyMiddleware: iMiddleware = (_params, next) => {
      const instance = next(_params);
      return new Proxy(instance as any, {
        get: (target, prop) => {
          if (prop === "data") return "proxied";
          return Reflect.get(target, prop);
        },
      });
    };

    container.registerMiddleware(proxyMiddleware);
    container.provide({ provide: Token, value: { data: "original" } });
    container.bootstrap();

    const instance = container.get(Token);
    expect(instance.data).toBe("proxied");
  });

  it("should spy on instantiation via logging middleware", () => {
    const Logger = new NodeToken<any>("Logger");
    const logs: string[] = [];
    const container = new NodeContainer();

    const loggerMiddleware: iMiddleware = (params, next) => {
      logs.push(`Creating ${params.token.name}`);
      return next(params);
    };

    container.registerMiddleware(loggerMiddleware);
    container.provide({ provide: Logger, value: "logger" });
    container.bootstrap();

    expect(logs).toContain("Creating Logger");
    expect(container.get(Logger)).toBe("logger");
  });

  it("should execute global middlewares", () => {
    const Token = new NodeToken<any>("Token");
    const container = new NodeContainer();
    const logs: string[] = [];

    const globalMiddleware: iMiddleware = (params, next) => {
      logs.push("global");
      return next(params);
    };

    Illuma.registerGlobalMiddleware(globalMiddleware);
    container.provide({ provide: Token, value: "value" });
    container.bootstrap();

    expect(logs).toContain("global");
  });

  it("should run middlewares in correct order", () => {
    const Token = new NodeToken<any>("Token");
    const container = new NodeContainer();
    const sequence: string[] = [];

    const m1: iMiddleware = (_p, next) => {
      sequence.push("m1 start");
      const res = next(_p);
      sequence.push("m1 end");
      return res;
    };

    const m2: iMiddleware = (_p, next) => {
      sequence.push("m2 start");
      const res = next(_p);
      sequence.push("m2 end");
      return res;
    };

    container.registerMiddleware(m1);
    container.registerMiddleware(m2);
    container.provide({ provide: Token, value: "val" });
    container.bootstrap();

    expect(container.get(Token)).toBe("val");

    expect(sequence).toEqual(["m1 start", "m2 start", "m2 end", "m1 end"]);
  });

  it("should have access to factory and instance in params", () => {
    const Token = new NodeToken<any>("Token");
    const container = new NodeContainer();
    let capturedFactory: (() => any) | undefined;

    const captureMiddleware: iMiddleware = (params, next) => {
      capturedFactory = params.factory;
      return next(params);
    };

    container.registerMiddleware(captureMiddleware);
    container.provide({ provide: Token, factory: () => "factory-created" });
    container.bootstrap();

    expect(capturedFactory).toBeDefined();

    // biome-ignore lint/style/noNonNullAssertion: Already checked defined
    expect(capturedFactory!()).toBe("factory-created");
  });

  it("should apply global, parent, and local middlewares correctly", () => {
    const Token = new NodeToken<any>("Token");
    const parentContainer = new NodeContainer();
    const childContainer = new NodeContainer({ parent: parentContainer });
    const logs: string[] = [];

    const globalMiddleware: iMiddleware = (p, n) => {
      logs.push("global");
      return n(p);
    };

    const parentMiddleware: iMiddleware = (p, n) => {
      logs.push("parent");
      return n(p);
    };

    const childMiddleware: iMiddleware = (p, n) => {
      logs.push("child");
      return n(p);
    };

    Illuma.registerGlobalMiddleware(globalMiddleware);
    parentContainer.registerMiddleware(parentMiddleware);
    childContainer.registerMiddleware(childMiddleware);

    childContainer.provide({ provide: Token, value: "val" });
    childContainer.bootstrap();

    expect(childContainer.get(Token)).toBe("val");
    expect(logs).toEqual(["global", "parent", "child"]);
  });

  it("should handle errors in middleware chain", () => {
    const Token = new NodeToken<any>("Token");
    const container = new NodeContainer();

    const errorMiddleware: iMiddleware = () => {
      throw new Error("Middleware error");
    };

    container.registerMiddleware(errorMiddleware);
    container.provide({ provide: Token, value: "val" });

    expect(() => container.bootstrap()).toThrow("Middleware error");
  });

  it("experimental: should work with deferred containers", () => {
    const Token = new NodeToken<any>("Token");
    const container = new NodeContainer({ instant: false });
    const logs: string[] = [];

    const deferredMiddleware: iMiddleware = (p, n) => {
      logs.push("deferred");
      return n(p);
    };

    container.registerMiddleware(deferredMiddleware);
    container.provide({ provide: Token, value: "val" });
    container.bootstrap();

    expect(container.get(Token)).toBe("val");
    expect(logs).toContain("deferred");
  });
});
