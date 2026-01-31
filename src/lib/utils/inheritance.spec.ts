import { vi } from "vitest";
import { MultiNodeToken, NodeInjectable, NodeToken, nodeInject } from "../api";
import { NodeContainer } from "../container";
import { InjectionError } from "../errors";
import { injectAsync, injectEntryAsync, injectGroupAsync } from "./inheritance";

describe("injectAsync", () => {
  it("should throw when called outside injection context", () => {
    expect(() => injectAsync(() => new NodeToken<string>("test"))).toThrow(
      InjectionError,
    );
  });

  it("should inject class dependency", async () => {
    const parent = new NodeContainer();

    @NodeInjectable()
    class TestService {
      public readonly value = "test-service";
    }

    parent.provide(TestService);

    @NodeInjectable()
    class ParentService {
      private readonly _getService = injectAsync(() => TestService);

      public getService() {
        return this._getService();
      }
    }

    parent.provide(ParentService);
    parent.bootstrap();

    const parentService = parent.get(ParentService);
    const service = await parentService.getService();

    expect(service).toBeInstanceOf(TestService);
    expect(service.value).toBe("test-service");
  });

  it("should cache by default", async () => {
    const parent = new NodeContainer();

    @NodeInjectable()
    class TestService {}

    parent.provide(TestService);

    @NodeInjectable()
    class ParentService {
      private readonly _getService = injectAsync(() => TestService);

      public getService() {
        return this._getService();
      }
    }

    parent.provide(ParentService);
    parent.bootstrap();

    const parentService = parent.get(ParentService);
    const service1 = await parentService.getService();
    const service2 = await parentService.getService();

    expect(service1).toBe(service2);
  });

  it("should not cache when withCache is false", async () => {
    const parent = new NodeContainer();

    @NodeInjectable()
    class TestService {}

    parent.provide(TestService);

    @NodeInjectable()
    class ParentService {
      private readonly _getService = injectAsync(() => TestService, {
        withCache: false,
      });

      public getService() {
        return this._getService();
      }
    }

    parent.provide(ParentService);
    parent.bootstrap();

    const parentService = parent.get(ParentService);
    const service1 = await parentService.getService();
    const service2 = await parentService.getService();

    expect(service1).not.toBe(service2);
  });

  it("should apply overrides to temp container", async () => {
    const parent = new NodeContainer();
    const configToken = new NodeToken<string>("config");

    @NodeInjectable()
    class TestService {
      public readonly config: string;

      constructor() {
        this.config = nodeInject(configToken);
      }
    }

    @NodeInjectable()
    class ParentService {
      private readonly _getService = injectAsync(() => TestService, {
        overrides: [{ provide: configToken, value: "override-config" }],
      });

      public getService() {
        return this._getService();
      }
    }

    parent.provide(ParentService);
    parent.bootstrap();

    const parentService = parent.get(ParentService);
    const service = await parentService.getService();

    expect(service.config).toBe("override-config");
  });

  it("should allow overrides to shadow parent container values", async () => {
    const parent = new NodeContainer();
    const configToken = new NodeToken<string>("config");

    @NodeInjectable()
    class TestService {
      public readonly config: string;

      constructor() {
        this.config = nodeInject(configToken);
      }
    }

    parent.provide({ provide: configToken, value: "parent-config" });

    @NodeInjectable()
    class ParentService {
      private readonly _getService = injectAsync(() => TestService, {
        overrides: [{ provide: configToken, value: "overridden-config" }],
      });

      public getService() {
        return this._getService();
      }
    }

    parent.provide(ParentService);
    parent.bootstrap();

    const parentService = parent.get(ParentService);
    const service = await parentService.getService();

    expect(service.config).toBe("overridden-config");
  });
});

describe("injectGroupAsync", () => {
  it("should work with array providers in sub-container", async () => {
    const parent = new NodeContainer();
    const childTokenA = new NodeToken<string>("childTokenA");
    const childTokenB = new NodeToken<string>("childTokenB");

    @NodeInjectable()
    class ParentService {
      private readonly _getSubContainer = injectGroupAsync(() => [
        { provide: childTokenA, value: "child-value-a" },
        { provide: childTokenB, value: "child-value-b" },
      ]);

      public createSubContainer() {
        return this._getSubContainer();
      }
    }

    parent.provide(ParentService);
    parent.bootstrap();

    const parentService = parent.get(ParentService);
    const subInjector = await parentService.createSubContainer();

    expect(subInjector.get(childTokenA)).toBe("child-value-a");
    expect(subInjector.get(childTokenB)).toBe("child-value-b");
  });

  it("should support nested array providers in sub-container", async () => {
    const parent = new NodeContainer();
    const tokenA = new NodeToken<string>("tokenA");
    const tokenB = new NodeToken<string>("tokenB");
    const tokenC = new NodeToken<string>("tokenC");

    @NodeInjectable()
    class ParentService {
      private readonly _getSubContainer = injectGroupAsync(() => [
        [{ provide: tokenA, value: "value-a" }],
        [{ provide: tokenB, value: "value-b" }, [{ provide: tokenC, value: "value-c" }]],
      ]);

      public createSubContainer() {
        return this._getSubContainer();
      }
    }

    parent.provide(ParentService);
    parent.bootstrap();

    const parentService = parent.get(ParentService);
    const subInjector = await parentService.createSubContainer();

    expect(subInjector.get(tokenA)).toBe("value-a");
    expect(subInjector.get(tokenB)).toBe("value-b");
    expect(subInjector.get(tokenC)).toBe("value-c");
  });

  it("should support mixed array of classes and providers in sub-container", async () => {
    const parent = new NodeContainer();
    const token = new NodeToken<string>("token");

    @NodeInjectable()
    class ChildService {
      public readonly value = "child-service";
    }

    @NodeInjectable()
    class ParentService {
      private readonly _getSubContainer = injectGroupAsync(() => [
        ChildService,
        { provide: token, value: "token-value" },
      ]);

      public createSubContainer() {
        return this._getSubContainer();
      }
    }

    parent.provide(ParentService);
    parent.bootstrap();

    const parentService = parent.get(ParentService);
    const subInjector = await parentService.createSubContainer();

    expect(subInjector.get(ChildService)).toBeInstanceOf(ChildService);
    expect(subInjector.get(ChildService).value).toBe("child-service");
    expect(subInjector.get(token)).toBe("token-value");
  });

  it("should support multi-token providers in array for sub-container", async () => {
    const parent = new NodeContainer();
    const multiToken = new MultiNodeToken<{ name: string }>("MULTI");

    @NodeInjectable()
    class PluginA {
      public readonly name = "plugin-a";
    }

    @NodeInjectable()
    class PluginB {
      public readonly name = "plugin-b";
    }

    @NodeInjectable()
    class ParentService {
      private readonly _getSubContainer = injectGroupAsync(() => [
        { provide: multiToken, alias: PluginA },
        { provide: multiToken, alias: PluginB },
      ]);

      public createSubContainer() {
        return this._getSubContainer();
      }
    }

    parent.provide(ParentService);
    parent.bootstrap();

    const parentService = parent.get(ParentService);
    const subInjector = await parentService.createSubContainer();

    const plugins = subInjector.get(multiToken);
    expect(plugins).toHaveLength(2);
    expect(plugins.map((p) => p.name)).toEqual(
      expect.arrayContaining(["plugin-a", "plugin-b"]),
    );
  });

  it("should cache by default", async () => {
    const parent = new NodeContainer();
    const token = new NodeToken<string>("TOKEN");

    @NodeInjectable()
    class ParentService {
      private readonly _getSubContainer = injectGroupAsync(() => [
        { provide: token, value: "value" },
      ]);

      public createSubContainer() {
        return this._getSubContainer();
      }
    }

    parent.provide(ParentService);
    parent.bootstrap();

    const parentService = parent.get(ParentService);
    const subInjector1 = await parentService.createSubContainer();
    const subInjector2 = await parentService.createSubContainer();

    expect(subInjector1).toBe(subInjector2);
  });

  it("should not cache when withCache is false", async () => {
    const parent = new NodeContainer();
    const token = new NodeToken<string>("TOKEN");

    @NodeInjectable()
    class ParentService {
      private readonly _getSubContainer = injectGroupAsync(
        () => [{ provide: token, value: "value" }],
        { withCache: false },
      );

      public createSubContainer() {
        return this._getSubContainer();
      }
    }

    parent.provide(ParentService);
    parent.bootstrap();

    const parentService = parent.get(ParentService);
    const subInjector1 = await parentService.createSubContainer();
    const subInjector2 = await parentService.createSubContainer();

    expect(subInjector1).not.toBe(subInjector2);
  });

  it("should apply overrides to sub-container", async () => {
    const parent = new NodeContainer();
    const tokenA = new NodeToken<string>("tokenA");
    const tokenB = new NodeToken<string>("tokenB");

    @NodeInjectable()
    class ChildService {
      private readonly valueA = nodeInject(tokenA);
      private readonly valueB = nodeInject(tokenB);

      public getValueA() {
        return this.valueA;
      }

      public getValueB() {
        return this.valueB;
      }
    }

    @NodeInjectable()
    class ParentService {
      private readonly _getSubContainer = injectGroupAsync(
        () => [{ provide: tokenA, value: "value-a" }, ChildService],
        {
          overrides: [{ provide: tokenB, value: "value-b" }],
        },
      );

      public createSubContainer() {
        return this._getSubContainer();
      }
    }

    parent.provide(ParentService);
    parent.bootstrap();

    const parentService = parent.get(ParentService);
    const subInjector = await parentService.createSubContainer();
    const childService = subInjector.get(ChildService);

    expect(childService.getValueA()).toBe("value-a");
    expect(childService.getValueB()).toBe("value-b");
  });

  it("should throw error if overrides duplicate provider tokens", async () => {
    const parent = new NodeContainer();
    const token = new NodeToken<string>("TOKEN");

    @NodeInjectable()
    class ParentService {
      private readonly _getSubContainer = injectGroupAsync(
        () => [{ provide: token, value: "original-value" }],
        {
          overrides: [{ provide: token, value: "overridden-value" }],
        },
      );

      public createSubContainer() {
        return this._getSubContainer();
      }
    }

    parent.provide(ParentService);
    parent.bootstrap();

    const parentService = parent.get(ParentService);

    await expect(parentService.createSubContainer()).rejects.toThrow(InjectionError);
  });
});

describe("injectEntryAsync", () => {
  it("should throw when called outside injection context", () => {
    expect(() =>
      injectEntryAsync(() => ({
        entrypoint: new NodeToken("test"),
        providers: [],
      })),
    ).toThrow(InjectionError);
  });

  it("should create sub-container and return entrypoint instance", async () => {
    const parent = new NodeContainer();
    const token = new NodeToken<string>("token");

    @NodeInjectable()
    class ParentService {
      private readonly _getEntrypoint = injectEntryAsync(() => ({
        entrypoint: token,
        providers: [{ provide: token, value: "value" }],
      }));

      public getEntrypoint() {
        return this._getEntrypoint();
      }
    }

    parent.provide(ParentService);
    parent.bootstrap();

    const parentService = parent.get(ParentService);
    const result = await parentService.getEntrypoint();

    expect(result).toBe("value");
  });

  it("should support async factory", async () => {
    const parent = new NodeContainer();
    const token = new NodeToken<string>("token");

    @NodeInjectable()
    class ParentService {
      private readonly _getEntrypoint = injectEntryAsync(async () => ({
        entrypoint: token,
        providers: [{ provide: token, value: "async-value" }],
      }));

      public getEntrypoint() {
        return this._getEntrypoint();
      }
    }

    parent.provide(ParentService);
    parent.bootstrap();

    const parentService = parent.get(ParentService);
    const result = await parentService.getEntrypoint();

    expect(result).toBe("async-value");
  });

  it("should create instance with provided deps", async () => {
    const parent = new NodeContainer();
    const token = new NodeToken<string>("token");

    @NodeInjectable()
    class ChildService {
      public readonly value = nodeInject(token);
    }

    @NodeInjectable()
    class ParentService {
      private readonly _getEntrypoint = injectEntryAsync(() => ({
        entrypoint: ChildService,
        providers: [ChildService, { provide: token, value: "value" }],
      }));

      public getEntrypoint() {
        return this._getEntrypoint();
      }
    }

    parent.provide(ParentService);
    parent.bootstrap();

    const parentService = parent.get(ParentService);
    const childService = await parentService.getEntrypoint();

    expect(childService).toBeInstanceOf(ChildService);
    expect(childService.value).toBe("value");
  });

  it("should reproduce API.md example", async () => {
    const parent = new NodeContainer();

    @NodeInjectable()
    class DatabaseService {
      public query(sql: string) {
        return `Result for ${sql}`;
      }
    }

    const USERS_CONFIG = new NodeToken<{ table: string }>("USERS_CONFIG");

    @NodeInjectable()
    class UserService {
      private readonly db = nodeInject(DatabaseService);
      private readonly config = nodeInject(USERS_CONFIG);

      public getUsers() {
        return this.db.query(`SELECT * FROM ${this.config.table}`);
      }
    }

    @NodeInjectable()
    class AppService {
      private readonly getUserService = injectEntryAsync(() => ({
        entrypoint: UserService,
        providers: [UserService, { provide: USERS_CONFIG, value: { table: "users" } }],
      }));

      public async listUsers() {
        const userService = await this.getUserService();
        return userService.getUsers();
      }
    }

    parent.provide([AppService, DatabaseService]);
    parent.bootstrap();

    const appService = parent.get(AppService);
    const result = await appService.listUsers();

    expect(result).toBe("Result for SELECT * FROM users");
  });

  it("should reproduce ASYNC_INJECTION.md example", async () => {
    const parent = new NodeContainer();
    const logSpy = vi.fn();

    @NodeInjectable()
    class Logger {
      public log(msg: string) {
        logSpy(msg);
      }
    }

    @NodeInjectable()
    class ReportService {
      private readonly logger = nodeInject(Logger);

      generate() {
        this.logger.log("Generating report...");
        return "Report Data";
      }
    }

    @NodeInjectable()
    class AppService {
      private readonly getReportService = injectEntryAsync(() => {
        return Promise.resolve({
          entrypoint: ReportService,
          providers: [ReportService, Logger],
        });
      });

      public async downloadReport() {
        const reportService = await this.getReportService();
        return reportService.generate();
      }
    }

    parent.provide(AppService);
    parent.bootstrap();

    const appService = parent.get(AppService);
    const result = await appService.downloadReport();

    expect(result).toBe("Report Data");
    expect(logSpy).toHaveBeenCalledWith("Generating report...");
  });
});
