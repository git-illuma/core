# 🔥 Illuma – Angular-style Dependency Injection for TypeScript

![NPM Version](https://img.shields.io/npm/v/%40zodyac%2Filluma)
![NPM Downloads](https://img.shields.io/npm/dw/%40zodyac%2Filluma)
![npm bundle size](https://img.shields.io/bundlephobia/min/%40zodyac%2Filluma)
![Test coverage](./badges/coverage.svg)

A lightweight, type-safe dependency injection container for TypeScript. Zero dependencies.

> [!NOTE]
> This package is in early development. Expect API changes in minor versions.

## ✨ Features

- 🎯 **Type-Safe** – Full TypeScript support with excellent type inference
- 🪶 **Lightweight** – Zero dependencies, minimal bundle size
- 🔄 **Flexible** – Classes, factories, values, and aliases
- 🎨 **Decorators** – Optional Angular-style `@NodeInjectable()` decorator
- 🔗 **Multi-Tokens** – Built-in multi-provider support
- 🔌 **Plugin System** – Extensible architecture with custom scanners and diagnostics
- 🌍 **Universal** – Node.js, Deno, browser, and Electron

## 📦 Installation

```bash
npm install @zodyac/illuma
```

## 🚀 Quick Start

```typescript
import { NodeContainer, NodeInjectable, nodeInject } from '@zodyac/illuma';

@NodeInjectable()
class Logger {
  public log(message: string) {
    console.log(`[LOG]: ${message}`);
  }
}

@NodeInjectable()
class UserService {
  private readonly logger = nodeInject(Logger);

  public getUser(id: string) {
    this.logger.log(`Fetching user ${id}`);
    return { id, name: 'John Doe' };
  }
}

const container = new NodeContainer();
container.provide([Logger, UserService]);
container.bootstrap();

const userService = container.get(UserService);
```

> **Note:** Requires `experimentalDecorators` and `emitDecoratorMetadata` in tsconfig. See [Getting Started](./docs/GETTING_STARTED.md) for decorator-free alternatives.

## 🏷️ Using Tokens

```typescript
import { NodeToken, MultiNodeToken, NodeContainer } from '@zodyac/illuma';

// Single-value token
const CONFIG = new NodeToken<{ apiUrl: string }>('CONFIG');

// Multi-value token (when injected, returns array)
const PLUGINS = new MultiNodeToken<Plugin>('PLUGINS');

const container = new NodeContainer();

container.provide([
  // Equivalent to:
  // { provide: CONFIG, value: { apiUrl: 'https://api.example.com' } }
  CONFIG.withValue({ apiUrl: 'https://api.example.com' }),

  // Equivalent to:
  // { provide: PLUGINS, useClass: AnalyticsPlugin }
  PLUGINS.withClass(AnalyticsPlugin),

  // Equivalent to:
  // { provide: PLUGINS, useClass: LoggingPlugin }
  PLUGINS.withClass(LoggingPlugin),
]);

container.bootstrap();

const config = container.get(CONFIG);    // { apiUrl: string }
const plugins = container.get(PLUGINS);  // Plugin[]: [AnalyticsPlugin, LoggingPlugin]
```

See [Tokens Guide](./docs/TOKENS.md) for more details.

## 🎨 Provider Types

```typescript
// Class provider
container.provide(MyService);

// Value provider
container.provide({ provide: CONFIG, value: { apiUrl: '...' } });

// Factory provider
container.provide({ provide: DATABASE, factory: () => {
  const env = nodeInject(ENV);
  return createDatabase(env.connectionString);
} });

// Class provider with custom implementation
container.provide({ provide: DATABASE, useClass: DatabaseImplementation });

// Alias provider
container.provide({ provide: Database, alias: ExistingDatabase });
```

See [Providers Guide](./docs/PROVIDERS.md) for details.

## 🧪 Testing

```typescript
import { createTestFactory } from '@zodyac/illuma/testkit';

const createTest = createTestFactory({
  target: UserService,
  provide: [{ provide: Logger, useClass: MockLogger }],
});

it('should fetch user', () => {
  const { instance } = createTest();
  expect(instance.getUser('123')).toBeDefined();
});
```

See [Testing Guide](./docs/TESTKIT.md) for comprehensive examples.

## 📚 Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](./docs/GETTING_STARTED.md) | Installation, setup, and basic usage |
| [Providers](./docs/PROVIDERS.md) | Value, factory, class, and alias providers |
| [Tokens](./docs/TOKENS.md) | NodeToken and MultiNodeToken |
| [Async Injection](./docs/ASYNC_INJECTION.md) | Lazy loading and sub-containers |
| [Testing](./docs/TESTKIT.md) | Testkit and mocking |
| [Plugins](./docs/PLUGINS.md) | Extending Illuma with custom scanners and diagnostics |
| [Technical Overview](./docs/TECHNICAL_OVERVIEW.md) | Deep dive into how Illuma works |
| [API Reference](./docs/API.md) | Complete API documentation |
| [Troubleshooting](./docs/TROUBLESHOOTING.md) | Error codes and solutions |

## 📄 License

MIT © [bebrasmell](https://github.com/git-zodyac)

## 🔗 Links

- [GitHub](https://github.com/git-zodyac/illuma)
- [NPM](https://www.npmjs.com/package/@zodyac/illuma)
- [Issues](https://github.com/git-zodyac/illuma/issues)
