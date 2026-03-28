import { describe, expect, it } from "vitest";
import { MultiNodeToken, NodeInjectable, NodeToken, nodeInject } from "../../api";
import { InjectionError } from "../../errors";
import { NodeContainer } from "../container";

describe("produce", () => {
  it("should instantiate a class with dependencies at runtime", () => {
    const container = new NodeContainer();

    @NodeInjectable()
    class DependencyService {
      public readonly value = "dependency-value";
    }

    @NodeInjectable()
    class RuntimeClass {
      public readonly dep = nodeInject(DependencyService);
      public readonly id = Math.random();
    }

    container.provide(DependencyService);
    container.bootstrap();

    const instance = container.produce(RuntimeClass);

    expect(instance).toBeInstanceOf(RuntimeClass);
    expect(instance.dep).toBeInstanceOf(DependencyService);
    expect(instance.dep.value).toBe("dependency-value");
  });

  it("should create new instances on each call", () => {
    const container = new NodeContainer();

    @NodeInjectable()
    class RuntimeClass {
      public readonly id = Math.random();
    }

    container.bootstrap();

    const instance1 = container.produce(RuntimeClass);
    const instance2 = container.produce(RuntimeClass);

    expect(instance1).toBeInstanceOf(RuntimeClass);
    expect(instance2).toBeInstanceOf(RuntimeClass);
    expect(instance1.id).not.toBe(instance2.id);
  });

  it("should not register class in container", () => {
    const container = new NodeContainer();

    @NodeInjectable()
    class RuntimeClass {
      public readonly value = "runtime";
    }

    container.bootstrap();

    container.produce(RuntimeClass);

    // Trying to get the class should throw since it was never provided
    expect(() => container.get(RuntimeClass)).toThrow(InjectionError);
  });

  it("should throw if called before bootstrap", () => {
    const container = new NodeContainer();

    @NodeInjectable()
    class RuntimeClass {
      public readonly value = "runtime";
    }

    expect(() => container.produce(RuntimeClass)).toThrow(InjectionError);
  });

  it("should not throw for non-injectable constructor", () => {
    const container = new NodeContainer();

    class NotInjectable {
      public readonly value = "not-injectable";
    }

    container.bootstrap();

    expect(() => container.produce(NotInjectable)).toThrow(InjectionError);
  });

  it("should work with complex dependency chains", () => {
    const container = new NodeContainer();

    @NodeInjectable()
    class ServiceA {
      public readonly name = "A";
    }

    @NodeInjectable()
    class ServiceB {
      public readonly dep = nodeInject(ServiceA);
      public readonly name = "B";
    }

    @NodeInjectable()
    class ServiceC {
      public readonly depB = nodeInject(ServiceB);
      public readonly name = "C";
    }

    @NodeInjectable()
    class RuntimeClass {
      public readonly serviceC = nodeInject(ServiceC);
    }

    container.provide(ServiceA);
    container.provide(ServiceB);
    container.provide(ServiceC);
    container.bootstrap();

    const instance = container.produce(RuntimeClass);

    expect(instance.serviceC).toBeInstanceOf(ServiceC);
    expect(instance.serviceC.name).toBe("C");
    expect(instance.serviceC.depB).toBeInstanceOf(ServiceB);
    expect(instance.serviceC.depB.name).toBe("B");
    expect(instance.serviceC.depB.dep).toBeInstanceOf(ServiceA);
    expect(instance.serviceC.depB.dep.name).toBe("A");
  });

  it("should share instances with container", () => {
    const container = new NodeContainer();

    @NodeInjectable()
    class Service {
      public readonly id = Math.random();
    }

    @NodeInjectable()
    class RuntimeClass {
      public readonly service = nodeInject(Service);
    }

    container.provide(Service);
    container.bootstrap();

    const containerInstance = container.get(Service);
    const runtime1 = container.produce(RuntimeClass);
    const runtime2 = container.produce(RuntimeClass);

    expect(runtime1.service).toBe(containerInstance);
    expect(runtime2.service).toBe(containerInstance);
  });

  it("should work with token-based dependencies", () => {
    const container = new NodeContainer();
    const configToken = new NodeToken<{ apiKey: string }>("Config");
    const loggerToken = new NodeToken<{ log: (msg: string) => void }>("Logger");

    @NodeInjectable()
    class RuntimeClass {
      public readonly config = nodeInject(configToken);
      public readonly logger = nodeInject(loggerToken);
    }

    container.provide({
      provide: configToken,
      value: { apiKey: "test-key" },
    });

    container.provide({
      provide: loggerToken,
      factory: () => ({ log: (msg: string) => msg }),
    });

    container.bootstrap();

    const instance = container.produce(RuntimeClass);

    expect(instance.config.apiKey).toBe("test-key");
    expect(instance.logger.log("test")).toBe("test");
  });

  it("should work with optional dependencies", () => {
    const container = new NodeContainer();
    const optionalToken = new NodeToken<string>("Optional");
    const requiredToken = new NodeToken<string>("Required");

    @NodeInjectable()
    class RuntimeClass {
      public readonly optional = nodeInject(optionalToken, { optional: true });
      public readonly required = nodeInject(requiredToken);
    }

    container.provide({
      provide: requiredToken,
      value: "required-value",
    });

    container.bootstrap();

    const instance = container.produce(RuntimeClass);

    expect(instance.optional).toBeNull();
    expect(instance.required).toBe("required-value");
  });

  it("should throw when required dependency is missing", () => {
    const container = new NodeContainer();

    @NodeInjectable()
    class MissingService {
      public readonly value = "missing";
    }

    @NodeInjectable()
    class RuntimeClass {
      public readonly dep = nodeInject(MissingService);
    }

    container.bootstrap();

    expect(() => container.produce(RuntimeClass)).toThrow(InjectionError);
  });

  it("should work with multi-token dependencies", () => {
    const container = new NodeContainer();
    const pluginToken = new MultiNodeToken<{ name: string }>("Plugin");

    @NodeInjectable()
    class RuntimeClass {
      public readonly plugins = nodeInject(pluginToken);
    }

    container.provide({
      provide: pluginToken,
      value: { name: "plugin-1" },
    });

    container.provide({
      provide: pluginToken,
      value: { name: "plugin-2" },
    });

    container.bootstrap();

    const instance = container.produce(RuntimeClass);

    expect(instance.plugins).toHaveLength(2);
    expect(instance.plugins[0].name).toBe("plugin-1");
    expect(instance.plugins[1].name).toBe("plugin-2");
  });

  it("should allow producing classes with constructor parameters", () => {
    const container = new NodeContainer();

    @NodeInjectable()
    class DependencyService {
      public readonly value = "dependency";
    }

    @NodeInjectable()
    class RuntimeClass {
      public readonly dep = nodeInject(DependencyService);
      public readonly custom: string;

      constructor() {
        this.custom = "custom-value";
      }
    }

    container.provide(DependencyService);
    container.bootstrap();

    const instance = container.produce(RuntimeClass);

    expect(instance.dep.value).toBe("dependency");
    expect(instance.custom).toBe("custom-value");
  });

  it("should work with a factory function", () => {
    const container = new NodeContainer();

    @NodeInjectable()
    class DependencyService {
      public readonly value = "from-dependency";
    }

    container.provide(DependencyService);
    container.bootstrap();

    const result = container.produce(() => {
      const dep = nodeInject(DependencyService);
      return { computed: `${dep.value}-computed` };
    });

    expect(result.computed).toBe("from-dependency-computed");
  });

  it("should create new results on each factory call", () => {
    const container = new NodeContainer();

    container.bootstrap();

    const result1 = container.produce(() => ({ id: Math.random() }));
    const result2 = container.produce(() => ({ id: Math.random() }));

    expect(result1.id).not.toBe(result2.id);
  });

  it("should allow factory to inject token-based dependencies", () => {
    const container = new NodeContainer();
    const configToken = new NodeToken<{ apiUrl: string }>("Config");

    container.provide({
      provide: configToken,
      value: { apiUrl: "https://api.example.com" },
    });

    container.bootstrap();

    const result = container.produce(() => {
      const config = nodeInject(configToken);
      return { url: config.apiUrl, timestamp: Date.now() };
    });

    expect(result.url).toBe("https://api.example.com");
    expect(result.timestamp).toBeDefined();
  });

  it("should allow factory with optional dependencies", () => {
    const container = new NodeContainer();
    const optionalToken = new NodeToken<string>("Optional");

    container.bootstrap();

    const result = container.produce(() => {
      const optional = nodeInject(optionalToken, { optional: true });
      return { value: optional ?? "default" };
    });

    expect(result.value).toBe("default");
  });

  it("should throw from factory when required dependency is missing", () => {
    const container = new NodeContainer();
    const missingToken = new NodeToken<string>("Missing");

    container.bootstrap();

    expect(() =>
      container.produce(() => {
        const value = nodeInject(missingToken);
        return { value };
      }),
    ).toThrow(InjectionError);
  });

  it("should allow factory to inject multi-token dependencies", () => {
    const container = new NodeContainer();
    const pluginToken = new MultiNodeToken<{ name: string }>("Plugin");

    container.provide({
      provide: pluginToken,
      value: { name: "plugin-a" },
    });

    container.provide({
      provide: pluginToken,
      value: { name: "plugin-b" },
    });

    container.bootstrap();

    const result = container.produce(() => {
      const plugins = nodeInject(pluginToken);
      return { pluginNames: plugins.map((p) => p.name) };
    });

    expect(result.pluginNames).toEqual(["plugin-a", "plugin-b"]);
  });
});
