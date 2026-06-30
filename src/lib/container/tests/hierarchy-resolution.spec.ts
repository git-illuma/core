import { describe, expect, it } from "vitest";
import { MultiNodeToken, NodeToken, nodeInject } from "../../api";
import { NodeContainer } from "../container";

// Resolution must traverse the full ancestor chain up to the root, not just the
// immediate parent (RESOLUTION_MODIFIERS.md: "traverse up the container
// hierarchy ... until it finds a provider or reaches the root container").

describe("multi-level hierarchy: single tokens", () => {
  function threeLevels() {
    const root = new NodeContainer();
    const ROOT_TOK = new NodeToken<string>("HR_ROOT_TOK");
    root.provide(ROOT_TOK.withValue("from-root"));
    root.bootstrap();
    const child = root.child() as NodeContainer;
    child.bootstrap();
    const grandchild = child.child() as NodeContainer;
    grandchild.bootstrap();
    return { root, child, grandchild, ROOT_TOK };
  }

  it("a grandchild resolves a non-singleton token provided on the root via get()", () => {
    const { grandchild, ROOT_TOK } = threeLevels();
    expect(grandchild.get(ROOT_TOK)).toBe("from-root");
  });

  it("a grandchild factory can depend on a root-provided non-singleton token", () => {
    const ROOT_TOK = new NodeToken<number>("HR_DEP_ROOT");
    const LOCAL = new NodeToken<number>("HR_DEP_LOCAL");

    const root = new NodeContainer();
    root.provide(ROOT_TOK.withValue(40));
    root.bootstrap();

    const child = root.child() as NodeContainer;
    child.bootstrap();

    const grandchild = child.child() as NodeContainer;
    grandchild.provide(LOCAL.withFactory(() => nodeInject(ROOT_TOK) + 2));
    expect(() => grandchild.bootstrap()).not.toThrow();
    expect(grandchild.get(LOCAL)).toBe(42);
  });

  it("the nearest ancestor wins when the token is provided at multiple levels", () => {
    const TOK = new NodeToken<string>("HR_NEAREST");

    const root = new NodeContainer();
    root.provide(TOK.withValue("root"));
    root.bootstrap();

    const child = root.child() as NodeContainer;
    child.provide(TOK.withValue("child"));
    child.bootstrap();

    const grandchild = child.child() as NodeContainer;
    grandchild.bootstrap();

    expect(grandchild.get(TOK)).toBe("child");
  });

  it("still resolves from the immediate parent (regression)", () => {
    const TOK = new NodeToken<string>("HR_PARENT_ONLY");
    const parent = new NodeContainer();
    parent.provide(TOK.withValue("parent"));
    parent.bootstrap();
    const child = parent.child() as NodeContainer;
    child.bootstrap();
    expect(child.get(TOK)).toBe("parent");
  });

  it("still throws notFound for a token provided nowhere in the chain", () => {
    const { grandchild } = threeLevels();
    const MISSING = new NodeToken<string>("HR_MISSING");
    expect(() => grandchild.get(MISSING)).toThrow();
    expect(grandchild.get(MISSING, { optional: true })).toBeNull();
  });
});

describe("multi-level hierarchy: multi tokens", () => {
  it("a grandchild get(MULTI) sees ancestor members instead of []", () => {
    const M = new MultiNodeToken<string>("HR_MULTI_ROOT");

    const root = new NodeContainer();
    root.provide(M.withValue("root-member"));
    root.bootstrap();

    const child = root.child() as NodeContainer;
    child.bootstrap();
    const grandchild = child.child() as NodeContainer;
    grandchild.bootstrap();

    expect(grandchild.get(M)).toEqual(["root-member"]);
  });

  it("aggregates members across all three levels", () => {
    const M = new MultiNodeToken<string>("HR_MULTI_AGG");

    const root = new NodeContainer();
    root.provide(M.withValue("root"));
    root.bootstrap();

    const child = root.child() as NodeContainer;
    child.provide(M.withValue("child"));
    child.bootstrap();

    const grandchild = child.child() as NodeContainer;
    grandchild.provide(M.withValue("grandchild"));
    grandchild.bootstrap();

    expect(grandchild.get(M).sort()).toEqual(["child", "grandchild", "root"]);
  });

  it("aggregates across an empty intermediate level", () => {
    const M = new MultiNodeToken<string>("HR_MULTI_SKIP");

    const root = new NodeContainer();
    root.provide(M.withValue("root"));
    root.bootstrap();

    const child = root.child() as NodeContainer; // no members here
    child.bootstrap();

    const grandchild = child.child() as NodeContainer;
    grandchild.provide(M.withValue("grandchild"));
    grandchild.bootstrap();

    expect(grandchild.get(M).sort()).toEqual(["grandchild", "root"]);
  });

  it("returns [] for a multi token provided nowhere in the chain", () => {
    const M = new MultiNodeToken<string>("HR_MULTI_NONE");
    const root = new NodeContainer();
    root.bootstrap();
    const child = root.child() as NodeContainer;
    child.bootstrap();
    const grandchild = child.child() as NodeContainer;
    grandchild.bootstrap();
    expect(grandchild.get(M)).toEqual([]);
  });
});

describe("multi-level hierarchy: lazy (instant:false) mode", () => {
  it("a grandchild resolves a root-provided non-singleton in lazy mode", () => {
    const ROOT_TOK = new NodeToken<string>("HR_LAZY_ROOT");

    const root = new NodeContainer({ instant: false });
    root.provide(ROOT_TOK.withValue("from-root"));
    root.bootstrap();
    const child = root.child() as NodeContainer;
    child.bootstrap();
    const grandchild = child.child() as NodeContainer;
    grandchild.bootstrap();

    expect(grandchild.get(ROOT_TOK)).toBe("from-root");
  });

  it("a lazy grandchild factory depends on a root-provided token", () => {
    const ROOT_TOK = new NodeToken<number>("HR_LAZY_DEP_ROOT");
    const LOCAL = new NodeToken<number>("HR_LAZY_DEP_LOCAL");

    const root = new NodeContainer({ instant: false });
    root.provide(ROOT_TOK.withValue(40));
    root.bootstrap();
    const child = root.child() as NodeContainer;
    child.bootstrap();
    const grandchild = child.child() as NodeContainer;
    grandchild.provide(LOCAL.withFactory(() => nodeInject(ROOT_TOK) + 2));
    grandchild.bootstrap();

    expect(grandchild.get(LOCAL)).toBe(42);
  });
});
