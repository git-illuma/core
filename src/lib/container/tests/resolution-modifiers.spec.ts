import { describe, expect, it } from "vitest";
import { MultiNodeToken, NodeToken, nodeInject } from "../../api";
import { createTestFactory } from "../../testkit/helpers";
import { injectDefer } from "../../utils/defer";
import { NodeContainer } from "../container";

describe("self:true on a multi token returns local-only members (#3)", () => {
  function parentChild() {
    const M = new MultiNodeToken<string>("RM_SELF_MULTI");
    const parent = new NodeContainer();
    parent.provide(M.withValue("parent"));
    parent.bootstrap();
    const child = parent.child() as NodeContainer;
    child.provide(M.withValue("child"));
    child.bootstrap();
    return { M, parent, child };
  }

  it("get(M, { self: true }) returns only the child's own members", () => {
    const { M, child } = parentChild();
    expect(child.get(M, { self: true })).toEqual(["child"]);
  });

  it("get(M) without self still returns inherited + local members", () => {
    const { M, child } = parentChild();
    expect(child.get(M).sort()).toEqual(["child", "parent"]);
  });

  it("factory nodeInject(M, { self: true }) is local-only", () => {
    const M = new MultiNodeToken<string>("RM_SELF_FACT_MULTI");
    const HOST = new NodeToken<string[]>("RM_SELF_FACT_HOST");

    const parent = new NodeContainer();
    parent.provide(M.withValue("parent"));
    parent.bootstrap();

    const child = parent.child() as NodeContainer;
    child.provide(M.withValue("child"));
    child.provide(HOST.withFactory(() => nodeInject(M, { self: true })));
    child.bootstrap();

    expect(child.get(HOST)).toEqual(["child"]);
  });

  it("produce(() => nodeInject(M, { self: true })) is local-only", () => {
    const { M, child } = parentChild();
    expect(child.produce(() => nodeInject(M, { self: true }))).toEqual(["child"]);
  });

  it("self:true returns [] when the child has no local members", () => {
    const M = new MultiNodeToken<string>("RM_SELF_EMPTY");
    const parent = new NodeContainer();
    parent.provide(M.withValue("parent"));
    parent.bootstrap();
    const child = parent.child() as NodeContainer;
    child.bootstrap();
    expect(child.get(M, { self: true })).toEqual([]);
  });

  it("skipSelf still returns ancestor-only members (regression)", () => {
    const { M, child } = parentChild();
    expect(child.get(M, { skipSelf: true })).toEqual(["parent"]);
  });

  it("3-level: grandchild self returns only its own members", () => {
    const M = new MultiNodeToken<string>("RM_SELF_3LVL");
    const root = new NodeContainer();
    root.provide(M.withValue("root"));
    root.bootstrap();
    const child = root.child() as NodeContainer;
    child.provide(M.withValue("child"));
    child.bootstrap();
    const grandchild = child.child() as NodeContainer;
    grandchild.provide(M.withValue("grandchild"));
    grandchild.bootstrap();

    expect(grandchild.get(M, { self: true })).toEqual(["grandchild"]);
    expect(grandchild.get(M).sort()).toEqual(["child", "grandchild", "root"]);
  });
});

describe("same token injected in two scopes in one factory (#20)", () => {
  it("plain and skipSelf injections of the same token resolve to different scopes", () => {
    const A = new NodeToken<string>("RM_TWOSCOPE_A");
    const HOST = new NodeToken<{ local: string; parent: string }>("RM_TWOSCOPE_HOST");

    const parent = new NodeContainer();
    parent.provide(A.withValue("parent"));
    parent.bootstrap();

    const child = parent.child() as NodeContainer;
    child.provide(A.withValue("child"));
    child.provide(
      HOST.withFactory(() => ({
        local: nodeInject(A),
        parent: nodeInject(A, { skipSelf: true }),
      })),
    );
    child.bootstrap();

    const host = child.get(HOST);
    expect(host.local).toBe("child");
    expect(host.parent).toBe("parent");
  });

  it("self and skipSelf injections of the same token do not collide", () => {
    const A = new NodeToken<string>("RM_TWOSCOPE_SELF_A");
    const HOST = new NodeToken<{ self: string; parent: string }>("RM_TWOSCOPE_SELF_HOST");

    const parent = new NodeContainer();
    parent.provide(A.withValue("parent"));
    parent.bootstrap();

    const child = parent.child() as NodeContainer;
    child.provide(A.withValue("child"));
    child.provide(
      HOST.withFactory(() => ({
        self: nodeInject(A, { self: true }),
        parent: nodeInject(A, { skipSelf: true }),
      })),
    );
    child.bootstrap();

    const host = child.get(HOST);
    expect(host.self).toBe("child");
    expect(host.parent).toBe("parent");
  });

  it("multi token: plain (aggregated) and skipSelf (ancestor-only) in one factory", () => {
    const M = new MultiNodeToken<string>("RM_TWOSCOPE_MULTI");
    const HOST = new NodeToken<{ all: string[]; parent: string[] }>(
      "RM_TWOSCOPE_MULTI_HOST",
    );

    const parent = new NodeContainer();
    parent.provide(M.withValue("parent"));
    parent.bootstrap();

    const child = parent.child() as NodeContainer;
    child.provide(M.withValue("child"));
    child.provide(
      HOST.withFactory(() => ({
        all: nodeInject(M),
        parent: nodeInject(M, { skipSelf: true }),
      })),
    );
    child.bootstrap();

    const host = child.get(HOST);
    expect(host.all.sort()).toEqual(["child", "parent"]);
    expect(host.parent).toEqual(["parent"]);
  });

  it("a token injected only via skipSelf still resolves (no plain slot needed)", () => {
    const A = new NodeToken<string>("RM_SKIPONLY_A");
    const HOST = new NodeToken<string>("RM_SKIPONLY_HOST");

    const parent = new NodeContainer();
    parent.provide(A.withValue("parent"));
    parent.bootstrap();

    const child = parent.child() as NodeContainer;
    child.provide(A.withValue("child"));
    child.provide(HOST.withFactory(() => nodeInject(A, { skipSelf: true })));
    child.bootstrap();

    expect(child.get(HOST)).toBe("parent");
  });
});

describe("produce()/get() parity on skipSelf + root singleton (#36)", () => {
  it("produce resolves a root singleton under skipSelf, matching get", () => {
    const SINGLETON = new NodeToken<string>("RM_SINGLETON", {
      singleton: true,
      factory: () => "singleton-value",
    });

    const c = new NodeContainer();
    c.provide(SINGLETON);
    c.bootstrap();

    const viaGet = c.get(SINGLETON, { skipSelf: true });
    const viaProduce = c.produce(() => nodeInject(SINGLETON, { skipSelf: true }));

    expect(viaGet).toBe("singleton-value");
    expect(viaProduce).toBe(viaGet);
  });

  it("produce and get agree on a plain skipSelf miss (both behave the same)", () => {
    const PLAIN = new NodeToken<string>("RM_PLAIN");
    const c = new NodeContainer();
    c.provide(PLAIN.withValue("local"));
    c.bootstrap();

    // skipSelf on a root container with no parent: neither resolves the local value.
    const getThrew = (() => {
      try {
        c.get(PLAIN, { skipSelf: true });
        return false;
      } catch {
        return true;
      }
    })();
    const produceThrew = (() => {
      try {
        c.produce(() => nodeInject(PLAIN, { skipSelf: true }));
        return false;
      } catch {
        return true;
      }
    })();

    expect(produceThrew).toBe(getThrew);
  });
});

describe("injectDefer forwards skipSelf/self modifiers (#18)", () => {
  it("a deferred skipSelf injection resolves from the parent, not self", () => {
    const TOK = new NodeToken<string>("RM_DEFER_TOK");
    const HOST = new NodeToken<() => string>("RM_DEFER_HOST");

    const parent = new NodeContainer();
    parent.provide(TOK.withValue("parent"));
    parent.bootstrap();

    const child = parent.child() as NodeContainer;
    child.provide(TOK.withValue("child"));
    child.provide(HOST.withFactory(() => injectDefer(TOK, { skipSelf: true })));
    child.bootstrap();

    const deferred = child.get(HOST);
    expect(deferred()).toBe("parent");
  });

  it("a deferred self injection resolves locally only", () => {
    const TOK = new NodeToken<string>("RM_DEFER_SELF_TOK");
    const HOST = new NodeToken<() => string>("RM_DEFER_SELF_HOST");

    const parent = new NodeContainer();
    parent.provide(TOK.withValue("parent"));
    parent.bootstrap();

    const child = parent.child() as NodeContainer;
    child.provide(TOK.withValue("child"));
    child.provide(HOST.withFactory(() => injectDefer(TOK, { self: true })));
    child.bootstrap();

    expect(child.get(HOST)()).toBe("child");
  });

  it("deferred optional still returns null when unprovided", () => {
    const MISSING = new NodeToken<string>("RM_DEFER_MISSING");
    const HOST = new NodeToken<() => string | null>("RM_DEFER_OPT_HOST");

    const c = new NodeContainer();
    c.provide(HOST.withFactory(() => injectDefer(MISSING, { optional: true })));
    c.bootstrap();

    expect(c.get(HOST)()).toBeNull();
  });
});

describe("testkit Spectator forwards modifiers (#27)", () => {
  it("spectator.nodeInject honors skipSelf (standalone container has no parent)", () => {
    const TARGET = new NodeToken<string>("RM_TK_TARGET", { factory: () => "target" });
    const DEP = new NodeToken<string>("RM_TK_DEP");

    const factory = createTestFactory<string>({
      target: TARGET,
      provide: [DEP.withValue("dep")],
    });
    const spectator = factory();

    expect(spectator.nodeInject(DEP)).toBe("dep");
    // skipSelf is now forwarded: a standalone container resolves nothing upstream.
    expect(() => spectator.nodeInject(DEP, { skipSelf: true })).toThrow();
  });

  it("spectator.nodeInject still honors optional", () => {
    const TARGET = new NodeToken<string>("RM_TK_OPT_TARGET", {
      factory: () => "target",
    });
    const MISSING = new NodeToken<string>("RM_TK_MISSING");

    const factory = createTestFactory<string>({
      target: TARGET,
    });
    const spectator = factory();

    expect(spectator.nodeInject(MISSING, { optional: true })).toBeNull();
  });
});
