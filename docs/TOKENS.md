# Tokens

This guide covers how to use tokens to identify and inject non-class dependencies in Illuma.

## Table of contents

- [Overview](#overview)
- [NodeToken](#nodetoken)
  - [Creating Tokens](#creating-tokens)
  - [Default Values with Factory](#default-values-with-factory)
  - [Provider Helper Methods](#provider-helper-methods)
- [MultiNodeToken](#multinodetoken)
  - [Basic Usage](#basic-usage)
  - [Use Cases](#use-cases)
  - [Provider Helper Methods](#provider-helper-methods-1)
- [When to Use Tokens](#when-to-use-tokens)
- [Best Practices](#best-practices)

## Overview

Tokens are unique identifiers for dependencies that aren't classes. They provide type-safe injection for:

- Configuration objects
- Primitive values (strings, numbers, booleans)
- Interfaces and abstract types
- Collections of related services

## NodeToken

`NodeToken` represents a single value of a specific type.

### Creating tokens

```typescript
import { NodeToken } from '@illuma/core';

// Simple tokens
const API_URL = new NodeToken<string>('API_URL');
const MAX_RETRIES = new NodeToken<number>('MAX_RETRIES');
const DEBUG_MODE = new NodeToken<boolean>('DEBUG_MODE');

// Interface/object tokens
interface Config {
  apiUrl: string;
  timeout: number;
}

const CONFIG = new NodeToken<Config>('CONFIG');
```

### Default values with factory

Tokens can have a default factory that runs if no explicit provider is registered:

```typescript
const LOGGER = new NodeToken<Logger>('LOGGER', {
  factory: () => new ConsoleLogger()
});

const container = new NodeContainer();
// No provider registered for LOGGER
container.bootstrap();

// Returns ConsoleLogger from the factory
const logger = container.get(LOGGER);
```

### Provider helper methods

Tokens provide convenient methods to create providers:

#### `withValue(value)`

```typescript
const API_URL = new NodeToken<string>('API_URL');

// These are equivalent
container.provide({ provide: API_URL, value: 'https://api.example.com' });
container.provide(API_URL.withValue('https://api.example.com'));
```

#### `withFactory(factory)`

```typescript
const CONFIG = new NodeToken<Config>('CONFIG');

container.provide(
  CONFIG.withFactory(() => {
    const env = nodeInject(Environment);
    return {
      apiUrl: env.API_URL || 'https://api.example.com',
      debug: env.NODE_ENV === 'development'
    };
  })
);
```

#### `withClass(ctor)`

```typescript
interface Logger {
  log(message: string): void;
}

const LOGGER = new NodeToken<Logger>('LOGGER');
container.provide(LOGGER.withClass(ConsoleLogger));
```

#### `withAlias(alias)`

```typescript
const PRIMARY_DB = new NodeToken<Database>('PRIMARY_DB');
const DB = new NodeToken<Database>('DB');

container.provide(PRIMARY_DB.withClass(PostgresDatabase));
container.provide(DB.withAlias(PRIMARY_DB));

// Both resolve to the same instance
```

#### `implement(shape)`

Use a single helper when you already have a provider implementation shape:

```typescript
const LOGGER = new NodeToken<Logger>('LOGGER');

container.provide(
  LOGGER.implement({ useClass: ConsoleLogger })
);
```

This is equivalent to:

```typescript
container.provide({
  provide: LOGGER,
  useClass: ConsoleLogger
});
```

## MultiNodeToken

`MultiNodeToken` allows multiple providers for the same token, collecting all values into an array.

### Basic usage

```typescript
import { MultiNodeToken } from '@illuma/core';

interface Plugin {
  name: string;
  execute(): void;
}

const PLUGINS = new MultiNodeToken<Plugin>('PLUGINS');

container.provide({
  provide: PLUGINS,
  useClass: LoggingPlugin
});

container.provide({
  provide: PLUGINS,
  useClass: MetricsPlugin
});

container.provide({
  provide: PLUGINS,
  useClass: CachePlugin
});

container.bootstrap();

// Returns an array of all plugins
const plugins = container.get(PLUGINS); // Plugin[]
plugins.forEach(p => p.execute());
```

### Use cases

#### Plugin systems

```typescript
const MIDDLEWARE = new MultiNodeToken<Middleware>('MIDDLEWARE');

container.provide([
  MIDDLEWARE.withClass(AuthMiddleware),
  MIDDLEWARE.withClass(LoggingMiddleware),
  MIDDLEWARE.withClass(CorsMiddleware)
]);

// Apply all middleware
const middlewares = container.get(MIDDLEWARE);
app.use(...middlewares);
```

#### Validators

```typescript
const VALIDATORS = new MultiNodeToken<Validator>('VALIDATORS');

container.provide([
  VALIDATORS.withClass(EmailValidator),
  VALIDATORS.withClass(PhoneValidator),
  VALIDATORS.withClass(UrlValidator)
]);

// Run all validators
const validators = container.get(VALIDATORS);
const errors = validators.flatMap(v => v.validate(data));
```

#### Event handlers

```typescript
const ON_STARTUP = new MultiNodeToken<() => Promise<void>>('ON_STARTUP');

container.provide([
  ON_STARTUP.withFactory(() => initDatabase),
  ON_STARTUP.withFactory(() => loadCache),
  ON_STARTUP.withFactory(() => startMetrics)
]);

// Execute all startup handlers
const handlers = container.get(ON_STARTUP);
await Promise.all(handlers.map(h => h()));
```

### Provider helper methods

`MultiNodeToken` supports the same helper methods as `NodeToken`:

```typescript
const VALUES = new MultiNodeToken<string>('VALUES');

container.provide([
  VALUES.withValue('Value A'),
  VALUES.withValue('Value B'),
  VALUES.withValue('Value C')
]);

const values = container.get(VALUES); // ['Value A', 'Value B', 'Value C']
```

```typescript
const SERVICES = new MultiNodeToken<Service>('SERVICES');

container.provide([
  SERVICES.withClass(ServiceA),
  SERVICES.withClass(ServiceB),
  SERVICES.withFactory(() => new ServiceC('custom'))
]);
```

Including `implement(shape)`:

```typescript
const HANDLERS = new MultiNodeToken<Handler>('HANDLERS');

container.provide([
  HANDLERS.implement({ useClass: AuditHandler }),
  HANDLERS.implement({ factory: () => new MetricsHandler('v2') })
]);
```

## When to use tokens

### Use NodeToken when

- Injecting configuration values
- Injecting primitive types (string, number, boolean)
- Injecting interface types (when you want to swap implementations)
- The dependency is a single value

### Use MultiNodeToken when

- You need multiple implementations of the same interface
- Building plugin systems
- Collecting middleware, validators, or handlers
- The dependency is naturally a collection

### Use classes directly when

- The dependency is a concrete class
- You don't need to swap implementations
- The class is decorated with `@NodeInjectable()`

```typescript
// ✅ Use class directly
@NodeInjectable()
class UserService { }
container.provide(UserService);

// ✅ Use token for flexibility
const LOGGER = new NodeToken<Logger>('LOGGER');
container.provide(LOGGER.withClass(ConsoleLogger));
// Later: easily swap to FileLogger
```

## Best Practices

### 1. Use descriptive token names

```typescript
// ✅ Good: Clear and descriptive
const DATABASE_CONNECTION_STRING = new NodeToken<string>('DATABASE_CONNECTION_STRING');
const API_BASE_URL = new NodeToken<string>('API_BASE_URL');

// ❌ Bad: Vague names
const STR = new NodeToken<string>('STR');
const CONFIG = new NodeToken<any>('CONFIG');
```

### 2. Group related tokens

```typescript
// tokens/database.ts
export const DB_HOST = new NodeToken<string>('DB_HOST');
export const DB_PORT = new NodeToken<number>('DB_PORT');
export const DB_NAME = new NodeToken<string>('DB_NAME');
// Or better – group it as a single config token `DB_CONFIG`

// tokens/api.ts
export const API_URL = new NodeToken<string>('API_URL');
export const API_KEY = new NodeToken<string>('API_KEY');
```

### 3. Define tokens near their interfaces but separate from implementations

```typescript
// services/logger.ts
export interface Logger {
  log(message: string): void;
  error(message: string): void;
}

export const LOGGER = new NodeToken<Logger>('LOGGER');

// implementations/console-logger.ts
import { LOGGER, Logger } from '../services/logger';

export class ConsoleLogger implements Logger {
  public log(message: string) { console.log(message); }
  public error(message: string) { console.error(message); }
}
```

### 4. Use type parameters

```typescript
// ✅ Good: Type-safe
const CONFIG = new NodeToken<AppConfig>('CONFIG');

// ❌ Bad: Loses type safety
const CONFIG = new NodeToken<any>('CONFIG');
```

### 5. Consider default factories for optional features

```typescript
const ANALYTICS = new NodeToken<Analytics>('ANALYTICS', {
  factory: () => new NoOpAnalytics() // Safe default
});

// If not provided, uses NoOpAnalytics
// If provided, uses the provided implementation
```

## Related documentation

- [Providers Guide](./PROVIDERS.md) - How to register providers
- [Resolution Modifiers](./RESOLUTION_MODIFIERS.md) - Modifying dependency resolution
- [API Reference](./API.md) - Complete API documentation
- [Troubleshooting](./TROUBLESHOOTING.md) - Common errors and solutions
