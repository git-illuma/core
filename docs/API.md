# 📚 API Reference

Complete API documentation for Illuma's core classes, functions, and decorators.

## Table of Contents

- [NodeContainer](#nodecontainer)
- [NodeToken](#nodetoken)
- [MultiNodeToken](#multinodetoken)
- [nodeInject](#nodeinject)
- [Decorators](#decorators)
- [Provider Types](#provider-types)
- [Type Definitions](#type-definitions)

## NodeContainer

The main dependency injection container.

### Methods

#### `provide<T>(provider: Providable<T>): void`

Register a provider or array of providers in the container.

**Parameters:**
- `provider` - A provider configuration object, injectable class, or array of providers

**Example:**
```typescript
import { NodeContainer, NodeToken } from '@zodyac/illuma';

const container = new NodeContainer();
const CONFIG = new NodeToken<Config>('CONFIG');

// Single provider
container.provide({
  provide: CONFIG,
  value: { apiUrl: 'https://api.example.com' }
});

// Array of providers (recommended)
container.provide([
  UserService,
  DatabaseService,
  {
    provide: CONFIG,
    value: { apiUrl: 'https://api.example.com' }
  },
]);

// Nested arrays are supported
container.provide([
  UserService,
  [
    DatabaseService,
    {
      provide: CONFIG,
      value: { apiUrl: 'https://api.example.com' }
    },
  ],
]);
```

#### `include(providerSet: iNodeProviderSet): void` (Deprecated)

> **Deprecated:** Use `provide()` with an array of providers instead.

Include a provider set in the container.

**Parameters:**
- `providerSet` - A provider set created with `createProviderSet()`

**Example:**
```typescript
import { NodeContainer, createProviderSet } from '@zodyac/illuma';

const providers = createProviderSet(
  UserService,
  DatabaseService
);

const container = new NodeContainer();
container.include(providers); // deprecated

// Recommended instead:
container.provide([UserService, DatabaseService]);
```

#### `bootstrap(): void`

Build the dependency tree and prepare the container for use. Must be called before retrieving instances with `get()`.

**Example:**
```typescript
const container = new NodeContainer();
container.provide(UserService);
container.bootstrap();
```

#### `get<T>(token: Token<T>): T`

Retrieve an instance from the container. Container must be bootstrapped first.

**Parameters:**
- `token` - The token or class to retrieve

**Returns:** The resolved instance

**Example:**
```typescript
const userService = container.get(UserService);
```

---

## NodeToken

A token for identifying dependencies that aren't classes.

### Constructor

#### `new NodeToken<T>(name: string, options?: { factory?: () => T })`

Create a new token.

**Parameters:**
- `name` - Unique identifier for the token
- `options.factory` - Optional factory function for default value

**Example:**
```typescript
import { NodeToken } from '@zodyac/illuma';

const API_URL = new NodeToken<string>('API_URL');

const CONFIG = new NodeToken<Config>('CONFIG', {
  factory: () => ({ apiUrl: 'https://api.example.com' })
});
```

---

## MultiNodeToken

A token that can have multiple providers.

### Constructor

#### `new MultiNodeToken<T>(name: string, options?: { factory?: () => T })`

Create a multi-token that accepts multiple providers.

**Parameters:**
- `name` - Unique identifier for the token
- `options.factory` - Optional factory function for default value

**Example:**
```typescript
import { MultiNodeToken } from '@zodyac/illuma';

const PLUGINS = new MultiNodeToken<Plugin>('PLUGINS');

container.provide({
  provide: PLUGINS,
  value: new LoggingPlugin()
});

container.provide({
  provide: PLUGINS,
  value: new MetricsPlugin()
});

container.bootstrap();

// Injecting returns an array
const plugins = container.get(PLUGINS); // Plugin[]
```

---

## nodeInject

Inject a dependency into a class or function.

### Function Signature

#### `nodeInject<T>(token: Token<T>, options?: { optional?: boolean }): T`

Inject a dependency from the current injection context.

**Parameters:**
- `token` - The token or class to inject
- `options.optional` - If `true`, returns `undefined` instead of throwing when dependency is not found

**Returns:** The resolved instance (or `undefined` if optional and not found)

**Example:**
```typescript
import { NodeInjectable, nodeInject } from '@zodyac/illuma';

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

## Decorators

### @NodeInjectable()

Mark a class as injectable, allowing it to be provided and have dependencies injected.

**Example:**
```typescript
import { NodeInjectable, nodeInject } from '@zodyac/illuma';

@NodeInjectable()
class DatabaseService {
  public query(sql: string) {
    // ...
  }
}

@NodeInjectable()
class UserRepository {
  private readonly db = nodeInject(DatabaseService);

  public findAll() {
    return this.db.query('SELECT * FROM users');
  }
}
```

**Note:** Requires `experimentalDecorators: true` in `tsconfig.json`.

**Alternative without decorators:**
```typescript
import { makeInjectable } from '@zodyac/illuma';

class _UserService {
  public getUser() {
    return { id: 1, name: "John Doe" };
  }
}

export type UserService = _UserService;
export const UserService = makeInjectable(_UserService);
```

---

## Provider Types

### Class Provider

Provide a class directly:

```typescript
@NodeInjectable()
class UserService {}

container.provide(UserService);
```

### Value Provider

Provide a pre-instantiated value:

```typescript
const CONFIG = new NodeToken<Config>('CONFIG');

container.provide({
  provide: CONFIG,
  value: { apiUrl: 'https://api.example.com' }
});
```

### Factory Provider

Provide a factory function:

```typescript
container.provide({
  provide: UserService,
  factory: () => new UserService()
});
```

### Class Reference Provider

Use a different class implementation:

```typescript
container.provide({
  provide: Logger,
  useClass: ConsoleLogger
});
```

### Alias Provider

Create an alias to another token:

```typescript
const PRIMARY_DB = new NodeToken<Database>('PRIMARY_DB');
const DB = new NodeToken<Database>('DB');

container.provide({
  provide: DB,
  alias: PRIMARY_DB
});

container.bootstrap();

const dbInstance = container.get(DB); // Resolves to PRIMARY_DB instance
```

---

## Async Injection Functions

### injectGroupAsync

Creates an async function that injects a group of dependencies as an isolated sub-container.

**Function Signature:**
```typescript
function injectGroupAsync(
  fn: () => Providable<unknown>[] | Promise<Providable<unknown>[]>,
  options?: { withCache?: boolean }
): () => Promise<iInjector>
```

**Parameters:**
- `fn` - A function that returns an array of providers or a promise resolving to one
- `options.withCache` - If `true` (default), caches the sub-container instance

**Returns:** A function that returns a promise resolving to the injector of the sub-container

**Example:**
```typescript
// In plugins.ts

export function providePlugins() {
  return [
    { provide: PLUGIN_TOKEN, value: new PluginA() },
    { provide: PLUGIN_TOKEN, value: new PluginB() },
  ];
}

// In plugin-host.ts

import { injectGroupAsync, NodeInjectable } from '@zodyac/illuma';

@NodeInjectable()
class PluginHost {
  private readonly getPluginContainer = injectGroupAsync(
    () => import('./plugins').then(m => m.providePlugins()),
  );

  async executePlugins() {
    const injector = await this.getPluginContainer();
    const plugins = injector.get(PLUGIN_TOKEN);
    for (const p of plugins) p.execute();
  }
}
```

### injectChildrenAsync (Deprecated)

> **Deprecated:** Use `injectGroupAsync()` with array providers instead.

Creates an async function that injects a sub-container with the given dependencies.

**Function Signature:**
```typescript
function injectChildrenAsync(
  fn: () => iNodeProviderSet | Promise<iNodeProviderSet>,
  options?: { withCache?: boolean }
): () => Promise<iInjector>
```

### injectAsync

Creates an async function that injects a single dependency lazily.

**Function Signature:**
```typescript
function injectAsync<T>(
  fn: () => Token<T> | Promise<Token<T>>,
  options?: { withCache?: boolean }
): () => Promise<T | T[]>
```

**Parameters:**
- `fn` - A function that returns a token/class or a promise resolving to one
- `options.withCache` - If `true` (default), caches the resolved instance

**Returns:** A function that returns a promise resolving to the dependency instance

**Example:**
```typescript
import { injectAsync, NodeInjectable } from '@zodyac/illuma';

@NodeInjectable()
class FeatureService {
  private readonly getAnalytics = injectAsync(
    () => import('./analytics').then(m => m.AnalyticsService),
  );

  async trackEvent(event: string) {
    const analytics = await this.getAnalytics();
    analytics.track(event);
  }
}
```

---

## Utility Functions

### createProviderSet (Deprecated)

> **Deprecated:** Use array providers with `provide()` instead.

Creates a reusable set of providers that can be included in a container.

**Function Signature:**
```typescript
function createProviderSet(
  ...providers: (iNodeProvider<unknown> | Ctor<unknown>)[]
): iNodeProviderSet
```

**Example:**
```typescript
import { createProviderSet } from '@zodyac/illuma';

// Deprecated
const providers = createProviderSet(
  UserService,
  { provide: CONFIG, value: config }
);

container.include(providers);

// Recommended instead
container.provide([
  UserService,
  { provide: CONFIG, value: config }
]);
```

---

## Type Definitions

### Token<T>

A token that can be used to identify a dependency. Can be a class constructor or a `NodeToken`/`MultiNodeToken`.

### Providable<T>

A provider configuration or injectable class.

### iNodeProviderSet

A set of providers created with `createProviderSet()`.

---

## Related Documentation

- [Main README](../README.md) - Getting started and core concepts
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions
- [Async Injection Guide](./INHERITANCE.md) - Advanced async patterns
- [Testing Guide](./TESTKIT.md) - Testing with Illuma

## Questions or Feedback?

If you have questions about the API, please [open an issue](https://github.com/git-zodyac/illuma/issues) on GitHub.
