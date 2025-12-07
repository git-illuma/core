import {
  createProviderSet,
  MultiNodeToken,
  NodeInjectable,
  NodeToken,
  nodeInject,
} from "../api";
import { InjectionError } from "../errors";
import { createTestFactory } from "./helpers";

describe("Testkit Helpers", () => {
  it("should create an instantiatable test factory", () => {
    @NodeInjectable()
    class SampleService {
      getValue() {
        return "sample";
      }
    }

    const createProvider = createTestFactory({ target: SampleService });
    const spectator = createProvider();

    expect(spectator.instance).toBeInstanceOf(SampleService);
    expect(spectator.instance.getValue()).toBe("sample");
  });

  it("should include additional providers", () => {
    @NodeInjectable()
    class DependentService {
      public getData() {
        return 42;
      }
    }

    @NodeInjectable()
    class MainService {
      private readonly dep = nodeInject(DependentService);

      public fetchData() {
        return this.dep.getData();
      }
    }

    const createProvider = createTestFactory({
      target: MainService,
      providers: createProviderSet(DependentService),
    });

    const spectator = createProvider();
    expect(spectator.instance).toBeInstanceOf(MainService);
    expect(spectator.instance.fetchData()).toBe(42);

    expect(spectator.nodeInject(DependentService)).toBeInstanceOf(DependentService);
  });

  it("should work with token provider using factory", () => {
    const token = new NodeToken<string>("TEST_TOKEN", {
      factory: () => "factory-value",
    });

    const createProvider = createTestFactory({
      target: token,
    });

    const spectator = createProvider();
    expect(spectator.instance).toBe("factory-value");
  });

  it("should work with token provider using value", () => {
    const depToken = new NodeToken<{ message: string }>("DEP_TOKEN");

    @NodeInjectable()
    class Service {
      public readonly dep = nodeInject(depToken);
    }

    const createProvider = createTestFactory({
      target: Service,
      providers: createProviderSet({
        provide: depToken,
        value: { message: "static-value" },
      }),
    });

    const spectator = createProvider();
    expect(spectator.instance.dep.message).toBe("static-value");
  });

  it("should inject multi-token dependencies", () => {
    const multiToken = new MultiNodeToken<{ name: string }>("MULTI_TOKEN");

    @NodeInjectable()
    class ServiceA {
      public readonly name = "service-a";
    }

    @NodeInjectable()
    class ServiceB {
      public readonly name = "service-b";
    }

    @NodeInjectable()
    class Consumer {
      public readonly items = nodeInject(multiToken);
    }

    const createProvider = createTestFactory({
      target: Consumer,
      providers: createProviderSet(
        { provide: multiToken, alias: ServiceA },
        { provide: multiToken, alias: ServiceB },
      ),
    });

    const spectator = createProvider();
    expect(spectator.instance.items).toHaveLength(2);
    expect(spectator.instance.items.map((i) => i.name)).toEqual(
      expect.arrayContaining(["service-a", "service-b"]),
    );
  });

  it("should support optional injection via nodeInject", () => {
    const missingToken = new NodeToken<string>("MISSING_TOKEN");
    const presentToken = new NodeToken<string>("PRESENT_TOKEN");

    @NodeInjectable()
    class Service {
      public readonly value = "present";
    }

    const createProvider = createTestFactory({
      target: Service,
      providers: createProviderSet({ provide: presentToken, value: "present" }),
    });

    const spectator = createProvider();

    expect(spectator.nodeInject(missingToken, { optional: true })).toBeNull();
    expect(spectator.nodeInject(presentToken)).toBe("present");
  });

  it("should allow overriding target with custom provider", () => {
    @NodeInjectable()
    class DependencyService {
      getInfo() {
        return "dependency";
      }
    }

    class MockDependency {
      getInfo() {
        return "mocked-dependency";
      }
    }

    @NodeInjectable()
    class Consumer {
      private readonly dep = nodeInject(DependencyService);

      getValue() {
        return this.dep.getInfo();
      }
    }

    const createProvider = createTestFactory({
      target: Consumer,
      providers: createProviderSet({
        provide: DependencyService,
        useClass: MockDependency,
      }),
    });

    const spectator = createProvider();
    expect(spectator.instance.getValue()).toBe("mocked-dependency");
  });

  it("should rethrow error from container when token is missing and not optional", () => {
    const token = new NodeToken("token", { factory: () => "val" });
    const createProvider = createTestFactory({ target: token });
    const spectator = createProvider();

    const missingToken = new NodeToken("missing");
    expect(() => spectator.nodeInject(missingToken)).toThrow(InjectionError);
  });
});
