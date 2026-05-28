import { describe, expect, it } from "vitest";
import { NodeContainer } from "../container/container";
import {
  getInjectableToken,
  isInjectable,
  makeScoped,
  makeService,
  Scoped,
  Service,
} from "./decorator";

describe("Service / makeService", () => {
  it("should mark a class as injectable singleton via decorator", () => {
    @Service()
    class GlobalThing {
      public readonly id = Math.random();
    }

    expect(isInjectable(GlobalThing)).toBe(true);
    expect(getInjectableToken(GlobalThing).opts?.singleton).toBe(true);
  });

  it("should mark a class as injectable singleton via makeService", () => {
    class _GlobalThing {
      public readonly id = Math.random();
    }
    const GlobalThing = makeService(_GlobalThing);

    expect(isInjectable(GlobalThing)).toBe(true);
    expect(getInjectableToken(GlobalThing).opts?.singleton).toBe(true);
  });

  it("should be shared across the container tree", () => {
    @Service()
    class SharedService {
      public readonly id = Math.random();
    }

    const root = new NodeContainer();
    const child = new NodeContainer({ parent: root });
    root.bootstrap();

    expect(root.get(SharedService)).toBe(child.get(SharedService));
  });
});

describe("Scoped / makeScoped", () => {
  it("should mark a class as node-scoped injectable via decorator", () => {
    @Scoped()
    class LocalThing {}

    expect(isInjectable(LocalThing)).toBe(true);
    expect(getInjectableToken(LocalThing).opts?.singleton).toBeFalsy();
  });

  it("should mark a class as node-scoped injectable via makeScoped", () => {
    class _LocalThing {}
    const LocalThing = makeScoped(_LocalThing);

    expect(isInjectable(LocalThing)).toBe(true);
    expect(getInjectableToken(LocalThing).opts?.singleton).toBeFalsy();
  });

  it("should resolve separately per container when provided locally", () => {
    @Scoped()
    class RequestCtx {
      public readonly id = Math.random();
    }

    const root = new NodeContainer();
    const child = new NodeContainer({ parent: root });

    root.provide(RequestCtx);
    child.provide(RequestCtx);
    root.bootstrap();

    expect(root.get(RequestCtx)).not.toBe(child.get(RequestCtx));
  });
});
