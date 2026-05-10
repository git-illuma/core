# API Reference

Complete API documentation for Illuma's core classes, functions, and decorators.

## Table of Contents

- [NodeContainer](#nodecontainer)
- [NodeToken](#nodetoken)
- [MultiNodeToken](#multinodetoken)
- [nodeInject](#nodeinject)
- [injectDefer](#injectdefer)
- [Injector](#injector)
- [LifecycleRef](#lifecycleref)
- [Decorators](#decorators)
- [Async Injection Functions](#async-injection-functions)
- [Plugin API](#plugin-api)
- [Type Definitions](#type-definitions)

---

## NodeContainer

The main dependency injection container.

### Constructor

```typescript
new NodeContainer(options?: {
  measurePerformance?: boolean;
  instant?: boolean;
  parent?: iDIContainer;
})
```

| Parameter                    | Type      | Default | Description                                                                              |
| ---------------------------- | --------- | ------- | ---------------------------------------------------------------------------------------- |
| `options.measurePerformance` | `boolean` | `false` | Enable performance monitoring                                                            |
| `options.instant`            | `boolean` | `true`  | Whether to instantiate consumers immediately on bootstrap (true) or lazily (false)       |
| `options.parent`             | `iDIContainer` | `undefined` | Optional parent container for hierarchical injection                                   |

### Methods

#### `destroyed`

Boolean property indicating whether the container has been completely destroyed.
Returns `true` if `destroy()` was successfully executed on this container.

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

#### `get<T>(token: MultiNodeToken<T>, options?: iNodeInjectorOptions): T[]`

#### `get<T>(token: NodeToken<T> | Ctor<T>, options?: iNodeInjectorOptions): T`

Retrieve an instance from the container. Container must be bootstrapped first.
Supports optional modifiers `self`, `skipSelf`, and `optional`. See [Resolution Modifiers](./RESOLUTION_MODIFIERS.md) for more details.

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

#### `registerMiddleware(middleware: iMiddleware): void`

Register a middleware function to run during instance creation for this container.

```typescript
container.registerMiddleware((params, next) => {
  console.log('Instantiating', params.token.name);
  return next(params);
});
```

#### `destroy(): void`

Gracefully shuts down the container, freeing its memory and executing registered `LifecycleRef` cleanup hooks. Note: When a container is destroyed, all its child containers are completely destroyed first.

Calling `destroy()` twice will throw an `InjectionError`.

```typescript
const container = new NodeContainer();
// Use the container...

// Ready to clean up
container.destroy();
```

---

## NodeToken

A token for identifying non-class dependencies.

### Constructor

```typescript
new NodeToken<T>(
  name: string,
  options?: {
    factory?: () => T;
    singleton?: boolean;
  }
)
```

| Parameter         | Type      | Description                        |
| ----------------- | --------- | ---------------------------------- |
| `name`            | `string`  | Unique identifier for the token    |
| `options.factory` | `() => T` | Optional factory for default value |
| `options.singleton` | `boolean` | Marks token as root-scoped singleton in parent-child containers |

When `singleton: true`, there's no need to call `provide` for this token. It will be automatically provided as a singleton in the root container when first requested until you want to override it in a child container.

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

#### `implement(shape: ImplementationShape<T>): iNodeProvider<T>`

```typescript
const LOGGER = new NodeToken<Logger>('LOGGER');
container.provide(LOGGER.implement({ useClass: ConsoleLogger }));
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

Same as `NodeToken`: `withValue()`, `withFactory()`, `withClass()`, `withAlias()`, `implement()`.

---

## nodeInject

Inject a dependency into a class field or factory function.

### Signature

```typescript
function nodeInject<T>(
  token: MultiNodeToken<T>,
  options?: iNodeInjectorOptions
): T[]

function nodeInject<T>(
  token: NodeToken<T> | Ctor<T>,
  options?: iNodeInjectorOptions
): T

function nodeInject<T>(
  token: NodeToken<T> | Ctor<T>,
  options: iNodeInjectorOptions & { optional: true }
): T | null
```

| Parameter          | Type       | Description                              |
| ------------------ | ---------- | ---------------------------------------- |
| `token`            | `Token<T>` | The token or class to inject             |
| `options.optional` | `boolean`  | If `true`, returns `null` when not found |
| `options.self`     | `boolean`  | Limit check to only the current container |
| `options.skipSelf` | `boolean`  | Skip current container and check parent  |

See [Resolution Modifiers](./RESOLUTION_MODIFIERS.md) for more details.

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
  token: MultiNodeToken<T>,
  options?: { optional?: boolean }
): () => T[]

function injectDefer<T>(
  token: NodeToken<T> | Ctor<T>,
  options?: { optional?: false }
): () => T

function injectDefer<T>(
  token: NodeToken<T> | Ctor<T>,
  options: { optional: true }
): () => T | null
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

#### `get<T>(token: MultiNodeToken<T>, options?: iNodeInjectorOptions): T[]`

#### `get<T>(token: NodeToken<T> | Ctor<T>, options?: iNodeInjectorOptions): T`

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

## LifecycleRef

Token for accessing the container lifecycle events to perform cleanup tasks.

### Methods

#### `destroyed` (getter)

A boolean property indicating whether the container has been destroyed.

#### `beforeDestroy(callback: () => void): () => void`

Register a callback to run when the container is about to be destroyed. Callbacks run in reverse initialization order. Returns an unsubscribe function to remove the callback before destruction if it's no longer needed.

```typescript
@NodeInjectable()
class DatabaseService {
  private readonly lifecycle = nodeInject(LifecycleRef);
  private connection: Connection;

  constructor() {
    this.connection = connect();

    // Clean up connection when the container is destroyed
    this.lifecycle.beforeDestroy(() => {
      this.connection.close();
    });
  }
}
```

#### `onChildDestroy(callback: () => void): () => void`

*(Internal)* Register a callback specifically executed during the children destruction phase. Typically only used for building low-level tools that integrate with container hierarchies.

---

## Decorators

### @NodeInjectable(options?)

Mark a class as injectable.

```typescript
@NodeInjectable({ singleton: true })
class UserService {
  private readonly db = nodeInject(DatabaseService);
}
```

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `singleton` | `boolean` | `false` | Marks this injectable class as root-scoped singleton |

**Requires:** `experimentalDecorators: true` in `tsconfig.json`

### makeInjectable()

Alternative to `@NodeInjectable()` without decorators.

```typescript
import { makeInjectable } from '@illuma/core';

class _UserService {
  public getUser() { return { id: 1 }; }
}

export type UserService = _UserService;
export const UserService = makeInjectable(_UserService, { singleton: true });
```

### Root singleton semantics

`{ singleton: true }` implements Angular-like root scope for single providers:

1. The singleton flag is stored on the generated `NodeToken`.
2. During dependency resolution, if the token is missing locally and upstream, Illuma materializes a singleton proto node from token metadata.
3. When requested from child containers, singleton registration is forwarded through parents to root and attached to root tree state.
4. The resulting instance is shared across root and all descendants unless a child explicitly overrides that provider locally.

Instantiation timing is still controlled by the root container `instant` option:

1. `instant: true` on root: singleton is instantiated when attached to root.
2. `instant: false` on root: singleton is attached but instantiated only on first actual resolve.

Important constraints:

1. Root singleton providers can only inject dependencies visible from root. Child-only providers are not visible to root singletons.
2. Circular dependency checks still apply and throw as usual.
3. The feature is intended for `NodeToken` and class injectables. `MultiNodeToken` behavior is unchanged.

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
    config?: Provider[];
    injector?: iInjector;
  }
): () => Promise<T | T[]>
```

| Option      | Type         | Default     | Description                                |
| ----------- | ------------ | ----------- | ------------------------------------------ |
| `withCache` | `boolean`    | `true`      | Cache the resolved instance                |
| `config`    | `Provider[]` | `[]`        | Additional providers for the sub-container |
| `injector`  | `iInjector`  | `undefined` | Explicit injector to use instead of context|

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
    config?: Provider[];
    injector?: iInjector;
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
    config?: Provider[];
    injector?: iInjector;
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

## Plugin API

Static methods available on the `Illuma` class for hooking into the DI system.

### Scanners

#### `Illuma.extendContextScanner(scanner: iContextScanner): void`

Register a custom scanner to detect injection points. Illuma's default scanner detects `nodeInject` calls by executing the factory in a proxy context. You can add scanners to support other forms of injection detection.

Scanners are stored in insertion order and run immediately when providers are registered, so register them before calling `provide()` for providers that should be scanned.

```typescript
import { Illuma, type iContextScanner } from '@illuma/core/plugins';

const myScanner: iContextScanner = {
  scan(factory) {
    // Custom logic to analyze the factory function
    // Return a Set of injection nodes found
    return new Set();
  }
};

Illuma.extendContextScanner(myScanner);
```

### Diagnostics

#### `enableIllumaDiagnostics(): void`

Enable the built-in diagnostics system, which includes a default reporter and performance tracking middleware. This function must be called before bootstrapping any container that should have diagnostics enabled.

During `bootstrap()`, diagnostics reporting happens after dependency graph build/instantiation and after lifecycle bootstrap hooks have run.

```typescript
import { enableIllumaDiagnostics } from '@illuma/core/plugins';

// Enable diagnostics before creating containers
enableIllumaDiagnostics();

// Now containers will report diagnostics after bootstrap
const container = new NodeContainer();
container.provide([...]);
container.bootstrap();
// → Diagnostics output will be logged
```

> **Note**: The `diagnostics: true` option in `NodeContainer` constructor is no longer supported since version `2.0.0`. Use `enableIllumaDiagnostics()` instead.

#### `Illuma.extendDiagnostics(module: iDiagnosticsModule): void`

Register a custom diagnostics module. These modules receive a report after a container is bootstrapped, providing insights into the dependency graph.

You must call `enableIllumaDiagnostics()` before bootstrapping to enable the diagnostics system.

Diagnostics modules are invoked in registration order.

```typescript
import { Illuma, enableIllumaDiagnostics, type iDiagnosticsModule } from '@illuma/core/plugins';

const reporter: iDiagnosticsModule = {
  onReport(report) {
    console.log(`Total nodes: ${report.totalNodes}`);
    console.log(`Unused nodes: ${report.unusedNodes.length}`);
    console.log(`Bootstrap time: ${report.bootstrapDuration}ms`);
  }
};

// Enable diagnostics and register custom reporter
enableIllumaDiagnostics();
Illuma.extendDiagnostics(reporter);
```

### `Illuma.registerGlobalMiddleware(middleware: iMiddleware): void`

Register a middleware function that will run for **all** containers and providers. This allows you to intercept the instantiation of every provider in your application, which is useful for cross-cutting concerns like logging, performance profiling, mocking, or instance transformation.

Each middleware receives an `iInstantiationParams` object and a `next` function. You must call `next(params)` to proceed with the instantiation (or return a custom value to bypass it).

Global middlewares run before container-local middlewares, and each scope preserves registration order.

#### Interface

```typescript
type iMiddleware<T = unknown> = (
  params: iInstantiationParams<T>,
  next: (params: iInstantiationParams<T>) => T,
) => T;

interface iInstantiationParams<T> {
  readonly token: NodeBase<T>;        // The token being resolved
  readonly factory: () => T;          // The factory function that creates the instance
  readonly deps: Set<Token<unknown>>; // Dependencies detected for this node
}
```

#### Example: Performance logging middleware

```typescript
import { Illuma } from '@illuma/core/plugins';

Illuma.registerGlobalMiddleware((params, next) => {
  const start = performance.now();

  // Proceed with instantiation
  const instance = next(params);

  const end = performance.now();
  console.log(`[${params.token.name}] instantiated in ${(end - start).toFixed(2)}ms`);

  return instance;
});
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
  get<T>(token: MultiNodeToken<T>): T[];
  get<T>(token: NodeToken<T>): T;
  get<T>(token: Ctor<T>): T;
  produce<T>(fn: Ctor<T> | (() => T)): T;
}
```

### iMiddleware

Middleware function type.

```typescript
type iMiddleware<T = unknown> = (
  params: iInstantiationParams<T>,
  next: (params: iInstantiationParams<T>) => T,
) => T;
```

### iInstantiationParams

Parameters passed to middleware.

```typescript
interface iInstantiationParams<T = unknown> {
  readonly token: NodeBase<T>;
  readonly factory: () => T;
  readonly deps: Set<Token<unknown>>;
}
```

---

## Related documentation

- [Getting Started](./GETTING_STARTED.md) - Setup and basic concepts
- [Providers Guide](./PROVIDERS.md) - Provider types in detail
- [Tokens Guide](./TOKENS.md) - Using NodeToken and MultiNodeToken
- [Async Injection Guide](./ASYNC_INJECTION.md) - Advanced async patterns
- [Resolution Modifiers](./RESOLUTION_MODIFIERS.md) - Modifiers like `self` and `skipSelf` for hierarchical containers
- [Lifecycle Guide](./LIFECYCLE.md) - Container lifecycle hooks
- [Testing Guide](./TESTKIT.md) - Testing with Illuma
- [Error Reference](./TROUBLESHOOTING.md) - Troubleshooting
