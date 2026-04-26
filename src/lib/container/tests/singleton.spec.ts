import { describe, expect, it, vi } from "vitest";
import {
  MultiNodeToken,
  makeInjectable,
  NodeInjectable,
  NodeToken,
  nodeInject,
} from "../../api";
import { InjectionError } from "../../errors";
import { NodeContainer } from "../container";

describe("singletons", () => {
  describe("smoke", () => {
    it("should register singletons at root when requested from child", () => {
      const parent = new NodeContainer();
      const childA = new NodeContainer({ parent });
      const childB = new NodeContainer({ parent });
      const childC = new NodeContainer({ parent: childA });

      const spy = vi.fn();

      @NodeInjectable({ singleton: true })
      class RootSingleton {
        public readonly id = Math.random();
        constructor() {
          spy();
        }
      }

      parent.bootstrap();
      childA.bootstrap();
      childB.bootstrap();
      childC.bootstrap();

      const fromA = childA.get(RootSingleton);
      const fromB = childB.get(RootSingleton);
      const fromC = childC.get(RootSingleton);
      const fromRoot = parent.get(RootSingleton);

      expect(fromA).toBe(fromRoot);
      expect(fromB).toBe(fromRoot);
      expect(fromC).toBe(fromRoot);

      // Once for scan, once for actual instantiation
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("should be compatible with regular tokens", () => {
      const parent = new NodeContainer();
      const child = new NodeContainer({ parent });

      const node = new NodeToken<string>("NODE");
      const alias = new NodeToken<{ value: string }>("ALIAS");

      @NodeInjectable({ singleton: true })
      class RootSingleton {
        public readonly value = "singleton-value";
      }

      child.provide([
        node.withFactory(() => {
          const service = nodeInject(RootSingleton);
          return `node-value + ${service.value}`;
        }),

        alias.withAlias(RootSingleton),
      ]);

      parent.bootstrap();
      child.bootstrap();

      const fromChild = child.get(node);
      expect(fromChild).toBe("node-value + singleton-value");
    });

    it("should keep child override for singleton injectable local to that child", () => {
      const parent = new NodeContainer();
      const child = new NodeContainer({ parent });
      const sibling = new NodeContainer({ parent });

      @NodeInjectable({ singleton: true })
      class SharedService {
        public readonly source: string = "root";
      }

      class ChildOverride extends SharedService {
        public override readonly source: string = "child";
      }

      child.provide({
        provide: SharedService,
        useClass: ChildOverride,
      });

      parent.bootstrap();
      child.bootstrap();
      sibling.bootstrap();

      const childInstance = child.get(SharedService);
      const rootInstance = parent.get(SharedService);
      const siblingInstance = sibling.get(SharedService);

      expect(childInstance).toBeInstanceOf(ChildOverride);
      expect(childInstance.source).toBe("child");

      expect(rootInstance.source).toBe("root");
      expect(siblingInstance).toBe(rootInstance);
    });

    it("should only collect root providers in singletons", () => {
      const root = new NodeContainer();
      const child = new NodeContainer({ parent: root });
      const node = new NodeToken<string>("NODE");
      const childOnlyNode = new NodeToken<string>("CHILD_ONLY");

      root.provide({ provide: node, value: "root-node" });
      child.provide([
        { provide: node, value: "child-node" },
        { provide: childOnlyNode, value: "child-only-node" },
      ]);

      @NodeInjectable({ singleton: true })
      class RootSingleton {
        public readonly injected = nodeInject(node);
      }

      @NodeInjectable({ singleton: true })
      class ChildOnlySingleton {
        public readonly injected = nodeInject(childOnlyNode);
      }

      root.bootstrap();
      child.bootstrap();

      const fromRoot = root.get(RootSingleton);
      const fromChild = child.get(RootSingleton);

      expect(fromRoot).toBe(fromChild);
      expect(fromRoot.injected).toBe("root-node");

      expect(() => root.get(ChildOnlySingleton)).toThrow(
        InjectionError.notFound(childOnlyNode),
      );
    });

    it("should allow injecting singletons into other singletons", () => {
      const root = new NodeContainer();
      const child = new NodeContainer({ parent: root });

      @NodeInjectable({ singleton: true })
      class SingletonA {
        public readonly value = "root-singleton";
      }

      @NodeInjectable({ singleton: true })
      class SingletonB {
        public readonly injected = nodeInject(SingletonA);
      }

      root.bootstrap();
      child.bootstrap();

      const fromRoot = root.get(SingletonB);
      const fromChild = child.get(SingletonB);

      expect(fromRoot).toBe(fromChild);
      expect(fromChild.injected).toBeInstanceOf(SingletonA);
      expect(fromChild.injected.value).toBe("root-singleton");
    });

    it("should throw not found error from singleton if requested node is downstream", () => {
      const root = new NodeContainer();
      const child = new NodeContainer({ parent: root });
      const node = new NodeToken<string>("NODE");

      child.provide({ provide: node, value: "child-node" });

      @NodeInjectable({ singleton: true })
      class RootSingleton {
        public readonly injected = nodeInject(node);
      }

      root.bootstrap();
      child.bootstrap();

      expect(() => root.get(RootSingleton)).toThrow(InjectionError.notFound(node));
    });

    it("should not allow circular dependencies between singletons", () => {
      const root = new NodeContainer();

      @NodeInjectable({ singleton: true })
      class SingletonA {
        public readonly injected = nodeInject(SingletonB);
      }

      @NodeInjectable({ singleton: true })
      class SingletonB {
        public readonly injected = nodeInject(SingletonA);
      }

      root.bootstrap();

      expect(() => root.get(SingletonA)).toThrow(InjectionError);
    });

    it("NodeToken should also support singleton option", () => {
      const root = new NodeContainer();
      const child = new NodeContainer({ parent: root });

      const singletonToken = new NodeToken<string>("SINGLETON", {
        singleton: true,
        factory: () => "singleton-value",
      });

      root.provide(singletonToken);
      root.bootstrap();
      child.bootstrap();

      const fromRoot = root.get(singletonToken);
      const fromChild = child.get(singletonToken);

      expect(fromRoot).toBe(fromChild);
      expect(fromRoot).toBe("singleton-value");
    });

    it("should error normally when singleton dependency is not found", () => {
      const root = new NodeContainer();
      const node = new NodeToken<string>("MISSING");

      @NodeInjectable({ singleton: true })
      class RootSingleton {
        public readonly injected = nodeInject(node);
      }

      root.bootstrap();

      expect(() => root.get(RootSingleton)).toThrow(InjectionError.notFound(node));
    });
  });

  describe("api", () => {
    it("should support root singleton semantics with makeInjectable", () => {
      const parent = new NodeContainer();
      const child = new NodeContainer({ parent });
      const sibling = new NodeContainer({ parent });

      const spy = vi.fn();

      class _SharedService {
        public readonly id = Math.random();
        constructor() {
          spy();
        }
      }

      const SharedService = makeInjectable(_SharedService, { singleton: true });

      parent.bootstrap();
      child.bootstrap();
      sibling.bootstrap();

      const fromChild = child.get(SharedService);
      const fromSibling = sibling.get(SharedService);

      expect(fromChild).toBe(fromSibling);
      expect(fromChild).toBe(parent.get(SharedService));

      // Once for scan, once for actual instantiation
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("should allow creating singleton with makeInjectable", () => {
      const root = new NodeContainer();
      const child = new NodeContainer({ parent: root });

      class _SingletonClass {
        public readonly value = "singleton-value";
      }

      const SingletonClass = makeInjectable(_SingletonClass, { singleton: true });

      root.bootstrap();
      child.bootstrap();

      const instanceFromRoot = root.get(SingletonClass);
      const instanceFromChild = child.get(SingletonClass);

      expect(instanceFromRoot).toBe(instanceFromChild);
      expect(instanceFromRoot.value).toBe("singleton-value");
    });
  });

  describe("injections", () => {
    it("should allow accessing singletons when aliased to multi tokens", () => {
      const root = new NodeContainer();
      const container = new NodeContainer({ parent: root });
      const multiToken = new MultiNodeToken<{ value: string }>("MULTI");

      @NodeInjectable({ singleton: true })
      class Single {
        public readonly value = "single-value";
      }

      container.provide([
        multiToken.withAlias(Single),
        multiToken.withValue({ value: "direct-value" }),
      ]);

      container.bootstrap();
      expect(container.get(multiToken)).toEqual([
        { value: "single-value" },
        { value: "direct-value" },
      ]);
    });

    it("should create dynamic singleton on root from child", () => {
      const parent = new NodeContainer();
      parent.bootstrap();

      const child = new NodeContainer({ parent });
      child.bootstrap();

      const MyGlobal = new NodeToken<string>("Global", {
        singleton: true,
        factory: () => "global",
      });
      const instance1 = child.get(MyGlobal);
      const instance2 = child.get(MyGlobal);
      const instance3 = parent.get(MyGlobal);

      expect(instance1).toBe("global");
      expect(instance2).toBe("global");
      expect(instance3).toBe("global");
    });

    it("should automatically destroy child when parent destroyed", () => {
      const parent = new NodeContainer();
      const child = new NodeContainer({ parent });
      parent.destroy();
      expect(child.destroyed).toBe(true);
    });

    it("should set factory on existing proto if missing and return null before root bootstrapped", () => {
      const parent = new NodeContainer();
      const TheToken = new NodeToken<string>("MutantGlobal", { singleton: true });

      parent.provide(TheToken);

      Object.defineProperty(TheToken, "opts", {
        value: { singleton: true, factory: () => "new-factory" },
      });

      const child = new NodeContainer({ parent });
      const result = (
        child as unknown as {
          _getRootSingleton: (token: NodeToken<string>, inst: boolean) => unknown;
        }
      )._getRootSingleton(TheToken, true);

      expect(result).toBeNull();

      const proto = (
        parent as unknown as {
          _protoNodes: Map<NodeToken<string>, { hasFactory: () => boolean }>;
        }
      )._protoNodes.get(TheToken);

      expect(proto?.hasFactory()).toBe(true);
    });
  });

  describe("instantiation", () => {
    it("should defer root singleton registration from child resolution until first injection", () => {
      const ctorSpy = vi.fn();
      const parent = new NodeContainer({ instant: false });
      const child = new NodeContainer({ parent, instant: false });

      @NodeInjectable({ singleton: true })
      class RootSingleton {
        public constructor() {
          ctorSpy();
        }
      }

      @NodeInjectable()
      class ChildConsumer {
        public readonly singleton = nodeInject(RootSingleton);
      }

      child.provide(ChildConsumer);

      parent.bootstrap();
      child.bootstrap();

      // Dry run
      expect(ctorSpy).toHaveBeenCalledTimes(1);

      const instance = child.get(ChildConsumer);
      expect(instance.singleton).toBe(parent.get(RootSingleton));
      expect(ctorSpy).toHaveBeenCalledTimes(2);
    });

    it("should instantiate singleton immediately when root is instant", () => {
      const ctorSpy = vi.fn();
      const parent = new NodeContainer();
      const child = new NodeContainer({ parent });

      @NodeInjectable({ singleton: true })
      class RootSingleton {
        public constructor() {
          ctorSpy();
        }
      }

      @NodeInjectable()
      class ChildConsumer {
        public readonly singleton = nodeInject(RootSingleton);
      }

      child.provide(ChildConsumer);

      parent.bootstrap();
      child.bootstrap();

      // One dry run + one eager instantiation at registration time.
      expect(ctorSpy).toHaveBeenCalledTimes(2);
      const fromParent = parent.get(RootSingleton);
      expect(child.get(ChildConsumer).singleton).toBe(fromParent);
      expect(ctorSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("deferred containers", () => {
    it("should allow instantiating singletons when parent is already bootstrapped", () => {
      const node = new NodeToken<string>("NODE");

      const root = new NodeContainer();

      root.provide({ provide: node, value: "singleton-value" });
      root.bootstrap();

      const child = new NodeContainer({ parent: root, instant: false });

      @NodeInjectable({ singleton: true })
      class RootSingleton {
        public readonly value = nodeInject(node);
      }

      @NodeInjectable()
      class ChildConsumer {
        public readonly singleton = nodeInject(RootSingleton);
      }

      child.provide(ChildConsumer);
      child.bootstrap();

      const fromRoot = root.get(RootSingleton);
      const fromChild = child.get(RootSingleton);
      const fromConsumer = child.get(ChildConsumer);

      expect(fromChild).toBe(fromRoot);
      expect(fromChild.value).toBe("singleton-value");
      expect(fromConsumer.singleton).toBe(fromRoot);
    });

    it("should access singletons when producing class", () => {
      const container = new NodeContainer({ instant: false });

      @NodeInjectable({ singleton: true })
      class RootSingleton {
        public readonly value = "singleton value";
      }

      @NodeInjectable()
      class Something {
        private readonly singleton = nodeInject(RootSingleton);
        public readonly result = `produced + ${this.singleton.value}`;
      }

      container.bootstrap();

      const { result } = container.produce(Something);
      expect(result).toBe("produced + singleton value");
    });

    it("should access singletons when producing with arrow function", () => {
      const container = new NodeContainer({ instant: false });

      @NodeInjectable({ singleton: true })
      class RootSingleton {
        public readonly value = "singleton value";
      }

      container.bootstrap();

      const result = container.produce(() => {
        const singleton = nodeInject(RootSingleton);
        return `produced + ${singleton.value}`;
      });

      expect(result).toBe("produced + singleton value");
    });
  });
});
