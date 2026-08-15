import { afterEach, describe, expect, it, vi } from "vitest";
import { Illuma } from "../../global";
import { NodeContainer } from "../container";

function childHookCount(container: NodeContainer): number {
  return (container as any)._lifecycle._destroyChildCallbacks.size;
}

const gc = (globalThis as { gc?: () => void }).gc;

/**
 * Yields long enough for V8 to run FinalizationRegistry callbacks, which are
 * scheduled on a separate task after a collection.
 */
async function collect(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    gc?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("weakParentLink", () => {
  it("still destroys a reachable child through the parent cascade", () => {
    const parent = new NodeContainer();
    parent.bootstrap();

    const child = new NodeContainer({ parent, weakParentLink: true });
    child.bootstrap();

    expect(child.destroyed).toBe(false);
    parent.destroy();
    expect(child.destroyed).toBe(true);
  });

  it("still cascades bootstrap from a parent bootstrapped later", () => {
    const parent = new NodeContainer();
    const child = new NodeContainer({ parent, weakParentLink: true });

    expect(child.bootstrapped).toBe(false);
    parent.bootstrap();
    expect(child.bootstrapped).toBe(true);
  });

  it("does not double-destroy a child that was already destroyed", () => {
    const parent = new NodeContainer();
    parent.bootstrap();

    const child = new NodeContainer({ parent, weakParentLink: true });
    child.bootstrap();
    child.destroy();

    expect(() => parent.destroy()).not.toThrow();
  });

  it("releases the parent registration when the child is destroyed", () => {
    const parent = new NodeContainer();
    parent.bootstrap();

    const child = new NodeContainer({ parent, weakParentLink: true });
    child.bootstrap();
    expect(childHookCount(parent)).toBe(1);

    child.destroy();
    expect(childHookCount(parent)).toBe(0);
  });

  it("keeps the default link strong, so behaviour is unchanged without the flag", () => {
    const parent = new NodeContainer();
    parent.bootstrap();

    const child = new NodeContainer({ parent });
    child.bootstrap();

    expect(childHookCount(parent)).toBe(1);
    parent.destroy();
    expect(child.destroyed).toBe(true);
  });

  it.runIf(gc)(
    "lets an abandoned weakly linked child be collected, pruning the parent hook",
    async () => {
      const parent = new NodeContainer();
      parent.bootstrap();

      let ref!: WeakRef<NodeContainer>;
      (() => {
        const orphan = new NodeContainer({ parent, weakParentLink: true });
        orphan.bootstrap();
        ref = new WeakRef(orphan);
      })();

      expect(childHookCount(parent)).toBe(1);

      await collect();

      expect(ref.deref()).toBeUndefined();
      expect(childHookCount(parent)).toBe(0);
    },
  );

  it.runIf(gc)(
    "retains an abandoned child forever under the default strong link",
    async () => {
      const parent = new NodeContainer();
      parent.bootstrap();

      let ref!: WeakRef<NodeContainer>;
      (() => {
        const orphan = new NodeContainer({ parent });
        orphan.bootstrap();
        ref = new WeakRef(orphan);
      })();

      await collect();

      expect(ref.deref()).toBeDefined();
      expect(childHookCount(parent)).toBe(1);
    },
  );
});

describe("child(options)", () => {
  it("forwards options to the child", () => {
    const parent = new NodeContainer();
    parent.bootstrap();

    const child = parent.child({ weakParentLink: true }) as NodeContainer;
    child.bootstrap();
    expect(childHookCount(parent)).toBe(1);

    child.destroy();
    expect(childHookCount(parent)).toBe(0);
  });

  it("keeps itself as the parent even when the options try to name another", () => {
    const parent = new NodeContainer();
    parent.bootstrap();

    const stranger = new NodeContainer();
    stranger.bootstrap();

    const child = parent.child({ parent: stranger } as never) as NodeContainer;
    child.bootstrap();

    expect(childHookCount(parent)).toBe(1);
    expect(childHookCount(stranger)).toBe(0);

    parent.destroy();
    expect(child.destroyed).toBe(true);
  });
});

describe("weakParentLink on an engine that lacks the ES2021 primitives", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    Illuma.setLogger(null);
  });

  async function withMissing(global: "WeakRef" | "FinalizationRegistry") {
    vi.stubGlobal(global, undefined);
    vi.resetModules();

    const warn = vi.fn();
    Illuma.setLogger({ log: vi.fn(), warn, error: vi.fn() });

    const { NodeContainer: Fresh } = await import("../container");
    return { Fresh, warn };
  }

  it("falls back to a strong link without WeakRef, and says so once", async () => {
    const { Fresh, warn } = await withMissing("WeakRef");

    const parent = new Fresh();
    parent.bootstrap();

    const child = new Fresh({ parent, weakParentLink: true });
    child.bootstrap();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("WeakRef"));

    const second = new Fresh({ parent, weakParentLink: true });
    second.bootstrap();
    expect(warn).toHaveBeenCalledTimes(1);

    parent.destroy();
    expect(child.destroyed).toBe(true);
    expect(second.destroyed).toBe(true);
  });

  it("falls back without FinalizationRegistry too, rather than never pruning", async () => {
    const { Fresh, warn } = await withMissing("FinalizationRegistry");

    const parent = new Fresh();
    parent.bootstrap();

    const child = new Fresh({ parent, weakParentLink: true });
    child.bootstrap();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(childHookCount(parent as NodeContainer)).toBe(1);

    parent.destroy();
    expect(child.destroyed).toBe(true);
  });
});
