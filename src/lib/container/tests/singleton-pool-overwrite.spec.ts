import { describe, expect, it } from "vitest";
import {
  injectDefer,
  MultiNodeToken,
  NodeInjectable,
  nodeInject,
  Service,
} from "../../../index";
import { NodeContainer } from "../container";

describe("singleton root-pool overwrite (2.3.0 regression)", () => {
  it("minimal: a defer-only / get()-first singleton is shared, not duplicated", () => {
    let instances = 0;

    @Service()
    class Catalog {
      public readonly id = ++instances;
      private readonly _m = new Map<string, number>();
      public fill(): void {
        this._m.set("x", 1);
      }
      public size(): number {
        return this._m.size;
      }
    }

    @Service()
    class Consumer {
      public readonly cat = nodeInject(Catalog);
    }

    const c = new NodeContainer({ instant: false });
    c.bootstrap();

    const first = c.get(Catalog);
    first.fill();

    const consumer = c.get(Consumer);

    expect(consumer.cat).toBe(first);
    expect(consumer.cat.size()).toBe(1);
    expect(c.get(Catalog)).toBe(first);
  });

  it("production-shaped: ASYNC_INIT thunk reaching the catalog via injectDefer", () => {
    const INIT = new MultiNodeToken<() => void>("INIT");
    let instances = 0;

    @Service()
    class Catalog {
      public readonly id = ++instances;
      private readonly _m = new Map<string, number>();
      public start(): void {
        this._m.set("x", 1);
      }
      public size(): number {
        return this._m.size;
      }
    }

    const startHook = INIT.withFactory(() => {
      const get = injectDefer(Catalog);
      return () => get().start();
    });

    @Service()
    class App {
      private readonly _init = nodeInject(INIT);
      public run(): void {
        for (const fn of this._init) fn();
      }
    }

    @Service()
    class Consumer {
      public readonly cat = nodeInject(Catalog);
    }

    const c = new NodeContainer({ instant: false });
    c.provide([startHook]);
    c.bootstrap();

    c.get(App).run();
    const consumer = c.get(Consumer);

    expect(consumer.cat.size()).toBe(1);
    expect(consumer.cat).toBe(c.get(Catalog));
  });

  it("eager get() before the consumer no longer splits", () => {
    @Service()
    class Catalog {
      private readonly _m = new Map<string, number>();
      public fill(): void {
        this._m.set("x", 1);
      }
      public size(): number {
        return this._m.size;
      }
    }

    @Service()
    class Consumer {
      public readonly cat = nodeInject(Catalog);
    }

    const c = new NodeContainer({ instant: false });
    c.bootstrap();

    const eager = c.get(Catalog);
    eager.fill();

    expect(c.get(Consumer).cat).toBe(eager);
    expect(c.get(Consumer).cat.size()).toBe(1);
  });

  it("holds in instant mode as well", () => {
    @Service()
    class Catalog {
      private readonly _m = new Map<string, number>();
      public fill(): void {
        this._m.set("x", 1);
      }
      public size(): number {
        return this._m.size;
      }
    }

    @Service()
    class Consumer {
      public readonly cat = nodeInject(Catalog);
    }

    const c = new NodeContainer({ instant: true });
    c.bootstrap();

    const first = c.get(Catalog);
    first.fill();

    expect(c.get(Consumer).cat).toBe(first);
    expect(c.get(Consumer).cat.size()).toBe(1);
  });

  describe("ablation — every wiring shares a single instance", () => {
    const make = (
      reach: "defer" | "direct",
      provide: boolean,
    ): { sizeSeen: () => number; same: () => boolean } => {
      const INIT = new MultiNodeToken<() => void>("INIT");

      @Service()
      class Catalog {
        private readonly _m = new Map<string, number>();
        public start(): void {
          this._m.set("x", 1);
        }
        public size(): number {
          return this._m.size;
        }
      }

      const startHook = INIT.withFactory(() => {
        if (reach === "defer") {
          const get = injectDefer(Catalog);
          return () => get().start();
        }
        const cat = nodeInject(Catalog);
        return () => cat.start();
      });

      @Service()
      class App {
        private readonly _init = nodeInject(INIT);
        public run(): void {
          for (const fn of this._init) fn();
        }
      }

      @Service()
      class Consumer {
        public readonly cat = nodeInject(Catalog);
      }

      const c = new NodeContainer({ instant: false });
      c.provide([startHook]);
      if (provide) c.provide([Catalog]);
      c.bootstrap();

      c.get(App).run();
      const consumer = c.get(Consumer);

      return {
        sizeSeen: () => consumer.cat.size(),
        same: () => consumer.cat === c.get(Catalog),
      };
    };

    it.each([
      ["defer", false],
      ["direct", false],
      ["defer", true],
      ["direct", true],
    ] as const)("reach=%s provider=%s", (reach, provide) => {
      const r = make(reach, provide);
      expect(r.sizeSeen()).toBe(1);
      expect(r.same()).toBe(true);
    });
  });

  it("aliasing a root singleton into a child multi-token shares the root instance", () => {
    const PLUGINS = new MultiNodeToken<{ state: number }>("PLUGINS");

    @NodeInjectable({ singleton: true })
    class Catalog {
      public state = 0;
    }

    @Service()
    class Consumer {
      public readonly cat = nodeInject(Catalog);
    }

    const parent = new NodeContainer({ instant: false });
    parent.bootstrap();
    const child = new NodeContainer({ parent, instant: false });
    child.provide([PLUGINS.withAlias(Catalog), PLUGINS.withValue({ state: -1 })]);
    child.bootstrap();

    const viaPlugins = child.get(PLUGINS).find((p) => p.state === 0);
    // biome-ignore lint/style/noNonNullAssertion: the aliased entry is present
    viaPlugins!.state = 99;

    expect(child.get(Catalog)).toBe(viaPlugins);
    expect(parent.get(Catalog)).toBe(viaPlugins);
    expect(parent.get(Catalog).state).toBe(99);
    expect(child.get(Consumer).cat).toBe(viaPlugins);

    expect(
      child
        .get(PLUGINS)
        .map((p) => p.state)
        .sort(),
    ).toEqual([-1, 99]);
  });

  it("aliasing a singleton into a multi-token within a single container shares it", () => {
    const PLUGINS = new MultiNodeToken<{ state: number }>("PLUGINS");

    @NodeInjectable({ singleton: true })
    class Catalog {
      public state = 0;
    }

    const c = new NodeContainer({ instant: false });
    c.provide([PLUGINS.withAlias(Catalog)]);
    c.bootstrap();

    const viaPlugins = c.get(PLUGINS)[0];
    viaPlugins.state = 7;

    expect(c.get(Catalog)).toBe(viaPlugins);
    expect(c.get(Catalog).state).toBe(7);
  });

  it("does not regress cross-container singleton sharing", () => {
    @NodeInjectable({ singleton: true })
    class Catalog {
      private readonly _m = new Map<string, number>();
      public fill(): void {
        this._m.set("x", 1);
      }
      public size(): number {
        return this._m.size;
      }
    }

    const parent = new NodeContainer({ instant: false });
    parent.bootstrap();
    const child = new NodeContainer({ parent, instant: false });
    child.bootstrap();

    const fromChild = child.get(Catalog);
    fromChild.fill();

    expect(parent.get(Catalog)).toBe(fromChild);
    expect(parent.get(Catalog).size()).toBe(1);
  });
});
