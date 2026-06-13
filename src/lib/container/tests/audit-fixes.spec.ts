import { afterEach, describe, expect, it } from "vitest";
import { MultiNodeToken, NodeInjectable, NodeToken, nodeInject } from "../../api";
import { InjectionContext } from "../../context/context";
import { ERR_CODES, InjectionError } from "../../errors";
import { Illuma } from "../../global";
import type { iContextScanner } from "../../plugins/context/types";
import { Injector } from "../../utils/injector";
import { NodeContainer } from "../container";
import { LifecycleRef } from "../lifecycle";

describe("diamond dependency dedup (resolver)", () => {
  it("shares one diamond-shared instance across both consumers (order A,B,D)", () => {
    const D = new NodeToken<{ marker: object }>("DIAMOND_D");
    const B = new NodeToken<{ d: { marker: object } }>("DIAMOND_B");
    const A = new NodeToken<{ d: { marker: object }; b: { d: { marker: object } } }>(
      "DIAMOND_A",
    );

    const c = new NodeContainer();
    c.provide(
      A.withFactory(() => {
        const d = nodeInject(D);
        const b = nodeInject(B);
        return { d, b };
      }),
    );
    c.provide(B.withFactory(() => ({ d: nodeInject(D) })));
    c.provide(D.withFactory(() => ({ marker: {} })));
    c.bootstrap();

    const a = c.get(A);

    expect(a.d).toBe(a.b.d);
  });

  it("shares the same TreeNode across both parents (allocations === 2)", () => {
    const D = new NodeToken<{ id: number }>("DIAMOND_ALLOC_D");
    const B = new NodeToken<unknown>("DIAMOND_ALLOC_B");
    const A = new NodeToken<unknown>("DIAMOND_ALLOC_A");

    const c = new NodeContainer();
    c.provide(
      A.withFactory(() => {
        nodeInject(D);
        nodeInject(B);
        return {};
      }),
    );
    c.provide(
      B.withFactory(() => {
        nodeInject(D);
        return {};
      }),
    );
    c.provide(D.withFactory(() => ({ id: 1 })));
    c.bootstrap();

    const rootNode = (c as any)._rootNode;
    expect(rootNode.find(D).allocations).toBe(2);
  });

  it("throws i401 (not stack-overflow) for mutually-referencing siblings", () => {
    const P = new NodeToken<unknown>("SIBLING_CYCLE_P");
    const A = new NodeToken<unknown>("SIBLING_CYCLE_A");
    const B = new NodeToken<unknown>("SIBLING_CYCLE_B");

    const c = new NodeContainer();
    c.provide(
      P.withFactory(() => {
        nodeInject(A);
        nodeInject(B);
        return {};
      }),
    );
    c.provide(A.withFactory(() => nodeInject(B)));
    c.provide(B.withFactory(() => nodeInject(A)));

    let caught: InjectionError | undefined;
    try {
      c.bootstrap();
    } catch (e) {
      caught = e as InjectionError;
    }
    expect(caught).toBeInstanceOf(InjectionError);
    expect(caught?.code).toBe(ERR_CODES.CIRCULAR_DEPENDENCY);
  });

  it("throws i401 for a sibling cycle in lazy (instant:false) mode too", () => {
    const P = new NodeToken<unknown>("LAZY_CYCLE_P");
    const A = new NodeToken<unknown>("LAZY_CYCLE_A");
    const B = new NodeToken<unknown>("LAZY_CYCLE_B");

    const c = new NodeContainer({ instant: false });
    c.provide(
      P.withFactory(() => {
        nodeInject(A);
        nodeInject(B);
        return {};
      }),
    );
    c.provide(A.withFactory(() => nodeInject(B)));
    c.provide(B.withFactory(() => nodeInject(A)));

    let caught: InjectionError | undefined;
    try {
      c.bootstrap();
    } catch (e) {
      caught = e as InjectionError;
    }
    expect(caught).toBeInstanceOf(InjectionError);
    expect(caught?.code).toBe(ERR_CODES.CIRCULAR_DEPENDENCY);
  });

  it("still throws a circular-dependency error for a cycle through a diamond", () => {
    const S = new NodeToken<unknown>("CYCLE_S");
    const B = new NodeToken<unknown>("CYCLE_B");
    const A = new NodeToken<unknown>("CYCLE_A");

    const c = new NodeContainer();
    c.provide(
      A.withFactory(() => {
        nodeInject(S);
        nodeInject(B);
        return {};
      }),
    );
    c.provide(B.withFactory(() => nodeInject(S)));
    c.provide(S.withFactory(() => nodeInject(A)));

    let caught: InjectionError | undefined;
    try {
      c.bootstrap();
    } catch (e) {
      caught = e as InjectionError;
    }
    expect(caught).toBeInstanceOf(InjectionError);
    expect(caught?.code).toBe(ERR_CODES.CIRCULAR_DEPENDENCY);
  });

  it("shares a diamond dep across two bare-declared opts.factory tokens", () => {
    const V = new NodeToken<{ marker: object }>("DIAMOND_BARE_V", {
      factory: () => ({ marker: {} }),
    });
    const X = new NodeToken<{ v: { marker: object } }>("DIAMOND_BARE_X", {
      factory: () => ({ v: nodeInject(V) }),
    });
    const Y = new NodeToken<{ v: { marker: object } }>("DIAMOND_BARE_Y", {
      factory: () => ({ v: nodeInject(V) }),
    });
    const ROOT = new NodeToken<{ x: { v: object }; y: { v: object } }>(
      "DIAMOND_BARE_ROOT",
    );

    const c = new NodeContainer();
    c.provide(ROOT.withFactory(() => ({ x: nodeInject(X), y: nodeInject(Y) })));
    c.provide(X);
    c.provide(Y);
    c.provide(V);
    c.bootstrap();

    const root = c.get(ROOT);
    expect(root.x.v).toBe(root.y.v);
  });
});

describe("nested injection context (no clobber)", () => {
  it("keeps the outer context open after injector.get() of a lazy singleton", () => {
    const SINGLETON = new NodeToken<string>("NESTED_SINGLETON", {
      singleton: true,
      factory: () => "singleton-value",
    });
    const OTHER = new NodeToken<string>("NESTED_OTHER");
    const A = new NodeToken<{ s: string; o: string }>("NESTED_A");

    const c = new NodeContainer({ instant: false });
    c.provide(OTHER.withValue("other"));
    c.provide(
      A.withFactory(() => {
        const injector = nodeInject(Injector);
        const s = injector.get(SINGLETON);
        const o = nodeInject(OTHER);
        return { s, o };
      }),
    );
    c.bootstrap();

    const a = c.get(A);
    expect(a.s).toBe("singleton-value");
    expect(a.o).toBe("other");
  });

  it("keeps the outer context open after injector.produce()", () => {
    const OTHER = new NodeToken<string>("NESTED_PRODUCE_OTHER");
    const A = new NodeToken<{ p: { x: number }; o: string }>("NESTED_PRODUCE_A");

    const c = new NodeContainer({ instant: false });
    c.provide(OTHER.withValue("other"));
    c.provide(
      A.withFactory(() => {
        const injector = nodeInject(Injector);
        const p = injector.produce(() => ({ x: 42 }));
        const o = nodeInject(OTHER);
        return { p, o };
      }),
    );
    c.bootstrap();

    const a = c.get(A);
    expect(a.p.x).toBe(42);
    expect(a.o).toBe("other");
  });

  it("restores the outer context even when a context scanner throws", () => {
    const throwingScanner: iContextScanner = {
      scan: () => {
        throw new Error("scanner boom");
      },
    };
    Illuma.extendContextScanner(throwingScanner);

    try {
      expect(() => {
        const c = new NodeContainer();
        c.provide(new NodeToken<number>("SCANNER_X").withFactory(() => 1));
      }).not.toThrow();

      const c2 = new NodeContainer();
      const T = new NodeToken<string>("SCANNER_T");
      const DEP = new NodeToken<string>("SCANNER_DEP");
      c2.provide(DEP.withValue("dep"));
      c2.provide(
        T.withFactory(() => {
          const d = nodeInject(DEP);
          return `t-${d}`;
        }),
      );
      c2.bootstrap();
      expect(c2.get(T)).toBe("t-dep");
    } finally {
      (Illuma as any).__resetPlugins();
    }
  });

  it("restores the context stack when a scanner opens a context then throws", () => {
    const reentrantScanner: iContextScanner = {
      scan: () => {
        (InjectionContext as any).open();
        throw new Error("re-entrant scanner boom");
      },
    };
    Illuma.extendContextScanner(reentrantScanner);

    const state = (globalThis as any)[Symbol.for("@illuma/core/InjectionContextState")];
    const depthBefore = state.stack.length;

    try {
      const c = new NodeContainer();
      c.provide(new NodeToken<number>("REENTRANT_X").withFactory(() => 1));

      expect(state.stack.length).toBe(depthBefore);
      expect(InjectionContext.contextOpen).toBe(false);
      expect(() => nodeInject(new NodeToken<number>("OUTSIDE"))).toThrow(InjectionError);
    } finally {
      (Illuma as any).__resetPlugins();
    }
  });
});

describe("bare declaration tracks opts.factory dependencies", () => {
  it("resolves a bare-declared token whose opts.factory injects another token", () => {
    const VAL = new NodeToken<number>("BARE_VAL");
    const X = new NodeToken<number>("BARE_X", {
      factory: () => nodeInject(VAL) + 1,
    });

    const c = new NodeContainer();
    c.provide(VAL.withValue(7));
    c.provide(X);
    expect(() => c.bootstrap()).not.toThrow();
    expect(c.get(X)).toBe(8);
  });

  it("lets an explicit factory override fully replace opts.factory deps", () => {
    const OPTS_DEP = new NodeToken<number>("OVERRIDE_OPTS_DEP");
    const EXPLICIT_DEP = new NodeToken<number>("OVERRIDE_EXPLICIT_DEP");
    const X = new NodeToken<number>("OVERRIDE_X", {
      factory: () => nodeInject(OPTS_DEP) + 1,
    });

    const c = new NodeContainer();
    c.provide(EXPLICIT_DEP.withValue(100));
    c.provide(X);
    c.provide(X.withFactory(() => nodeInject(EXPLICIT_DEP) + 1));
    // OPTS_DEP is deliberately never provided: the override's deps must fully
    // replace it, otherwise bootstrap would throw on the leaked dependency.
    expect(() => c.bootstrap()).not.toThrow();
    expect(c.get(X)).toBe(101);
  });

  it("resolves a bare-declared singleton with opts.factory across a tree", () => {
    const VAL = new NodeToken<number>("BARE_SINGLETON_VAL", {
      singleton: true,
      factory: () => 5,
    });
    const X = new NodeToken<number>("BARE_SINGLETON_X", {
      singleton: true,
      factory: () => nodeInject(VAL) * 2,
    });

    const parent = new NodeContainer();
    parent.provide(VAL);
    parent.provide(X);
    parent.bootstrap();
    const child = parent.child();
    child.bootstrap();

    expect(child.get(X)).toBe(10);
  });

  it("resolves a bare-declared opts.factory with an absent optional dep", () => {
    const MISSING = new NodeToken<number>("BARE_MISSING");
    const X = new NodeToken<{ v: number | null }>("BARE_OPTIONAL_X", {
      factory: () => ({ v: nodeInject(MISSING, { optional: true }) }),
    });

    const c = new NodeContainer();
    c.provide(X);
    expect(() => c.bootstrap()).not.toThrow();
    expect(c.get(X).v).toBeNull();
  });

  it("still throws notFound for a bare token with no factory and no impl", () => {
    const X = new NodeToken<number>("BARE_NO_FACTORY");

    const c = new NodeContainer();
    c.provide(X);
    expect(() => c.bootstrap()).toThrow(InjectionError);
  });

  it("works with NodeInjectable classes that inject deps", () => {
    const DEP = new NodeToken<string>("CLASS_DEP");

    @NodeInjectable()
    class Service {
      public readonly dep = nodeInject(DEP);
    }

    const c = new NodeContainer();
    c.provide(DEP.withValue("injected"));
    c.provide(Service);
    c.bootstrap();
    expect(c.get(Service).dep).toBe("injected");
  });
});

describe("re-entrant destroy", () => {
  it("treats a guarded re-entrant destroy as a no-op", () => {
    const c = new NodeContainer();
    c.bootstrap();
    const lifecycle = (c as any)._lifecycle;

    let observedDestroyed: boolean | undefined;
    lifecycle.beforeDestroy(() => {
      observedDestroyed = c.destroyed;
      if (!c.destroyed) c.destroy();
    });

    expect(() => c.destroy()).not.toThrow();
    expect(observedDestroyed).toBe(true);
    expect(c.destroyed).toBe(true);
    expect((c as any)._rootNode).toBeUndefined();
  });

  it("reports destroyed as true inside a destroy hook", () => {
    const c = new NodeContainer();
    c.bootstrap();
    const lifecycle = (c as any)._lifecycle;

    let seen = false;
    lifecycle.beforeDestroy(() => {
      seen = lifecycle.destroyed;
    });

    c.destroy();
    expect(seen).toBe(true);
  });

  it("throws (not stack-overflow) on an unguarded re-entrant container destroy", () => {
    const c = new NodeContainer();
    c.bootstrap();
    const lifecycle = (c as any)._lifecycle;
    lifecycle.beforeDestroy(() => c.destroy());

    expect(() => c.destroy()).toThrow(InjectionError);
  });

  it("completes teardown (and surfaces the error) when a destroy hook throws", () => {
    const c = new NodeContainer();
    c.bootstrap();
    const lifecycle = (c as any)._lifecycle;
    lifecycle.beforeDestroy(() => {
      throw new Error("boom");
    });

    expect(() => c.destroy()).toThrow("boom");
    expect(c.destroyed).toBe(true);
    expect(c.bootstrapped).toBe(false);
    expect((c as any)._rootNode).toBeUndefined();
  });

  it("destroys every sibling child even when one child's hook throws", () => {
    const parent = new NodeContainer();
    parent.bootstrap();
    const childA = parent.child() as NodeContainer;
    childA.bootstrap();
    const childB = parent.child() as NodeContainer;
    childB.bootstrap();
    const childC = parent.child() as NodeContainer;
    childC.bootstrap();

    (childB as any)._lifecycle.beforeDestroy(() => {
      throw new Error("flush failed");
    });

    expect(() => parent.destroy()).toThrow("flush failed");

    expect(childA.destroyed).toBe(true);
    expect(childB.destroyed).toBe(true);
    expect(childC.destroyed).toBe(true);
    expect(parent.destroyed).toBe(true);
  });
});

describe("zombie bootstrap / destroyed container hardening", () => {
  it("throws when bootstrapping a destroyed container", () => {
    const c = new NodeContainer();
    c.provide(new NodeToken<number>("ZOMBIE_T").withValue(1));
    c.bootstrap();
    c.destroy();

    expect(() => c.bootstrap()).toThrow(InjectionError);
    try {
      c.bootstrap();
    } catch (e) {
      expect((e as InjectionError).code).toBe(ERR_CODES.DESTROYED);
    }
    expect(c.destroyed).toBe(true);
    expect(c.bootstrapped).toBe(false);
  });

  it("throws when bootstrapping after destroy without prior bootstrap", () => {
    const c = new NodeContainer();
    c.bootstrap();
    c.destroy();
    expect(() => c.bootstrap()).toThrow(InjectionError);
  });

  it("clears _multiProtoNodes on destroy (even when bootstrapped)", () => {
    const MULTI = new MultiNodeToken<number>("ZOMBIE_MULTI");
    const c = new NodeContainer();
    c.provide(MULTI.withValue(1));
    c.bootstrap();
    c.destroy();

    expect((c as any)._protoNodes.size).toBe(0);
    expect((c as any)._multiProtoNodes.size).toBe(0);
  });

  it("throws when providing to a destroyed container", () => {
    const c = new NodeContainer();
    c.bootstrap();
    c.destroy();
    expect(() => c.provide(new NodeToken<number>("ZOMBIE_P").withValue(1))).toThrow(
      InjectionError,
    );
  });

  it("does not resurrect a destroyed child when the parent bootstraps", () => {
    const parent = new NodeContainer();
    const child = parent.child() as NodeContainer;
    child.destroy();

    expect(() => parent.bootstrap()).not.toThrow();
    expect(child.destroyed).toBe(true);
    expect(child.bootstrapped).toBe(false);
  });
});

describe("LifecycleRef still resolvable after the fixes", () => {
  afterEach(() => {
    (Illuma as any).__resetPlugins();
  });

  it("resolves LifecycleRef and Injector built-ins", () => {
    const c = new NodeContainer();
    c.bootstrap();
    expect(c.get(LifecycleRef)).toBeDefined();
    expect(c.get(Injector)).toBeDefined();
  });
});
