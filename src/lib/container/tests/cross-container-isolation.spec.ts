import { afterEach, describe, expect, it } from "vitest";
import { MultiNodeToken, NodeToken, nodeInject } from "../../api";
import { Illuma } from "../../global";
import type { iMiddleware } from "../../plugins/middlewares";
import { NodeContainer } from "../container";

// Tags an object instance with a flag, so a test can observe which container's
// middleware chain actually wrapped a given node's factory.
const tagWith =
  (flag: string): iMiddleware =>
  (params, next) => {
    const instance = next(params) as any;
    if (instance && typeof instance === "object") instance[flag] = true;
    return instance;
  };

describe("cross-container pool/middleware isolation", () => {
  afterEach(() => {
    (Illuma as any).__resetPlugins();
  });

  it("a lazy parent's node injected by an instant child runs under the PARENT chain (#21)", () => {
    const PTOK = new NodeToken<Record<string, unknown>>("CC_PTOK");
    let factoryRuns = 0;

    const parent = new NodeContainer({ instant: false });
    parent.registerMiddleware(tagWith("parentMw"));
    parent.provide(
      PTOK.withFactory(() => {
        factoryRuns++;
        return {};
      }),
    );
    parent.bootstrap();
    // The provide()-time dependency-scan dry-run already executed the factory
    // once (a throwaway, no middleware). Reset so we count only the real
    // materialization in the tree.
    factoryRuns = 0;

    const HOST = new NodeToken<{ p: Record<string, unknown> }>("CC_HOST");
    const child = new NodeContainer({ parent, instant: true });
    child.registerMiddleware(tagWith("childMw"));
    child.provide(HOST.withFactory(() => ({ p: nodeInject(PTOK) })));
    child.bootstrap();

    const p = child.get(HOST).p;
    expect(p.parentMw).toBe(true); // ran under the parent's middleware
    expect(p.childMw).toBeUndefined(); // NOT contaminated by the child's middleware
    expect(factoryRuns).toBe(1); // materialized exactly once

    // Same instance across the boundary.
    expect(parent.get(PTOK)).toBe(p);
  });

  it("inherited parent multi members are not wrapped in child middleware (#8)", () => {
    const M = new MultiNodeToken<{ name: string; childMw?: boolean; parentMw?: boolean }>(
      "CC_MULTI",
    );

    const parent = new NodeContainer({ instant: false });
    parent.registerMiddleware(tagWith("parentMw"));
    parent.provide(M.withFactory(() => ({ name: "p" })));
    parent.bootstrap();

    const child = new NodeContainer({ parent, instant: true });
    child.registerMiddleware(tagWith("childMw"));
    child.provide(M.withFactory(() => ({ name: "c" })));
    child.bootstrap();

    const members = child.get(M);
    const pMember = members.find((m) => m.name === "p");
    const cMember = members.find((m) => m.name === "c");

    expect(pMember?.parentMw).toBe(true);
    expect(pMember?.childMw).toBeUndefined(); // parent member keeps parent chain
    expect(cMember?.childMw).toBe(true); // child member runs under child chain

    // The parent's own view of M is likewise un-contaminated.
    expect(parent.get(M).every((m) => m.childMw === undefined)).toBe(true);
  });

  it("a parent token is not leaked into the child's own tree pool", () => {
    const PTOK = new NodeToken<Record<string, unknown>>("CC_POOL_PTOK");
    const parent = new NodeContainer({ instant: false });
    parent.provide(PTOK.withFactory(() => ({})));
    parent.bootstrap();

    const HOST = new NodeToken<unknown>("CC_POOL_HOST");
    const child = new NodeContainer({ parent, instant: true });
    child.provide(HOST.withFactory(() => nodeInject(PTOK)));
    child.bootstrap();

    // The child reaches PTOK upstream; PTOK's node belongs to the parent's pool,
    // not the child's own tree pool.
    expect((child as any)._findNode(PTOK)).toBeNull();
  });

  describe("post-bootstrap global middleware consistency (#39)", () => {
    it("a global middleware registered after bootstrap applies to lazy get() (matching produce)", () => {
      const TOKEN = new NodeToken<Record<string, unknown>>("CC_39_LAZY");
      const c = new NodeContainer({ instant: false });
      c.provide(TOKEN.withFactory(() => ({})));
      c.bootstrap();

      Illuma.registerGlobalMiddleware(tagWith("lateMw"));

      const viaGet = c.get(TOKEN);
      const viaProduce = c.produce(() => nodeInject(TOKEN, { optional: true }));

      expect(viaGet.lateMw).toBe(true);
      expect((viaProduce as any).lateMw).toBe(true);
    });

    it("a global middleware registered after bootstrap does NOT retroactively wrap an instant node", () => {
      const TOKEN = new NodeToken<Record<string, unknown>>("CC_39_INSTANT");
      const c = new NodeContainer(); // instant
      c.provide(TOKEN.withFactory(() => ({})));
      c.bootstrap(); // node already materialized here

      Illuma.registerGlobalMiddleware(tagWith("lateMw"));

      expect(c.get(TOKEN).lateMw).toBeUndefined();
    });
  });
});
