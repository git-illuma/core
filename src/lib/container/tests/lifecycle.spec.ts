import { describe, expect, it, vi } from "vitest";
import { NodeContainer } from "../container";
import { LifecycleRefImpl } from "../lifecycle";

describe("LifecycleRefImpl", () => {
  it("should execute standard hooks in reverse order of registration", () => {
    const lifecycle = new LifecycleRefImpl();
    const order: number[] = [];

    lifecycle.beforeDestroy(() => order.push(1));
    lifecycle.beforeDestroy(() => order.push(2));
    lifecycle.beforeDestroy(() => order.push(3));

    lifecycle.destroy();

    expect(order).toEqual([3, 2, 1]);
  });

  it("should execute child container hooks completely before provider hooks", () => {
    const lifecycle = new LifecycleRefImpl();
    const order: string[] = [];

    lifecycle.beforeDestroy(() => order.push("parentProvider1"));
    lifecycle.onChildDestroy(() => order.push("childContainer1"));
    lifecycle.beforeDestroy(() => order.push("parentProvider2"));
    lifecycle.onChildDestroy(() => order.push("childContainer2"));

    lifecycle.destroy();

    expect(order).toEqual([
      "childContainer2",
      "childContainer1",
      "parentProvider2",
      "parentProvider1",
    ]);
  });

  it("should not leak memory if callbacks do not unsubscribe", () => {
    const lifecycle = new LifecycleRefImpl();

    const cb1 = () => {};
    const cb2 = () => {};
    lifecycle.beforeDestroy(cb1);
    lifecycle.onChildDestroy(cb2);

    lifecycle.destroy();

    const lcAny = lifecycle as unknown as {
      _callbacks: Set<() => void>;
      _childCallbacks: Set<() => void>;
    };
    expect(lcAny._callbacks.size).toBe(0);
    expect(lcAny._childCallbacks.size).toBe(0);
  });

  it("should cascade destroy containers bottom-up", () => {
    const root = new NodeContainer();
    let prev: NodeContainer = root;
    const spy = vi.fn();

    for (let i = 0; i < 5; i++) {
      const child = new NodeContainer({ parent: prev });
      const original = child.destroy.bind(child);
      child.destroy = () => {
        original();
        spy(i);
      };

      prev = child;
    }

    root.destroy();
    expect(spy.mock.calls.map((call) => call[0])).toEqual([4, 3, 2, 1, 0]);
  });

  it("should cascade destroy from parent to child and run in reverse initialization order", () => {
    const parent = new NodeContainer();
    const order: string[] = [];

    (parent as any)._lifecycle.beforeDestroy(() => order.push("parent-provider-1"));

    const child1 = new NodeContainer({ parent });
    (child1 as any)._lifecycle.beforeDestroy(() => order.push("child-1-provider"));

    (parent as any)._lifecycle.beforeDestroy(() => order.push("parent-provider-2"));

    const child2 = new NodeContainer({ parent });
    (child2 as any)._lifecycle.beforeDestroy(() => order.push("child-2-provider"));

    parent.destroy();

    expect(order).toEqual([
      "child-2-provider",
      "child-1-provider",
      "parent-provider-2",
      "parent-provider-1",
    ]);
  });
});
