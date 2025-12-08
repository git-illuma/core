import { MultiNodeToken, NodeInjectable, NodeToken, nodeInject } from "../api";
import { NodeContainer } from "../container";
import { Injector, InjectorImpl } from "./injector";

describe("InjectorImpl", () => {
  describe("get", () => {
    it("should retrieve instance using NodeToken", () => {
      const container = new NodeContainer();
      const token = new NodeToken<string>("testToken");

      container.provide({
        provide: token,
        value: "test-value",
      });

      container.bootstrap();

      const injector = new InjectorImpl(container);
      const result = injector.get(token);

      expect(result).toBe("test-value");
    });

    it("should retrieve instance using constructor", () => {
      const container = new NodeContainer();

      @NodeInjectable()
      class TestService {
        public readonly value = "service-value";
      }

      container.provide(TestService);
      container.bootstrap();

      const injector = new InjectorImpl(container);
      const result = injector.get(TestService);

      expect(result).toBeInstanceOf(TestService);
      expect(result.value).toBe("service-value");
    });

    it("should retrieve array of instances using MultiNodeToken", () => {
      const container = new NodeContainer();
      const token = new MultiNodeToken<string>("multiToken");

      container.provide({
        provide: token,
        value: "value-1",
      });

      container.provide({
        provide: token,
        value: "value-2",
      });

      container.bootstrap();

      const injector = new InjectorImpl(container);
      const result = injector.get(token);

      expect(result).toEqual(["value-1", "value-2"]);
    });

    it("should retrieve instances with dependencies", () => {
      const container = new NodeContainer();

      @NodeInjectable()
      class DependencyService {
        public readonly name = "dependency";
      }

      @NodeInjectable()
      class MainService {
        public readonly dep = nodeInject(DependencyService);
      }

      container.provide(DependencyService);
      container.provide(MainService);
      container.bootstrap();

      const injector = new InjectorImpl(container);
      const result = injector.get(MainService);

      expect(result).toBeInstanceOf(MainService);
      expect(result.dep).toBeInstanceOf(DependencyService);
      expect(result.dep.name).toBe("dependency");
    });
  });
});

describe("Injector token", () => {
  it("should be a NodeToken instance", () => {
    expect(Injector).toBeInstanceOf(NodeToken);
  });

  it("should have correct name", () => {
    expect(Injector.name).toBe("Injector");
  });

  it("should be injectable and usable within services", () => {
    const container = new NodeContainer();
    const serviceToken = new NodeToken<string>("ServiceToken");

    container.provide({
      provide: serviceToken,
      value: "test-service",
    });

    @NodeInjectable()
    class ServiceWithInjector {
      private readonly _injector = nodeInject(Injector);

      public getService() {
        return this._injector.get(serviceToken);
      }
    }

    container.provide(ServiceWithInjector);
    container.bootstrap();

    const service = container.get(ServiceWithInjector);
    const result = service.getService();

    expect(result).toBe("test-service");
  });

  it("should allow accessing other services through injector", () => {
    const container = new NodeContainer();

    @NodeInjectable()
    class ServiceA {
      public readonly name = "A";
    }

    @NodeInjectable()
    class ServiceB {
      public readonly name = "B";
    }

    @NodeInjectable()
    class ServiceWithInjector {
      private readonly _injector = nodeInject(Injector);

      public getServiceA() {
        return this._injector.get(ServiceA);
      }

      public getServiceB() {
        return this._injector.get(ServiceB);
      }
    }

    container.provide(ServiceA);
    container.provide(ServiceB);
    container.provide(ServiceWithInjector);
    container.bootstrap();

    const service = container.get(ServiceWithInjector);

    expect(service.getServiceA()).toBeInstanceOf(ServiceA);
    expect(service.getServiceA().name).toBe("A");
    expect(service.getServiceB()).toBeInstanceOf(ServiceB);
    expect(service.getServiceB().name).toBe("B");
  });

  it("should work with multi-token providers", () => {
    const container = new NodeContainer();
    const pluginToken = new MultiNodeToken<string>("Plugin");

    container.provide({
      provide: pluginToken,
      value: "plugin-1",
    });

    container.provide({
      provide: pluginToken,
      value: "plugin-2",
    });

    @NodeInjectable()
    class PluginManager {
      private readonly _injector = nodeInject(Injector);

      public getPlugins() {
        return this._injector.get(pluginToken);
      }
    }

    container.provide(PluginManager);
    container.bootstrap();

    const manager = container.get(PluginManager);
    const plugins = manager.getPlugins();

    expect(plugins).toEqual(["plugin-1", "plugin-2"]);
  });

  it("should maintain singleton behavior when accessed through injector", () => {
    const container = new NodeContainer();

    @NodeInjectable()
    class SingletonService {
      public readonly id = Math.random();
    }

    @NodeInjectable()
    class ServiceWithInjector {
      private readonly _injector = nodeInject(Injector);

      public getService() {
        return this._injector.get(SingletonService);
      }
    }

    container.provide(SingletonService);
    container.provide(ServiceWithInjector);
    container.bootstrap();

    const service = container.get(ServiceWithInjector);
    const instance1 = service.getService();
    const instance2 = service.getService();
    const directInstance = container.get(SingletonService);

    expect(instance1.id).toBe(instance2.id);
    expect(instance1.id).toBe(directInstance.id);
  });

  describe("produce", () => {
    it("should delegate to container.produce", () => {
      const container = new NodeContainer();

      @NodeInjectable()
      class DependencyService {
        public readonly value = "dependency";
      }

      @NodeInjectable()
      class RuntimeClass {
        public readonly dep = nodeInject(DependencyService);
        public readonly id = Math.random();
      }

      container.provide(DependencyService);
      container.bootstrap();

      const injector = new InjectorImpl(container);
      const instance = injector.produce(RuntimeClass);

      expect(instance).toBeInstanceOf(RuntimeClass);
      expect(instance.dep).toBeInstanceOf(DependencyService);
      expect(instance.dep.value).toBe("dependency");
    });

    it("should work when called from Injector within a service", () => {
      const container = new NodeContainer();

      @NodeInjectable()
      class DependencyService {
        public readonly value = "dependency";
      }

      @NodeInjectable()
      class RuntimeClass {
        public readonly dep = nodeInject(DependencyService);
        public readonly id = Math.random();
      }

      @NodeInjectable()
      class FactoryService {
        private readonly _injector = nodeInject(Injector);

        public createRuntimeInstance() {
          return this._injector.produce(RuntimeClass);
        }
      }

      container.provide(DependencyService);
      container.provide(FactoryService);
      container.bootstrap();

      const factory = container.get(FactoryService);
      const instance1 = factory.createRuntimeInstance();
      const instance2 = factory.createRuntimeInstance();

      expect(instance1).toBeInstanceOf(RuntimeClass);
      expect(instance2).toBeInstanceOf(RuntimeClass);
      expect(instance1.id).not.toBe(instance2.id);
      expect(instance1.dep.value).toBe("dependency");
    });
  });
});
