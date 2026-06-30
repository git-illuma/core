import { describe, expect, it } from "vitest";
import { MultiNodeToken, NodeToken, nodeInject } from "../api";
import { NodeContainer } from "../container";

describe("multi token result is a defensive copy (#7)", () => {
  it("mutating one consumer's array does not corrupt other consumers", () => {
    const M = new MultiNodeToken<number>("MR_SHARED");
    const A = new NodeToken<number[]>("MR_A");
    const B = new NodeToken<number[]>("MR_B");

    const c = new NodeContainer();
    c.provide(M.withValue(1));
    c.provide(M.withValue(2));
    c.provide(A.withFactory(() => nodeInject(M)));
    c.provide(B.withFactory(() => nodeInject(M)));
    c.bootstrap();

    const a = c.get(A);
    a.push(999);
    a.sort((x, y) => y - x);

    expect(c.get(B)).toEqual([1, 2]);
  });

  it("direct container.get(MULTI) hands out independent arrays", () => {
    const M = new MultiNodeToken<number>("MR_GET");
    const c = new NodeContainer();
    c.provide(M.withValue(1));
    c.provide(M.withValue(2));
    c.bootstrap();

    const first = c.get(M);
    first.push(3);
    expect(c.get(M)).toEqual([1, 2]);
  });

  it("members themselves are still shared instances (shallow copy)", () => {
    const M = new MultiNodeToken<{ id: number }>("MR_IDENTITY");
    const obj = { id: 1 };
    const c = new NodeContainer();
    c.provide(M.withValue(obj));
    c.bootstrap();

    const a = c.get(M);
    const b = c.get(M);
    expect(a).not.toBe(b); // different array containers
    expect(a[0]).toBe(b[0]); // same member instance
    expect(a[0]).toBe(obj);
  });
});

describe("optional multi injection resolves to [] not null (#9/#10)", () => {
  it("optional nodeInject of an unprovided multi returns [] (spreadable)", () => {
    const M = new MultiNodeToken<number>("MR_OPT");
    const HOST = new NodeToken<number[]>("MR_OPT_HOST");

    const c = new NodeContainer();
    c.provide(
      HOST.withFactory(() => {
        const items = nodeInject(M, { optional: true });
        return [...items];
      }),
    );
    c.bootstrap();

    expect(c.get(HOST)).toEqual([]);
  });

  it("optional multi inside a multi-token factory member (transparent retriever) returns []", () => {
    const OUTER = new MultiNodeToken<number>("MR_OUTER");
    const INNER = new MultiNodeToken<number>("MR_INNER"); // never provided

    const c = new NodeContainer();
    c.provide(
      OUTER.withFactory(() => {
        const inner = nodeInject(INNER, { optional: true });
        return inner.length; // must not throw on null.length
      }),
    );
    c.bootstrap();

    expect(c.get(OUTER)).toEqual([0]);
  });

  it("optional multi with members still returns the members", () => {
    const M = new MultiNodeToken<number>("MR_OPT_PRESENT");
    const HOST = new NodeToken<number[]>("MR_OPT_PRESENT_HOST");

    const c = new NodeContainer();
    c.provide(M.withValue(5));
    c.provide(M.withValue(6));
    c.provide(HOST.withFactory(() => [...nodeInject(M, { optional: true })]));
    c.bootstrap();

    expect(c.get(HOST)).toEqual([5, 6]);
  });

  it("optional single injection still returns null when unprovided", () => {
    const SINGLE = new NodeToken<number>("MR_OPT_SINGLE");
    const HOST = new NodeToken<number | null>("MR_OPT_SINGLE_HOST");

    const c = new NodeContainer();
    c.provide(HOST.withFactory(() => nodeInject(SINGLE, { optional: true })));
    c.bootstrap();

    expect(c.get(HOST)).toBeNull();
  });
});
