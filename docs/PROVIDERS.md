# 🎨 Providers

This guide covers the different ways to register dependencies in your Illuma container.

## Table of contents

- [🎨 Providers](#-providers)
  - [Table of contents](#table-of-contents)
  - [Overview](#overview)
  - [Provider types](#provider-types)
    - [Class provider](#class-provider)
    - [Value provider](#value-provider)
    - [Factory provider](#factory-provider)
    - [Class reference provider](#class-reference-provider)
    - [Alias provider](#alias-provider)
  - [Registering providers](#registering-providers)
    - [Single provider](#single-provider)
    - [Array providers](#array-providers)
    - [Nested arrays](#nested-arrays)
  - [Best practices](#best-practices)
    - [1. Group related providers](#1-group-related-providers)
    - [2. Use token helpers](#2-use-token-helpers)
    - [3. Register all providers before bootstrap](#3-register-all-providers-before-bootstrap)
    - [4. Use factories for complex initialization](#4-use-factories-for-complex-initialization)
  - [Related documentation](#related-documentation)

## Overview

Providers tell the container how to create or retrieve instances of your dependencies. Each provider specifies:

1. **What** to provide (the token)
2. **How** to provide it (value, factory, class, or alias)

## Provider types

### Class provider

The simplest way to register a service - just pass the class directly:

```typescript
@NodeInjectable()
class UserService implements iUserService {
  public getUser(id: string) {
    return { id, name: 'John' };
  }
}

// Direct class registration
container.provide(UserService);
```

Or with explicit configuration:

```typescript
// This approach is equivalent to the above but enables swapping implementations
const USER_SERVICE = new NodeToken<iUserService>('USER_SERVICE');

container.provide({
  provide: USER_SERVICE,
  useClass: UserService
});
```

### Value provider

Provide a pre-created value:

```typescript
interface Config {
  apiUrl: string;
  debug: boolean;
}

const CONFIG = new NodeToken<Config>('CONFIG');

container.provide({
  provide: CONFIG,
  value: {
    apiUrl: 'https://api.example.com',
    debug: true
  }
});
```

Using the token helper:

```typescript
container.provide(
  CONFIG.withValue({
    apiUrl: 'https://api.example.com',
    debug: true
  })
);
```

Using the generic helper:

```typescript
container.provide(
  CONFIG.implement({
    value: {
      apiUrl: 'https://api.example.com',
      debug: true
    }
  })
);
```

### Factory provider

Use a factory function for custom instantiation logic:

```typescript
const DATABASE = new NodeToken<Database>('DATABASE');

container.provide({
  provide: DATABASE,
  factory: () => {
    const config = nodeInject(CONFIG);
    return new Database({
      connectionString: config.databaseUrl,
      maxConnections: 10
    });
  }
});
```

Using the token helper:

```typescript
container.provide(
  DATABASE.withFactory(() => {
    const config = nodeInject(CONFIG);
    return new Database(config.databaseUrl);
  })
);
```

Using the generic helper:

```typescript
container.provide(
  DATABASE.implement({
    factory: () => {
      const config = nodeInject(CONFIG);
      return new Database(config.databaseUrl);
    }
  })
);
```

> **Note:** Factory functions run during container bootstrap, not when the dependency is requested.

### Class reference provider

Use a different implementation class for a token:

```typescript
interface Logger {
  log(message: string): void;
}

class ConsoleLogger implements Logger {
  public log(message: string) {
    console.log(message);
  }
}

const LOGGER = new NodeToken<Logger>('LOGGER');

container.provide({
  provide: LOGGER,
  useClass: ConsoleLogger
});
```

Using the token helper:

```typescript
container.provide(LOGGER.withClass(ConsoleLogger));
```

Using the generic helper:

```typescript
container.provide(
  LOGGER.implement({ useClass: ConsoleLogger })
);
```

### Alias provider

Create an alias to another token, making both resolve to the same instance:

```typescript
@NodeInjectable()
class PostgresDatabase { }

const PRIMARY_DB = new NodeToken<PostgresDatabase>('PRIMARY_DB');
const DB = new NodeToken<PostgresDatabase>('DB');

container.provide(PostgresDatabase);
container.provide({
  provide: PRIMARY_DB,
  alias: PostgresDatabase
});
container.provide({
  provide: DB,
  alias: PRIMARY_DB
});

container.bootstrap();

// All resolve to the same instance
const db1 = container.get(PostgresDatabase);
const db2 = container.get(PRIMARY_DB);
const db3 = container.get(DB);
// db1 === db2 === db3
```

Using the token helper:

```typescript
container.provide(DB.withAlias(PRIMARY_DB));
```

Using the generic helper:

```typescript
container.provide(
  DB.implement({ alias: PRIMARY_DB })
);
```

### Generic helper

Generic helpers like `implement` can be used for any provider type, allowing you to choose the most concise syntax for your use case, primarily when creating provider functions (e.g. `provideDatabase()`) that return multiple providers by scope or environment. For example:

```typescript
function provideDatabase(cfg: ImplementationShape<>): Provider[] {
  return [
    DatabaseService,
    DATABASE_CONFIG.implement(cfg),
  ];
}
```

## Registering providers

### Single provider

```typescript
container.provide(UserService);

container.provide({
  provide: CONFIG,
  value: { apiUrl: 'https://api.example.com' }
});
```

### Array providers

Group related providers together (recommended):

```typescript
container.provide([
  UserService,
  DatabaseService,
  {
    provide: CONFIG,
    value: { apiUrl: 'https://api.example.com' }
  },
  LOGGER.withClass(ConsoleLogger)
]);
```

### Nested arrays

Organize complex provider configurations:

```typescript
const coreProviders = [
  Logger,
  CONFIG.withValue({ debug: true })
];

const databaseProviders = [
  Database,
  UserRepository,
  ProductRepository
];

const serviceProviders = [
  UserService,
  ProductService,
  OrderService
];

container.provide([
  coreProviders,
  databaseProviders,
  serviceProviders
]);
```

## Best practices

### 1. Group related providers

```typescript
// ✅ Good: Organized by feature
const authProviders = [
  AuthService,
  TokenService,
  AUTH_CONFIG.withValue({ tokenExpiry: 3600 })
];

const userProviders = [
  UserService,
  UserRepository
];

container.provide([authProviders, userProviders]);
```

### 2. Use token helpers

```typescript
// ✅ Good: Type-safe and concise
container.provide([
  CONFIG.withValue({ apiUrl: 'https://api.example.com' }),
  LOGGER.withClass(ConsoleLogger),
  DATABASE.withFactory(() => createConnection())
]);

// Also valid, but more verbose
container.provide([
  { provide: CONFIG, value: { apiUrl: 'https://api.example.com' } },
  { provide: LOGGER, useClass: ConsoleLogger },
  { provide: DATABASE, factory: () => createConnection() }
]);
```

### 3. Register all providers before bootstrap

```typescript
// ✅ Correct order
container.provide([/* all providers */]);
container.bootstrap();
container.get(SomeService);

// ❌ Wrong: Cannot provide after bootstrap
container.bootstrap();
container.provide(AnotherService); // Throws [i301]
```

### 4. Use factories for complex initialization

```typescript
// ✅ Good: Factory handles complex setup
container.provide({
  provide: DATABASE,
  factory: () => {
    const config = nodeInject(CONFIG);
    const logger = nodeInject(LOGGER);
    
    const db = new Database(config.connectionString);
    db.on('error', (err) => logger.error(err));
    return db;
  }
});
```

## Related documentation

- [Tokens Guide](./TOKENS.md) - Learn about NodeToken and MultiNodeToken
- [Resolution Modifiers](./RESOLUTION_MODIFIERS.md) - Modifying dependency resolution
- [API Reference](./API.md) - Complete API documentation
- [Troubleshooting](./TROUBLESHOOTING.md) - Common errors and solutions
