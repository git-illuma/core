# 🔥 Illuma – Modern Angular-style Dependency Injection for anything

![NPM Version](https://img.shields.io/npm/v/%40zodyac%2Filluma)
![NPM Downloads](https://img.shields.io/npm/dw/%40zodyac%2Filluma)
![npm bundle size](https://img.shields.io/bundlephobia/min/%40zodyac%2Filluma)
![Test coverage](./badges/coverage.svg)

A lightweight, type-safe dependency injection container for TypeScript and JavaScript. Inspired by Angular's DI system, Illuma brings powerful dependency injection capabilities to any project.

> [!NOTE]
> This package is in early development stage. Please report any issues you find and expect API changes in minor versions.

## ✨ Features

- **🎯 Type-Safe**: Full TypeScript support with excellent type inference
- **🪶 Lightweight**: Zero dependencies, minimal bundle size
- **🔄 Flexible Providers**: Support for classes, factories, values, and aliases
- **🎨 Decorator Support**: Clean, Angular-style `@NodeInjectable()` decorators
- **🔗 Multi-Tokens**: Built-in support for multi-provider tokens
- **🌲 Dependency Tree**: Automatic resolution of complex dependency graphs
- **⚡ Performance**: Optional performance monitoring built-in
- **🌍 Universal**: Works in Node.js, Browser, and Electron

## 📦 Installation

```bash
npm install @zodyac/illuma
# or
pnpm add @zodyac/illuma
# or
yarn add @zodyac/illuma
# or
bun add @zodyac/illuma
```

## Table of Contents
- [🚀 Quick Start](#-quick-start)
- [📖 Core Concepts](#-core-concepts)
- [🎨 Provider Types](#-provider-types)
- [🔄 Dependency Injection](#-dependency-injection)
- [📦 Provider Sets](#-provider-sets)
- [🔧 Advanced Usage](#-advanced-usage)
- [🧪 Testing](#-testing)
- [📚 API Reference](./docs/API.md)
- [⚠️ Troubleshooting](#-troubleshooting)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [🔗 Links](#-links)

## 🚀 Quick Start

## 🔧 TypeScript Configuration

To use decorators like `@NodeInjectable()`, you need to enable experimental decorators in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

Alternatively, if you prefer not to use decorators, you can use `makeInjectable` to mark classes as injectable:

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

### Basic Usage with Decorators

```typescript
import { NodeContainer, NodeInjectable, nodeInject } from '@zodyac/illuma';

// Define injectable services
@NodeInjectable()
class Logger {
  public log(message: string) {
    console.log(`[LOG]: ${message}`);
  }
}

@NodeInjectable()
class UserService {
  private readonly logger = nodeInject(Logger);

  getUser(id: string) {
    this.logger.log(`Fetching user ${id}`);
    return { id, name: 'John Doe' };
  }
}

// Create and bootstrap container
const container = new NodeContainer();
container.provide(Logger);
container.provide(UserService);
container.bootstrap();

// Retrieve instances
const userService = container.get(UserService);
const user = userService.getUser('123');
```

### Using Tokens

```typescript
import { NodeToken, NodeContainer } from '@zodyac/illuma';

// Define a token
interface Config {
  apiUrl: string;
  timeout: number;
}

const CONFIG_TOKEN = new NodeToken<Config>('CONFIG');

// Provide a value for the token
const container = new NodeContainer();
container.provide({
  provide: CONFIG_TOKEN,
  value: {
    apiUrl: 'https://api.example.com',
    timeout: 5000
  }
});

container.bootstrap();
const config = container.get(CONFIG_TOKEN);
```

## 📖 Core Concepts

### 1. NodeContainer

The main container that manages all dependencies:

```typescript
const container = new NodeContainer({
  measurePerformance: true // Optional: enable performance monitoring
});

// Register providers
container.provide(/* ... */);

// Bootstrap the container (builds dependency tree)
container.bootstrap();

// Retrieve instances
const instance = container.get(SomeToken);
```

### 2. NodeToken

Type-safe tokens for dependency identification:

```typescript
const DATABASE_TOKEN = new NodeToken<Database>('DATABASE');

// With factory function
const LOGGER_TOKEN = new NodeToken<Logger>('LOGGER', {
  factory: () => new ConsoleLogger()
});
```

### 3. MultiNodeToken

Tokens that can have multiple providers:

```typescript
import { MultiNodeToken } from '@zodyac/illuma';

interface Plugin {
  name: string;
  execute(): void;
}

const PLUGINS = new MultiNodeToken<Plugin>('PLUGINS');

container.provide({
  provide: PLUGINS,
  factory: () => new AnalyticsPlugin()
});

container.provide({
  provide: PLUGINS,
  factory: () => new LoggingPlugin()
});

container.bootstrap();

// Returns an array of all plugins
const plugins = container.get(PLUGINS); // Plugin[]
```

## 🎨 Provider Types

### Class Provider

```typescript
@NodeInjectable()
class MyService {
  // ...
}

// Direct class registration
container.provide(MyService);

// Or with explicit configuration
container.provide({
  provide: SomeToken,
  useClass: MyService
});
```

### Factory Provider

```typescript
container.provide({
  provide: DATABASE_TOKEN,
  factory: () => {
    // Custom instantiation logic
    // You can also inject other dependencies here
    const config = container.get(CONFIG_TOKEN);
    return new Database({
      ...config,
      connectionString: 'postgres://user:pass@localhost/db'
    });
  }
});
```

### Value Provider

```typescript
container.provide({
  provide: CONFIG_TOKEN,
  value: {
    apiUrl: 'https://api.example.com'
  }
});
```

### Alias Provider

```typescript
@NodeInjectable()
class PostgresDatabase { }

@NodeInjectable()
class Database { }

container.provide(PostgresDatabase);
container.provide({
  provide: Database,
  alias: PostgresDatabase // Database will resolve to PostgresDatabase
});
```

## 🔄 Dependency Injection

### Constructor Injection (via nodeInject)

```typescript
@NodeInjectable()
class EmailService {
  private readonly logger = nodeInject(Logger);
  private readonly config = nodeInject(CONFIG_TOKEN);

  public sendEmail(to: string, message: string) {
    this.logger.log(`Sending email to ${to}`);
    // Use this.config...
  }
}
```

### Optional Dependencies

```typescript
@NodeInjectable()
class MyService {
  private readonly optionalLogger = nodeInject(Logger, { optional: true });
  //               ^? Logger | null – infers nullability!

  public doSomething() {
    this.optionalLogger?.log('Doing something'); // May be null
  }
}
```

## 📦 Provider Sets

### Array Providers (Recommended)

Group related providers together using arrays:

```typescript
import { NodeContainer } from '@zodyac/illuma';

const container = new NodeContainer();

// Provide an array of providers
container.provide([
  Database,
  UserRepository,
  ProductRepository,
  {
    provide: CONNECTION_TOKEN,
    factory: () => createConnection()
  }
]);

container.bootstrap();
```

Arrays can be nested for better organization:

```typescript
const databaseProviders = [
  Database,
  { provide: CONNECTION_TOKEN, factory: () => createConnection() }
];

const repositoryProviders = [
  UserRepository,
  ProductRepository
];

container.provide([
  databaseProviders,
  repositoryProviders
]);
```

### Provider Sets (Deprecated)

> **Note:** `createProviderSet` is deprecated. Use array providers instead.

```typescript
import { createProviderSet } from '@zodyac/illuma';

const databaseProviders = createProviderSet(
  Database,
  UserRepository,
  ProductRepository,
  {
    provide: CONNECTION_TOKEN,
    factory: () => createConnection()
  }
);

const container = new NodeContainer();
container.include(databaseProviders); // deprecated
container.bootstrap();
```

## 🔧 Advanced Usage

### Using the Injector Token

The `Injector` token allows you to access the DI container from within your services, enabling dynamic dependency retrieval outside of the injection context:

```typescript
import { Injector, nodeInject, NodeInjectable } from '@zodyac/illuma';

@NodeInjectable()
class PluginManager {
  private readonly injector = nodeInject(Injector);

  public getPlugin(pluginToken: Token<any>) {
    // Dynamically retrieve a dependency at runtime
    const plugin = this.injector.get(pluginToken);
    return plugin;
  }
}
```

This is particularly useful for:
- **Dynamic service loading**: Retrieve services based on runtime conditions
- **Plugin systems**: Load plugins dynamically from a registry
- **Factory patterns**: Create instances with dependencies injected from the container
- **Service locator pattern**: When you need access to multiple services conditionally

### Circular Dependencies

Illuma automatically detects and prevents circular dependencies:

```typescript
// This will throw an error
@NodeInjectable()
class ServiceA {
  private readonly b = nodeInject(ServiceB);
}

@NodeInjectable()
class ServiceB {
  private readonly a = nodeInject(ServiceA); // Circular!
}
```

### Performance Monitoring

```typescript
const container = new NodeContainer({
  measurePerformance: true
});

// Container will track instantiation times
```

### Override Providers

```typescript
@NodeInjectable()
class RealEmailService { }

container.provide(RealEmailService);

// Override with a mock for testing
container.provide({
  provide: RealEmailService,
  useClass: MockEmailService
});
```

### Async Injection & Sub-Containers

Illuma supports lazy-loaded dependencies and sub-containers through `injectAsync` and `injectChildrenAsync`. These utilities are useful for:

- **Code splitting**: Load heavy dependencies only when needed
- **Lazy initialization**: Defer expensive setup until required
- **Dynamic modules**: Load plugins or features on-demand
- **Sub-container management**: Create isolated DI contexts

```typescript
// In analysis-service.ts

@NodeInjectable()
export class AnalyticsService {
  public track(event: string) {
    console.log(`Tracking event: ${event}`);
  }

  public sendReport() {
    console.log('Sending analytics report...');
  }
}

// In feature-service.ts
import { injectAsync, injectChildrenAsync } from '@zodyac/illuma';

@NodeInjectable()
class FeatureService {
  // Lazy-load a heavy dependency
  private readonly getAnalytics = injectAsync(
    () => import('./analytics-service').then((m) => m.AnalyticsService),
  );

  async trackEvent(event: string) {
    // Both methods will use the same instance (by default)
    const analytics = await this.getAnalytics();
    analytics.track(event);
  }

  async sendReport() {
    // By default, this will be the same instance as above
    const analytics = await this.getAnalytics();
    analytics.sendReport();
  }
}
```

Or, create isolated sub-containers:

```typescript

// In plugins.ts
export function providePlugins() {
  return [
    {
      provide: PLUGIN_TOKEN,
      factory: () => new PluginA(),
    },
    {
      provide: PLUGIN_TOKEN,
      factory: () => new PluginB(),
    }
  ];
}

// In plugin-host.ts 
import { injectGroupAsync } from '@zodyac/illuma';

@NodeInjectable()
class PluginHost {
  // Create an isolated sub-container for plugins
  private readonly getPluginContainer = injectGroupAsync(
    () => import('./plugins').then((m) => m.providePlugins()),
  );

  async executePlugins() {
    const injector = await this.getPluginContainer();
    const plugins = injector.get(PLUGIN_TOKEN);
    // ... use plugins
  }
}
```

> **Note:** `injectChildrenAsync` is deprecated. Use `injectGroupAsync` with array providers instead.

For comprehensive documentation on async injection patterns, see **[Async Injection Guide (INHERITANCE.md)](./docs/INHERITANCE.md)**.

## 🧪 Testing

Illuma provides a dedicated testkit to make testing services with dependency injection simple and intuitive.

### Quick Example

```typescript
import { createTestFactory } from '@zodyac/illuma/testkit';

describe('UserService', () => {
  const createTest = createTestFactory({
    target: UserService,
    provide: [Logger], // Use array of providers
  });

  it('should fetch user', () => {
    const { instance } = createTest();
    const user = instance.getUser('123');
    
    expect(user).toBeDefined();
  });
});
```

### Testing with Mocks

```typescript
import { createTestFactory } from '@zodyac/illuma/testkit';

const createTest = createTestFactory({
  target: UserService,
  provide: [
    {
      provide: Logger,
      useClass: MockLogger,
    }
  ],
});
```

### Legacy API (Deprecated)

```typescript
import { createProviderSet } from '@zodyac/illuma';

const createTest = createTestFactory({
  target: UserService,
  providers: createProviderSet(Logger), // deprecated
});
```

For comprehensive testing documentation, examples, and best practices, see the **[Testing Guide (TESTKIT.md)](./docs/TESTKIT.md)**.

The testkit supports:
- ✅ Isolated test environments with clean DI containers
- ✅ Easy dependency mocking and stubbing
- ✅ Works with Jest, Vitest, Mocha, Node Test Runner, and more
- ✅ Full TypeScript support with type inference

## 📚 API Reference

For complete API documentation including detailed method signatures, parameters, and examples, see the **[API Reference](./docs/API.md)**.

## ⚠️ Troubleshooting

See the [Error Reference](./docs/TROUBLESHOOTING.md) for common issues and solutions.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT © [bebrasmell](https://github.com/git-zodyac)

## 🔗 Links

- [GitHub Repository](https://github.com/git-zodyac/illuma)
- [NPM Package](https://www.npmjs.com/package/@zodyac/illuma)
- [Report Issues](https://github.com/git-zodyac/illuma/issues)
