# **Illuma** – Dependency Injection for TypeScript

![NPM Version](https://img.shields.io/npm/v/%40illuma%2Fcore)
![NPM Downloads](https://img.shields.io/npm/dw/%40illuma%2Fcore)
![npm bundle size](https://img.shields.io/bundlephobia/min/%40illuma%2Fcore)
![Test coverage](./badges/coverage.svg)

A universal, lightweight and type-safe dependency injection container for TypeScript.
Heavily inspired by Angular's DI system, but designed to work in any environment (Node.js, Bun, Deno, browsers, and more).

## Features

- **Type-Safe** – Excellent type inference
- **Lightweight** – Zero dependencies, minimal bundle size
- **Flexible** – Classes, factories, values, and aliases
- **Optional decorators** – Injectable classes with `@NodeInjectable()` decorator
- **Multi-Tokens** – Built-in multi-provider support
- **Plugin System** – Extensible architecture with custom middlewares, scanners, and diagnostics
- **TestKit** – Unit testing and mocking utilities for any testing framework
- **Universal** – Node.js, Bun, Deno, browser, and Electron

## Installation

```bash
npm install @illuma/core
```

## Compatibility

Compatible with virtually anything supporting ES2015+ (ES6+).
Practically the library is compatible with Node.js (v14+), Bun, Deno and all modern browsers.
For older environments, consider using a transpiler or provide polyfills as needed.

## Quick start

```typescript
import { NodeContainer, NodeInjectable, nodeInject } from '@illuma/core';

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

> **Note:** 
> Example above requires `experimentalDecorators` and `emitDecoratorMetadata` in tsconfig. 
> See [Getting Started](./docs/GETTING_STARTED.md) for decorator-free alternatives.

## Using Tokens

```typescript
import { NodeToken, MultiNodeToken, NodeContainer } from '@illuma/core';

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

## Provider types

```typescript
// Class provider
container.provide(MyService);

// Value provider
container.provide({ provide: CONFIG, value: { apiUrl: '...' } });

// Factory provider
container.provide({ provide: DATABASE, factory: () => {
  // You can use nodeInject inside factories!
  const env = nodeInject(ENV);
  return createDatabase(env.connectionString);
} });

// Class provider with custom implementation
container.provide({ provide: DATABASE, useClass: DatabaseImplementation });

// Alias provider
container.provide({ provide: Database, alias: ExistingDatabase });
```

See [Providers Guide](./docs/PROVIDERS.md) for details.

## Testing

```typescript
import { createTestFactory } from '@illuma/core/testkit';

const createTest = createTestFactory({
  target: UserService,
  provide: [{ provide: Logger, useClass: MockLogger }],
});

it('should fetch user', () => {
  const { instance } = createTest();
  expect(instance.getUser('123')).toBeDefined();
});
```

See [Testing Guide](./docs/TESTKIT.md) for examples.

## Documentation

| Guide                                              | Description                                           |
| :--                                                | :--                                                   |
| [Getting Started](./docs/GETTING_STARTED.md)       | Installation, setup, and basic usage                  |
| [Providers](./docs/PROVIDERS.md)                   | Value, factory, class, and alias providers            |
| [Tokens](./docs/TOKENS.md)                         | NodeToken and MultiNodeToken                          |
| [Async Injection](./docs/ASYNC_INJECTION.md)       | Lazy loading and sub-containers                       |
| [Testing](./docs/TESTKIT.md)                       | TestKit and mocking                                   |
| [Plugins](./docs/PLUGINS.md)                       | Extending Illuma with custom scanners and diagnostics |
| [Technical Overview](./docs/TECHNICAL_OVERVIEW.md) | Deep dive into how Illuma works                       |
| [API Reference](./docs/API.md)                     | Complete API documentation                            |
| [Troubleshooting](./docs/TROUBLESHOOTING.md)       | Error codes and solutions                             |

## Plugins

Illuma supports plugins! Check these out:

- **[@illuma/reflect](https://github.com/git-illuma/reflect)** – Constructor metadata and property decorator injection support

See [Plugins Guide](./docs/PLUGINS.md) for creating your own plugins.

## Contributing

Thank you for considering contributing to Illuma! I deeply appreciate your interest in making this project better.

Anyways, to get you started, please take a look at the [Contributing Guide](./CONTRIBUTING.md) for guidelines on how to setup development environment, run tests, and submit pull requests.

## License

MIT

Created by [bebrasmell](https://github.com/bebrasmell)

## Links
- [NPM](https://npmjs.com/package/@illuma/core)
- [GitHub](https://github.com/git-illuma/core)
- [Issues](https://github.com/git-illuma/core/issues)
