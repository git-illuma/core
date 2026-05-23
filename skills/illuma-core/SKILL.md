---
name: illuma-core
description: Creating, using, and testing @illuma/core services and DI containers in TypeScript. Use when defining injectable services, providers, tokens, hierarchical containers, or lifecycle hooks.
when_to_use: |
  User mentions @illuma/core, NodeInjectable, makeInjectable, nodeInject, NodeContainer, NodeToken, MultiNodeToken, injectDefer, injectAsync, LifecycleRef, or Injector. Also: questions about dependency injection, providers, tokens, hierarchical containers, transient services, lifecycle hooks, or testing services in this codebase.
---

# @illuma/core Guidelines

## General

- Define services as classes marked with `@NodeInjectable` or `makeInjectable`. Factory functions work but are uncommon. Pass `{ singleton: true }` to share a single instance across the container tree.
- Before using `@NodeInjectable`, verify decorators are enabled in the project; otherwise use `makeInjectable`.
- Inject dependencies with `nodeInject` on class fields. Injection only works inside an injection context (during instantiation).
- Constructor injection is not supported. Inject through `nodeInject` in the class body.
- All injected fields must be `private readonly`.
- For transient instances, inject `Injector` and call `this._injector.produce(MyService)` or `produce(() => { ... })` to run a factory in injection context.
- Use `NodeToken` for injectable tokens and `MultiNodeToken` for multi-providers. Define them in `tokens.ts`.
- Circular dependencies are not allowed. Use `injectDefer` only when you cannot refactor the cycle away.

For async/lazy patterns, see [async-injection.md](async-injection.md). For testing, see [testing.md](testing.md). For error codes, see [errors.md](errors.md).

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

- Mark injected fields `private` to prevent external access (until a use case for protected/public exists).
- Mark injected fields `readonly` to prevent reassignment. Needing to reassign an injected field is usually a design flaw.
