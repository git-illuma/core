import { NodeInjectable, NodeToken } from "../api";
import { NodeContainer } from "../container";
import { injectDefer } from "./defer";

describe("injectDefer", () => {
  let container: NodeContainer;

  beforeEach(() => {
    container = new NodeContainer();
  });

  it("should inject lazily using NodeToken", () => {
    const token = new NodeToken<string>("token");

    @NodeInjectable()
    class Service {
      private readonly lazy = injectDefer(token);

      get value() {
        return this.lazy();
      }
    }

    container.provide({ provide: token, value: "value" });
    container.provide(Service);
    container.bootstrap();

    const service = container.get(Service);
    expect(service.value).toBe("value");
  });

  it("should inject lazily using Class constructor", () => {
    @NodeInjectable()
    class Dependency {
      val = "dependency";
    }

    @NodeInjectable()
    class Service {
      private readonly lazy = injectDefer(Dependency);

      get dependency() {
        return this.lazy();
      }
    }

    container.provide(Dependency);
    container.provide(Service);
    container.bootstrap();

    const service = container.get(Service);
    expect(service.dependency).toBeInstanceOf(Dependency);
    expect(service.dependency.val).toBe("dependency");
  });

  it("should cache the instance after first resolution", () => {
    let count = 0;
    const token = new NodeToken<string>("token");

    @NodeInjectable()
    class Service {
      public readonly lazy = injectDefer(token);
    }

    container.provide({
      provide: token,
      factory: () => {
        count++;
        return "value";
      },
    });
    container.provide(Service);
    container.bootstrap();

    const service = container.get(Service);
    // Factory is called twice: once during scan (provider registration) and once during instantiation (eager bootstrap)
    expect(count).toBe(2);

    expect(service.lazy()).toBe("value");
    expect(count).toBe(2); // Still 2, cached

    expect(service.lazy()).toBe("value");
    expect(count).toBe(2); // Still 2, cached
  });

  it("should handle optional injection when dependency is missing", () => {
    const token = new NodeToken<string>("missing");

    @NodeInjectable()
    class Service {
      public readonly lazy = injectDefer(token, { optional: true });
    }

    container.provide(Service);
    container.bootstrap();

    const service = container.get(Service);
    expect(service.lazy()).toBeNull();
  });

  it("should handle optional injection when dependency is missing (subsequent calls)", () => {
    const token = new NodeToken<string>("missing");

    @NodeInjectable()
    class Service {
      public readonly lazy = injectDefer(token, { optional: true });
    }

    container.provide(Service);
    container.bootstrap();

    const service = container.get(Service);
    expect(service.lazy()).toBeNull();
    expect(service.lazy()).toBeNull();
  });

  it("should throw for non-optional missing dependency", () => {
    const token = new NodeToken<string>("missing");

    @NodeInjectable()
    class Service {
      public readonly lazy = injectDefer(token);
    }

    container.provide(Service);
    container.bootstrap();

    const service = container.get(Service);
    expect(() => service.lazy()).toThrow();
  });

  it("should solve simple recursion issues", () => {
    @NodeInjectable()
    class ServiceA {
      private readonly lazyB = injectDefer(ServiceB);

      get serviceB() {
        return this.lazyB();
      }
    }

    @NodeInjectable()
    class ServiceB {
      private readonly lazyA = injectDefer(ServiceA);

      get serviceA() {
        return this.lazyA();
      }
    }

    container.provide(ServiceA);
    container.provide(ServiceB);

    expect(() => {
      container.bootstrap();
    }).not.toThrow();

    const serviceA = container.get(ServiceA);
    const serviceBInjected = serviceA.serviceB;

    const serviceB = container.get(ServiceB);
    const serviceAInjected = serviceB.serviceA;

    expect(serviceBInjected).toBeInstanceOf(ServiceB);
    expect(serviceAInjected).toBeInstanceOf(ServiceA);
    expect(serviceAInjected).toBe(serviceA);
    expect(serviceBInjected).toBe(serviceB);
  });

  it("should throw for invalid provider", () => {
    @NodeInjectable()
    class Service {
      public readonly lazy = injectDefer("invalid" as any);
    }

    container.provide(Service);

    expect(() => container.bootstrap()).toThrow();
  });

  it("should rethrow non-not-found errors in optional mode", () => {
    const token = new NodeToken<string>("error-token");
    const error = new Error("Runtime Error");

    @NodeInjectable()
    class Service {
      public readonly lazy = injectDefer(token, { optional: true });
    }

    container.provide({ provide: token, value: "value" });
    container.provide(Service);
    container.bootstrap();

    const service = container.get(Service);

    jest.spyOn(container, "get").mockImplementation((t) => {
      if (t === (token as any)) throw error;
      return "val" as any;
    });

    expect(() => service.lazy()).toThrow(error);
  });

  it("should return instance when optional dependency is present", () => {
    const token = new NodeToken<string>("present");
    @NodeInjectable()
    class Service {
      public readonly lazy = injectDefer(token, { optional: true });
    }

    container.provide({ provide: token, value: "present" });
    container.provide(Service);
    container.bootstrap();

    const service = container.get(Service);
    expect(service.lazy()).toBe("present");
  });
});
