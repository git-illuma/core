import { describe, expect, it, vi } from "vitest";
import { NodeToken } from "../../api/token";
import { InjectionError } from "../../errors";
import type { TreeRootNode } from "../../provider";
import { NodeContainer } from "../container";
import type { LifecycleRefImpl } from "../lifecycle";

describe("Container lifecycle", () => {
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

  it("child container should subscribe to parent destroy when created", () => {
    const root = new NodeContainer();
    const lsRef = (<any>root)._lifecycle as LifecycleRefImpl;
    const spy = vi.spyOn(lsRef, "onChildDestroy");

    new NodeContainer({ parent: root });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("should cleanup on destroy", () => {
    const container = new NodeContainer();

    container.provide({
      provide: new NodeToken<string>("test"),
      value: "value",
    });

    container.bootstrap();

    const rootNode = (<any>container)._rootNode as TreeRootNode;
    expect(rootNode).toBeDefined();
    expect(rootNode.dependencies.size).toBe(3); // LifecycleRef, Injector, test

    container.destroy();

    expect(rootNode.dependencies.size).toBe(0);
    expect(((<any>rootNode)._treePool as Map<unknown, unknown>).size).toBe(0);
    expect((<any>container)._rootNode).toBeUndefined();
  });

  it("should throw if destroy is called multiple times", () => {
    const container = new NodeContainer();
    container.destroy();
    expect(() => container.destroy()).toThrowError(InjectionError);
  });
});
