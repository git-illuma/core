# 🚀 Getting Started

This guide will walk you through setting up Illuma and creating your first dependency injection container.

## Table of contents

- [🚀 Getting Started](#-getting-started)
  - [Table of contents](#table-of-contents)
  - [Installation](#installation)
  - [TypeScript configuration (for decorators if using)](#typescript-configuration-for-decorators-if-using)
    - [Alternative: Without decorators](#alternative-without-decorators)
  - [Basic setup](#basic-setup)
  - [Your first container](#your-first-container)
  - [Injecting dependencies](#injecting-dependencies)
    - [Optional dependencies](#optional-dependencies)
  - [Using tokens](#using-tokens)
  - [Root-scoped singletons](#root-scoped-singletons)
    - [How it works](#how-it-works)
    - [Important behavior](#important-behavior)
  - [Next steps](#next-steps)

## Installation

Install Illuma using your preferred package manager:

```bash
npm install @illuma/core
# or
pnpm add @illuma/core
# or
yarn add @illuma/core
# or
bun add @illuma/core
```

## TypeScript configuration (for decorators if using)

To use decorators like `@NodeInjectable()`, enable experimental decorators in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### Alternative: Without decorators

If you prefer not to use decorators, use `makeInjectable` to mark classes as injectable:

```typescript
import { makeInjectable } from '@illuma/core';

class _UserService {
  public getUser() {
    return { id: 1, name: "John Doe" };
  }
}

export type UserService = _UserService;
export const UserService = makeInjectable(_UserService);
```

## Basic setup

Illuma uses three core concepts:

1. **Container** - Manages all your dependencies
2. **Providers** - Register services and values
3. **Injection** - Retrieve dependencies when needed

## Your first container

```typescript
import { NodeContainer, NodeInjectable, nodeInject } from '@illuma/core';

// 1. Define injectable services
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

// 2. Create and configure container
const container = new NodeContainer();

// 3. Register providers
container.provide([Logger, UserService]);

// 4. Bootstrap the container
container.bootstrap();

// 5. Use your services
const userService = container.get(UserService);
const user = userService.getUser('123');
```

## Injecting dependencies

Use `nodeInject()` to inject dependencies into your services:

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

Or you can inject via factory functions:

```typescript
container.provide({
  provide: EMAIL_SERVICE,
  factory: () => {
    const logger = nodeInject(Logger);
    return new EmailService(logger);
  }
});
```

### Optional dependencies

Mark dependencies as optional to handle cases where they may not be provided:

```typescript
@NodeInjectable()
class MyService {
  private readonly optionalLogger = nodeInject(Logger, { optional: true });
  //                       ^? Logger | null – infers nullability!

  public doSomething() {
    this.optionalLogger?.log('Doing something');
  }
}
```

## Using tokens

Tokens let you inject values that aren't classes, like configuration objects:

```typescript
import { NodeToken, NodeContainer } from '@illuma/core';

// Define a token
interface Config {
  apiUrl: string;
  timeout: number;
}

const CONFIG_TOKEN = new NodeToken<Config>('CONFIG');

// Provide a value
const container = new NodeContainer();

container.provide({
  provide: CONFIG_TOKEN,
  value: {
    apiUrl: 'https://api.example.com',
    timeout: 5000
  }
});

// Or use the helper method
container.provide(
  CONFIG_TOKEN.withValue({
    apiUrl: 'https://api.example.com',
    timeout: 5000
  })
);

container.bootstrap();
const config = container.get(CONFIG_TOKEN);
```

## Root-scoped singletons

Use `{ singleton: true }` to make an injectable class behave like Angular's `providedIn: 'root'`.

```typescript
import { NodeContainer, NodeInjectable } from '@illuma/core';

@NodeInjectable({ singleton: true })
class GlobalService {
  public readonly id = Math.random();
}

const root = new NodeContainer();
const childA = new NodeContainer({ parent: root });
const childB = new NodeContainer({ parent: root });

root.bootstrap();
childA.bootstrap();
childB.bootstrap();

const a = childA.get(GlobalService);
const b = childB.get(GlobalService);
const r = root.get(GlobalService);

console.log(a === b && b === r); // true
```

### How it works

1. The singleton class stores metadata on its token.
2. On first resolution from any child/root container, Illuma attaches that provider to the root container tree.
3. The same root instance is then reused across descendants.

### Important behavior

1. Child overrides (using `.provide()`) still work locally and do not replace the root singleton globally.
2. Root singletons can only inject dependencies visible from root (not child-only providers).
3. Circular dependency detection works the same as for normal providers.

## Next steps

Now that you understand the basics, explore these topics:

- **[Providers Guide](./PROVIDERS.md)** - Learn about different provider types (value, factory, class, alias)
- **[Tokens Guide](./TOKENS.md)** - Deep dive into NodeToken and MultiNodeToken
- **[Async Injection Guide](./ASYNC_INJECTION.md)** - Lazy loading and sub-containers
- **[Testing Guide](./TESTKIT.md)** - Testing with the Illuma testkit
- **[API Reference](./API.md)** - Complete API documentation
- **[Error Reference](./TROUBLESHOOTING.md)** - Troubleshooting common issues
