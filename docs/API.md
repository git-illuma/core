# 📚 API Reference

Complete API documentation for Illuma's core classes, functions, and decorators.

## Table of Contents

- [NodeContainer](#nodecontainer)
- [NodeToken](#nodetoken)
- [MultiNodeToken](#multinodetoken)
- [nodeInject](#nodeinject)
- [injectDefer](#injectdefer)
- [Injector](#injector)
- [Decorators](#decorators)
- [Async Injection Functions](#async-injection-functions)
- [Type Definitions](#type-definitions)

---

## NodeContainer

The main dependency injection container.

### Constructor

```typescript
new NodeContainer(options?: { 
  measurePerformance?: boolean;
  diagnostics?: boolean;
  instant?: boolean;
})
```

| Parameter                    | Type      | Default | Description                                                                              |
| ---------------------------- | --------- | ------- | ---------------------------------------------------------------------------------------- |
| `options.measurePerformance` | `boolean` | `false` | Enable performance monitoring                                                            |
| `options.diagnostics`        | `boolean` | `false` | Enable diagnostics reporting                                                             |
| `options.instant`            | `boolean` | `true`  | Whether to instantiate consumers immediately on bootstrap (true) or lazily (false)       |

### Methods

#### `provide<T>(provider: Provider<T>): void`

Register a provider or array of providers in the container.

```typescript
// Single provider
container.provide(UserService);

// Provider object
container.provide({
  provide: CONFIG,
  value: { apiUrl: 'https://api.example.com' }
});

// Array of providers
container.provide([
  UserService,
  DatabaseService,
  { provide: CONFIG, value: config }
]);
```

#### `bootstrap(): void`

Build the dependency tree and prepare the container for use. Must be called before `get()`.

```typescript
container.provide([UserService, DatabaseService]);
container.bootstrap();
```

#### `get<T>(token: Token<T>): T`

Retrieve an instance from the container. Container must be bootstrapped first.

```typescript
const userService = container.get(UserService);
const config = container.get(CONFIG);
```

#### `produce<T>(fn: Ctor<T> | (() => T)): T`

Create a new instance with dependencies injected, without registering it in the container. Accepts either an injectable class or a factory function.

```typescript
// With an injectable class
@NodeInjectable()
class RequestHandler {
  private readonly logger = nodeInject(Logger);
}

const handler = container.produce(RequestHandler);
// handler is not registered in container
// Each call creates a new instance

// With a factory function
const config = container.produce(() => {
  const env = nodeInject(Environment);
  return { apiUrl: env.apiUrl, timeout: 5000 };
});
```

---

## NodeToken

A token for identifying non-class dependencies.

### Constructor

```typescript
new NodeToken<T>(name: string, options?: { factory?: () => T })
```

| Parameter         | Type      | Description                        |
| ----------------- | --------- | ---------------------------------- |
| `name`            | `string`  | Unique identifier for the token    |
| `options.factory` | `() => T` | Optional factory for default value |

### Provider Helper Methods

#### `withValue(value: T): iNodeValueProvider<T>`

```typescript
const API_URL = new NodeToken<string>('API_URL');
container.provide(API_URL.withValue('https://api.example.com'));
```

#### `withFactory(factory: () => T): iNodeFactoryProvider<T>`

```typescript
const CONFIG = new NodeToken<Config>('CONFIG');
container.provide(CONFIG.withFactory(() => loadConfig()));
```

#### `withClass(ctor: Ctor<T>): iNodeClassProvider<T>`

```typescript
const LOGGER = new NodeToken<Logger>('LOGGER');
container.provide(LOGGER.withClass(ConsoleLogger));
```

#### `withAlias<K extends T>(alias: Token<K>): iNodeAliasProvider<T>`

```typescript
const DB = new NodeToken<Database>('DB');
container.provide(DB.withAlias(PRIMARY_DB));
```

---

## MultiNodeToken

A token that can have multiple providers, returning an array.

### Constructor

```typescript
new MultiNodeToken<T>(name: string, options?: { factory?: () => T })
```

### Usage

```typescript
const PLUGINS = new MultiNodeToken<Plugin>('PLUGINS');

container.provide([
  PLUGINS.withClass(LoggingPlugin),
  PLUGINS.withClass(MetricsPlugin)
]);

const plugins = container.get(PLUGINS); // Plugin[]
```

### Provider Helper Methods

Same as `NodeToken`: `withValue()`, `withFactory()`, `withClass()`, `withAlias()`.

---

## nodeInject

Inject a dependency into a class field or factory function.

### Signature

```typescript
function nodeInject<T>(
  token: Token<T>,
  options?: { optional?: boolean }
): T
```

| Parameter          | Type       | Description                              |
| ------------------ | ---------- | ---------------------------------------- |
| `token`            | `Token<T>` | The token or class to inject             |
| `options.optional` | `boolean`  | If `true`, returns `null` when not found |

### Usage

```typescript
@NodeInjectable()
class UserService {
  private readonly logger = nodeInject(Logger);
  private readonly cache = nodeInject(CacheService, { optional: true });

  public getUser(id: string) {
    this.logger.log(`Fetching user ${id}`);
    return this.cache?.get(id) ?? this.fetchFromDb(id);
  }
}
```

---

## injectDefer

Lazily inject a dependency. Useful for handling circular dependencies or deferring resolution in a cost of transparency while bootstrapping.

If the only injection point for the dependency is via `injectDefer`, it may appear unused in diagnostics.

### Signature

```typescript
function injectDefer<T>(
  token: Token<T>,
  options?: { optional?: boolean }
): () => T
```

| Parameter          | Type       | Description                                       |
| ------------------ | ---------- | ------------------------------------------------- |
| `token`            | `Token<T>` | The token or class to inject                      |
| `options.optional` | `boolean`  | If `true`, returns function returning `T \| null` |

### Usage

```typescript
@NodeInjectable()
class ServiceA {
  // Returns a function that resolves the dependency when called
  private readonly injectB = injectDefer(ServiceB);

  private get b(): ServiceB {
    return this.injectB();
  }

  public doSomething() {
    // Call the getter to access the instance
    this.b.method();
  }
}
// Note: injectDefer returns a function, so you must call it to get the instance or array of instances.
```

---

## Injector

Token for accessing the DI container from within services.

### Methods

#### `get<T>(token: Token<T>): T`

Retrieve a registered instance from the container.

```typescript
@NodeInjectable()
class PluginManager {
  private readonly injector = nodeInject(Injector);

  public executePlugin(token: Token<Plugin>) {
    const plugin = this.injector.get(token);
    plugin.execute();
  }
}
```

#### `produce<T>(fn: Ctor<T> | (() => T)): T`

Create a new instance with dependencies injected. Accepts either an injectable class or a factory function.

```typescript
@NodeInjectable()
class FactoryService {
  private readonly injector = nodeInject(Injector);

  // With an injectable class
  public createHandler() {
    return this.injector.produce(RequestHandler);
  }

  // With a factory function
  public createCustomConfig(data) {
    return this.injector.produce(() => {
      const env = nodeInject(Environment);
      return { apiUrl: env.apiUrl, ...data };
    });
  }
}
```

---

## Decorators

### @NodeInjectable()

Mark a class as injectable.

```typescript
@NodeInjectable()
class UserService {
  private readonly db = nodeInject(DatabaseService);
}
```

**Requires:** `experimentalDecorators: true` in `tsconfig.json`

### makeInjectable()

Alternative to `@NodeInjectable()` without decorators.

```typescript
import { makeInjectable } from '@illuma/core';

class _UserService {
  public getUser() { return { id: 1 }; }
}

export type UserService = _UserService;
export const UserService = makeInjectable(_UserService);
```

### registerClassAsInjectable() (internal)

Registers a class as injectable with a specific token using the internal `WeakMap` registry.
This is primarily used internally by both `@NodeInjectable` and `makeInjectable` but is exposed for plugins to implement custom decorators.

```typescript
function registerClassAsInjectable<T>(ctor: Ctor<T>, token: NodeToken<T>): void
```

| Parameter | Type           | Description                       |
| --------- | -------------- | --------------------------------- |
| `ctor`    | `Ctor<T>`      | The class constructor to register |
| `token`   | `NodeToken<T>` | The token to associate with it    |

**Example: Creating a custom decorator**

```typescript
function CustomService(name: string) {
  return (ctor: any) => {
    const token = new NodeToken(name, { factory: () => new ctor() });
    registerClassAsInjectable(ctor, token);
    return ctor;
  };
}
```

---

## Async injection functions

### injectAsync

Lazily inject a single dependency.

```typescript
function injectAsync<T>(
  fn: () => Token<T> | Promise<Token<T>>,
  options?: {
    withCache?: boolean;
    overrides?: Provider[];
  }
): () => Promise<T | T[]>
```

| Option      | Type         | Default | Description                                |
| ----------- | ------------ | ------- | ------------------------------------------ |
| `withCache` | `boolean`    | `true`  | Cache the resolved instance                |
| `overrides` | `Provider[]` | `[]`    | Additional providers for the sub-container |

```typescript
private readonly getAnalytics = injectAsync(
  () => import('./analytics').then(m => m.AnalyticsService)
);

public async track(event: string) {
  const analytics = await this.getAnalytics();
  analytics.track(event);
}
```

### injectGroupAsync

Create an isolated sub-container with an array of providers.

```typescript
function injectGroupAsync(
  fn: () => Provider<unknown>[] | Promise<Provider<unknown>[]>,
  options?: {
    withCache?: boolean;
    overrides?: Provider[];
  }
): () => Promise<iInjector>
```

```typescript
private readonly getPluginContainer = injectGroupAsync(
  () => import('./plugins').then(m => m.providePlugins())
);

public async executePlugins() {
  const injector = await this.getPluginContainer();
  const plugins = injector.get(PLUGINS);
}
```

### injectEntryAsync

Create a sub-container with a specific entrypoint token and providers.

```typescript
function injectEntryAsync<T>(
  fn: () => iEntrypointConfig<Token<T>> | Promise<iEntrypointConfig<Token<T>>>,
  options?: {
    withCache?: boolean;
    overrides?: Provider[];
  }
): () => Promise<T | T[]>
```

```typescript
// in user.service.ts

const USERS_CONFIG = new NodeToken<{ table: string }>('USERS_CONFIG');

@NodeInjectable()
class UserService {
  private readonly db = nodeInject(DatabaseService); // Declared in parent container
  private readonly config = nodeInject(USERS_CONFIG);

  public getUsers() {
    return this.db.query(`SELECT * FROM ${this.config.table}`);
  }
}

export const userModule: iEntrypointConfig<UserService> = {
  entrypoint: UserService,
  providers: [
    UserService,
    { provide: USERS_CONFIG, value: { table: 'users' } }
  ],
};
```

```typescript

// in app.service.ts

@NodeInjectable()
class AppService {
  private readonly getUserService = injectEntryAsync(() =>
    import('./user.service').then(m => m.userModule)
  );

  public async listUsers() {
    const userService = await this.getUserService();
    // userService is resolved with DatabaseService injected from parent container
    // and USERS_CONFIG provided in the sub-container
    return userService.getUsers();
  }
}
```

---

## Type definitions

### Token<T>

Union type for dependency identifiers.

```typescript
type Token<T> = NodeToken<T> | MultiNodeToken<T> | Ctor<T>;
```

### Ctor<T>

Constructor type.

```typescript
type Ctor<T> = new (...args: any[]) => T;
```

### Provider

Any provider type.

```typescript
type Provider<T = unknown> =
  | NodeBase<T>
  | iNodeProvider<T>
  | Ctor<T>
  | Provider[];
```

### Provider interfaces

```typescript
interface iNodeValueProvider<T> {
  provide: Token<T>;
  value: T;
}

interface iNodeFactoryProvider<T> {
  provide: Token<T>;
  factory: () => T;
}

interface iNodeClassProvider<T> {
  provide: Token<T>;
  useClass: Ctor<T>;
}

interface iNodeAliasProvider<T> {
  provide: Token<T>;
  alias: Token<T>;
}
```

### iInjector

Interface for container/injector access.

```typescript
interface iInjector {
  get<T>(token: Token<T>): T;
  produce<T>(fn: Ctor<T> | (() => T)): T;
}
```

---

## Related documentation

- [Getting Started](./GETTING_STARTED.md) - Setup and basic concepts
- [Providers Guide](./PROVIDERS.md) - Provider types in detail
- [Tokens Guide](./TOKENS.md) - Using NodeToken and MultiNodeToken
- [Async Injection Guide](./ASYNC_INJECTION.md) - Advanced async patterns
- [Testing Guide](./TESTKIT.md) - Testing with Illuma
- [Error Reference](./TROUBLESHOOTING.md) - Troubleshooting
