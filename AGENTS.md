# @illuma/core Guidelines

## General

- Services preferably should be defined as classes. Those should be marked as injectable using `@NodeInjectable` or `makeInjectable`. Factory functions are also supported but less common. Both decorator and the helper accept an optional configuration object literal where you can mark the service as `singleton` if it should be instantiated only once per container tree.

- Before using `@NodeInjectable` decorator to mark service as injectable, first, check if decorators do already exist in the project, then, if not, check if they are supported at all.

- For injection, use `nodeInject` on a property to retrieve instances of services. This can only be done within an injection context (while instantiating a service).

- Illuma does not support constructor injection, because it does not use reflection or metadata. Instead, all injection is done through the `nodeInject` function within the service body.

- All injected fields should be marked as `readonly` to prevent reassignment after instantiation.

- If you need to create a transient service (a new instance every time), inject a built-in `Injector` token and call `this._injector.produce(MyService)` or `this._injector.produce(() => {/** this factory is ran in injection context */})` to get a new instance.

- Use `NodeToken` for injectable tokens and `MultiNodeToken` for multi-providers. Define them in a separate file (e.g., `tokens.ts`) and export them for use across the app.

- Circular dependencies are not allowed in Illuma.

- For testing, you can use illuma's testing utilities.

---

## Defining Injectable Services

Use the `@NodeInjectable()` decorator to mark a class as injectable:

```typescript
import { NodeInjectable, nodeInject } from '@illuma/core';

@NodeInjectable()
class UserService {
  private readonly _db = nodeInject(DatabaseService);

  public getUser(id: string) {
    return this._db.query(`SELECT * FROM users WHERE id = ?`, [id]);
  }
}
```

For environments without decorator support, use `makeInjectable`:

```typescript
import { makeInjectable, nodeInject } from '@illuma/core';

class _UserService {
  private readonly _db = nodeInject(DatabaseService);

  public getUser(id: string) {
    return this._db.query(`SELECT * FROM users WHERE id = ?`, [id]);
  }
}

export type UserService = _UserService;
export const UserService = makeInjectable(_UserService);
```

### Root-scoped singletons

Mark a service as a root-scoped singleton (analogous to Angular's `providedIn: 'root'`) to share a single instance across all containers in a hierarchy:

```typescript
@NodeInjectable({ singleton: true })
class AppConfigService {
  public readonly apiUrl = 'https://api.example.com';
}
```

When `singleton: true` is set, there is no need to call `container.provide()` for this service. It is automatically provided and resolved in the root container on first request.

---

## Tokens

Tokens are used to inject non-class values such as configuration objects, primitives, or interfaces. Define tokens in a dedicated `tokens.ts` file and import them where needed.

```typescript
// tokens.ts
import { NodeToken, MultiNodeToken } from '@illuma/core';

export const CONFIG = new NodeToken<AppConfig>('CONFIG');
export const API_URL = new NodeToken<string>('API_URL');
export const PLUGIN = new MultiNodeToken<Plugin>('PLUGIN');
```

### Default factory

A `NodeToken` can have a default factory that runs when no explicit provider is registered:

```typescript
export const LOGGER = new NodeToken<Logger>('LOGGER', {
  factory: () => new ConsoleLogger(),
});
```

### Singleton tokens

Tokens can also be marked as root-scoped singletons:

```typescript
export const APP_CONFIG = new NodeToken<AppConfig>('APP_CONFIG', {
  singleton: true,
  factory: () => loadConfig(),
});
```

These should have a factory function defined to create the instance when needed.

---

## Setting Up Containers

Use `NodeContainer` to manage the DI context. The typical setup is: provide → bootstrap → get.

```typescript
import { NodeContainer } from '@illuma/core';

const container = new NodeContainer();

container.provide([
  Logger,
  DatabaseService,
  UserService,
  CONFIG.withValue({ apiUrl: 'https://api.example.com' }),
]);

container.bootstrap();

const userService = container.get(UserService);
```

### Hierarchical containers

Child containers inherit providers from their parent and can override them locally:

```typescript
const root = new NodeContainer();
root.provide([Logger, DatabaseService]);
root.bootstrap();

const child = new NodeContainer({ parent: root });
child.provide(CONFIG.withValue({ apiUrl: 'https://staging.example.com' }));
child.bootstrap();

// Resolves Logger from root, CONFIG from child
const service = child.get(MyService);
```

### Deferred (lazy) instantiation

By default, all providers are instantiated lazily upon request. To initialize all providers eagerly while `bootstrap()`, pass `instant: true`:

```typescript
const container = new NodeContainer({ instant: true });
```

---

## Provider Types

Using token helpers like `withClass`, `withValue`, and `withFactory` is the recommended way to define providers because of type-safety. However, you can also use the full provider object shape for more complex cases.

### Class provider

```typescript
container.provide(USER_SERVICE.withClass(UserService));
// or explicitly:
container.provide({ provide: USER_SERVICE, useClass: UserService });
```

### Value provider

```typescript
container.provide(CONFIG.withValue({ apiUrl: '...' }));
// or:
container.provide({ provide: CONFIG, value: { apiUrl: '...' } });
```

### Factory provider

Factories run during bootstrap and may call `nodeInject` internally:

```typescript
container.provide(DATABASE.withFactory(() => createDatabase()));
// or:
container.provide({
  provide: DATABASE,
  factory: () => {
    const config = nodeInject(CONFIG);
    return createDatabase(config.connectionString);
  },
});
```

### Alias provider

Map one token to another so both resolve to the same instance:

```typescript
container.provide(DB.withAlias(PRIMARY_DB));
// or:
container.provide({ provide: DB, alias: PRIMARY_DB });
```

### Multi-providers

Use `MultiNodeToken` when multiple implementations should be collected into an array:

```typescript
container.provide([
  PLUGIN.withClass(AuthPlugin),
  PLUGIN.withClass(LoggingPlugin),
  PLUGIN.withClass(MetricsPlugin),
]);

const plugins = container.get(PLUGIN); // Plugin[]
```

---

## Injection Patterns

### Standard injection

```typescript
@NodeInjectable()
class NotificationService {
  private readonly _email = nodeInject(EmailService);
  private readonly _sms = nodeInject(SmsService);
  private readonly _logger = nodeInject(Logger, { optional: true });
}
```

### Deferred injection (circular dependency workaround)

Use `injectDefer` when two services have a mutual dependency. Prefer refactoring over this pattern wherever possible:

```typescript
import { injectDefer } from '@illuma/core';

@NodeInjectable()
class ServiceA {
  private readonly _getServiceB = injectDefer(ServiceB);

  private get _serviceB() {
    return this._getServiceB();
  }
}
```

### Transient instances

Inject `Injector` to produce a new instance on demand without registering it in the container:

```typescript
import { Injector, nodeInject } from '@illuma/core';

@NodeInjectable()
class RequestFactory {
  private readonly _injector = nodeInject(Injector);

  public createHandler(): RequestHandler {
    return this._injector.produce(RequestHandler);
  }

  public createCustomConfig(extra: object) {
    return this._injector.produce(() => {
      const env = nodeInject(Environment);
      return { ...env.defaults, ...extra };
    });
  }
}
```

### Resolution modifiers

Control how the container traverses the hierarchy when resolving a dependency:

```typescript
@NodeInjectable()
class ConfigService {
  // Only look in the current container
  private readonly _local = nodeInject(CONFIG, { self: true });

  // Skip the current container and look in the parent
  private readonly _parent = nodeInject(CONFIG, { skipSelf: true });

  // Return null if not found instead of throwing
  private readonly _optional = nodeInject(CONFIG, { optional: true });
}
```

You cannot combine `self: true` and `skipSelf: true` simultaneously — this throws a `CONFLICTING_STRATEGIES` error.

---

## Lifecycle Hooks

Use the `LifecycleRef` token to register cleanup callbacks that run when the container is destroyed:

```typescript
import { nodeInject, LifecycleRef } from '@illuma/core';

@NodeInjectable()
class DatabaseService {
  private readonly _lifecycle = nodeInject(LifecycleRef);
  private readonly _connection = connect();

  constructor() {
    this._lifecycle.beforeDestroy(() => {
      this._connection.close();
    });
  }
}
```

Hooks run in reverse registration order (bottom-up). Child containers are destroyed before their parent.

### Unsubscribing a hook

`beforeDestroy` returns an unsubscribe function you can call to remove the hook early:

```typescript
@NodeInjectable()
class PollingService {
  private readonly _lifecycle = nodeInject(LifecycleRef);
  private readonly _stopHook: () => void;
  private _interval: ReturnType<typeof setInterval>;

  constructor() {
    this._interval = setInterval(() => this._poll(), 1000);
    this._stopHook = this._lifecycle.beforeDestroy(() => {
      clearInterval(this._interval);
    });
  }

  public stop(): void {
    clearInterval(this._interval);
    this._stopHook(); // de-register the hook since we already cleaned up
  }
}
```

### Checking destroyed state in async code

```typescript
@NodeInjectable()
class AsyncWorker {
  private readonly _lifecycle = nodeInject(LifecycleRef);

  async doWork(): Promise<void> {
    await someLongRunningTask();

    if (this._lifecycle.destroyed) {
      return; // container was destroyed while we were awaiting
    }

    this._continueWork();
  }
}
```

### Destroying a container

```typescript
container.destroy();
// All child containers are destroyed first, then the parent.
// Calling destroy() twice throws InjectionError [i303].
```

---

## Async Injection & Sub-containers

For lazy-loading heavy modules or creating isolated sub-containers, use the async injection utilities:

### `injectAsync` — lazy single dependency

```typescript
import { injectAsync } from '@illuma/core';

@NodeInjectable()
class ReportService {
  private readonly _getPdfEngine = injectAsync(
    () => import('./pdf-engine').then(m => m.PdfEngine),
  );

  async generateReport(): Promise<Buffer> {
    const engine = await this._getPdfEngine();
    return engine.render();
  }
}
```

By default the result is cached. Pass `{ withCache: false }` to create a new instance each call.

### `injectEntryAsync` — sub-container with a specific entrypoint

```typescript
import { injectEntryAsync } from '@illuma/core';

@NodeInjectable()
class AppService {
  private readonly _getReport = injectEntryAsync(
    async () => import('./reports').then(m => m.ReportService),
    { config: [Logger, PdfEngine] },
  );

  async run(): Promise<void> {
    const report = await this._getReport();
    report.generate();
  }
}
```

### `injectGroupAsync` — sub-container exposing a full injector

```typescript
import { injectGroupAsync } from '@illuma/core';

@NodeInjectable()
class PluginHost {
  private readonly _getPluginInjector = injectGroupAsync({
    config: [PluginA, PluginB],
  });

  async executePlugins(): Promise<void> {
    const injector = await this._getPluginInjector();
    injector.get(PluginA).run();
  }
}
```

---

## Testing

Import testing utilities from the `@illuma/core/testkit` subpath:

```typescript
import { createTestFactory } from '@illuma/core/testkit';
```

### Basic service test

```typescript
import { describe, it, expect } from 'vitest';
import { NodeInjectable, nodeInject } from '@illuma/core';
import { createTestFactory } from '@illuma/core/testkit';

@NodeInjectable()
class UserService {
  public getUser() {
    return { id: 1, name: 'Alice' };
  }
}

describe('UserService', () => {
  const createTest = createTestFactory({ target: UserService });

  it('should return a user', () => {
    const { instance } = createTest();
    expect(instance.getUser()).toEqual({ id: 1, name: 'Alice' });
  });
});
```

### Mocking dependencies

```typescript
class MockEmailService {
  public readonly sent: string[] = [];
  public send(to: string) {
    this.sent.push(to);
  }
}

describe('NotificationService', () => {
  const createTest = createTestFactory({
    target: NotificationService,
    provide: [{ provide: EmailService, useClass: MockEmailService }],
  });

  it('should send an email', () => {
    const { instance, injector } = createTest();
    instance.notify('user@example.com');
    const mock = injector.get(EmailService) as MockEmailService;
    expect(mock.sent).toContain('user@example.com');
  });
});
```

### Testing with tokens

```typescript
const API_URL = new NodeToken<string>('API_URL');

describe('ApiClient', () => {
  const createTest = createTestFactory({
    target: ApiClient,
    provide: [API_URL.withValue('https://test.example.com')],
  });

  it('should use the provided URL', () => {
    const { instance } = createTest();
    expect(instance.baseUrl).toBe('https://test.example.com');
  });
});
```

---

## File & Naming Conventions

| Concern         | File                            | Export                             |
| --------------- | ------------------------------- | ---------------------------------- |
| Tokens          | `tokens.ts`                     | Named exports, UPPER_SNAKE_CASE    |
| Services        | `*.service.ts`                  | PascalCase class                   |
| Providers array | `*.providers.ts`                | Named `provide*` function or array |
| Container setup | `container.ts` / `bootstrap.ts` | Named export                       |

### Naming

- **Classes**: `PascalCase` — `UserService`, `DatabaseService`
- **Tokens**: `UPPER_SNAKE_CASE` — `CONFIG`, `API_URL`, `PLUGIN`
- **Injected fields**: `_camelCase` with leading underscore — `_logger`, `_db`

### Visibility

- All injected fields should be marked as `private` to prevent unnecessary external access (until we have a use case for protected or public injection).
- All injected fields should strictly be marked as `readonly` to prevent reassignment after instantiation. Consider leaving mutability as a design flaw if you find yourself needing to reassign an injected field.

---

## Error Reference

| Code   | Meaning                | Quick fix                                           |
| ------ | ---------------------- | --------------------------------------------------- |
| `i100` | Duplicate provider     | Remove duplicate or use `MultiNodeToken`            |
| `i101` | Duplicate factory      | Only provide one factory per token                  |
| `i102` | Invalid constructor    | Add `@NodeInjectable()` or `makeInjectable`         |
| `i103` | Invalid provider       | Use valid provider shape                            |
| `i200` | Invalid alias          | Alias target must be a token or injectable class    |
| `i201` | Loop alias             | Alias must not point to itself                      |
| `i202` | Conflicting strategies | Don't use `self` and `skipSelf` together            |
| `i300` | Not bootstrapped       | Call `bootstrap()` before `get()`                   |
| `i301` | Already bootstrapped   | Call `provide()` before `bootstrap()`               |
| `i302` | Double bootstrap       | Only call `bootstrap()` once                        |
| `i303` | Container destroyed    | Do not use a destroyed container                    |
| `i400` | Provider not found     | Register the token or use `{ optional: true }`      |
| `i401` | Circular dependency    | Refactor to remove the cycle                        |
| `i500` | Untracked injection    | Use `nodeInject` only in class field initializers   |
| `i501` | Outside context        | Use `nodeInject` only inside factories/constructors |
