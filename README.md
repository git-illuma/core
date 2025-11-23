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
- [📚 API Reference](#-api-reference)
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

```ts
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
  log(message: string) {
    console.log(`[LOG]: ${message}`);
  }
}

@NodeInjectable()
class UserService {
  private logger = nodeInject(Logger);

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
    return new Database({
      host: 'localhost',
      port: 5432
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
  private logger = nodeInject(Logger);
  private config = nodeInject(CONFIG_TOKEN);

  sendEmail(to: string, message: string) {
    this.logger.log(`Sending email to ${to}`);
    // Use this.config...
  }
}
```

### Optional Dependencies

```typescript
@NodeInjectable()
class MyService {
  private optionalLogger = nodeInject(Logger, { optional: true });

  doSomething() {
    this.optionalLogger?.log('Doing something'); // May be null
  }
}
```

## 📦 Provider Sets

Group related providers together:

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
container.include(databaseProviders);
container.bootstrap();
```

## 🔧 Advanced Usage

### Circular Dependencies

Illuma automatically detects and prevents circular dependencies:

```typescript
// This will throw an error
@NodeInjectable()
class ServiceA {
  private b = nodeInject(ServiceB);
}

@NodeInjectable()
class ServiceB {
  private a = nodeInject(ServiceA); // Circular!
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

## 🧪 Testing

Illuma provides a dedicated testkit to make testing services with dependency injection simple and intuitive.

### Quick Example

```typescript
import { createTestFactory } from '@zodyac/illuma/testkit';
import { createProviderSet } from '@zodyac/illuma';

describe('UserService', () => {
  const createTest = createTestFactory({
    target: UserService,
    providers: createProviderSet(Logger),
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
  providers: createProviderSet({
    provide: Logger,
    useClass: MockLogger,
  }),
});
```

For comprehensive testing documentation, examples, and best practices, see the **[Testing Guide (TESTKIT.md)](./TESTKIT.md)**.

The testkit supports:
- ✅ Isolated test environments with clean DI containers
- ✅ Easy dependency mocking and stubbing
- ✅ Works with Jest, Vitest, Mocha, Node Test Runner, and more
- ✅ Full TypeScript support with type inference

## 📚 API Reference

### NodeContainer

- `provide<T>(provider: Providable<T>): void` - Register a provider
- `include(providerSet: iNodeProviderSet): void` - Include a provider set
- `bootstrap(): void` - Build the dependency tree
- `get<T>(token: Token<T>): T` - Retrieve an instance

### NodeToken

- `new NodeToken<T>(name: string, options?: { factory?: () => T })` - Create a token

### MultiNodeToken

- `new MultiNodeToken<T>(name: string, options?: { factory?: () => T })` - Create a multi-token

### nodeInject

- `nodeInject<T>(token: Token<T>, options?: { optional?: boolean }): T` - Inject a dependency

### Decorators

- `@NodeInjectable()` - Mark a class as injectable

## ⚠️ Troubleshooting

See the [Error Reference](./TROUBLESHOOTING.md) for common issues and solutions.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT © [bebrasmell](https://github.com/git-zodyac)

## 🔗 Links

- [GitHub Repository](https://github.com/git-zodyac/illuma)
- [NPM Package](https://www.npmjs.com/package/@zodyac/illuma)
- [Report Issues](https://github.com/git-zodyac/illuma/issues)
