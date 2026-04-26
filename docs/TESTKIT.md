# Testing Guide

The Illuma testkit provides framework-agnostic utilities for testing components that use dependency injection.

## Table of contents

- [Testing Guide](#testing-guide)
  - [Table of contents](#table-of-contents)
  - [Installation](#installation)
  - [Quick start](#quick-start)
    - [Basic service testing](#basic-service-testing)
  - [Testing with dependencies](#testing-with-dependencies)
  - [Mocking dependencies](#mocking-dependencies)
  - [Testing with tokens](#testing-with-tokens)
  - [Testing Multi-Token dependencies](#testing-multi-token-dependencies)
  - [Optional dependencies](#optional-dependencies)
  - [Framework examples](#framework-examples)
    - [Vitest](#vitest)
    - [Mocha](#mocha)
    - [Node test runner](#node-test-runner)
  - [API Reference](#api-reference)
    - [`createTestFactory<T>(config)`](#createtestfactorytconfig)
    - [`TestFactoryFn<T>`](#testfactoryfnt)
    - [`Spectator<T>`](#spectatort)
  - [Best practices](#best-practices)
  - [Related documentation](#related-documentation)

## Installation

The testkit is included with Illuma. Import from the `/testkit` subpath:

```typescript
import { createTestFactory } from '@illuma/core/testkit';
```

## Quick start

### Basic service testing

```typescript
import { NodeInjectable } from '@illuma/core';
import { createTestFactory } from '@illuma/core/testkit';

@NodeInjectable()
class UserService {
  public getUser() {
    return { id: 1, name: 'John Doe' };
  }
}

describe('UserService', () => {
  const createTest = createTestFactory({ target: UserService });

  it('should get user', () => {
    const { instance } = createTest();
    
    expect(instance.getUser()).toEqual({ id: 1, name: 'John Doe' });
  });
});
```

## Testing with dependencies

```typescript
import { NodeInjectable, nodeInject } from '@illuma/core';
import { createTestFactory } from '@illuma/core/testkit';

@NodeInjectable()
class DatabaseService {
  public query(sql: string) {
    return [{ id: 1, name: 'Alice' }];
  }
}

@NodeInjectable()
class UserRepository {
  private readonly db = nodeInject(DatabaseService);

  public findAll() {
    return this.db.query('SELECT * FROM users');
  }
}

describe('UserRepository', () => {
  const createTest = createTestFactory({
    target: UserRepository,
    provide: [{
      provide: DatabaseService,
      useClass: MockDatabaseService,
    }]
  });

  it('should find all users', () => {
    const { instance } = createTest();
    
    expect(instance.findAll()).toHaveLength(1);
  });
});
```

## Mocking dependencies

Replace real dependencies with mocks or stubs:

```typescript
import { NodeInjectable, nodeInject } from '@illuma/core';
import { createTestFactory } from '@illuma/core/testkit';

@NodeInjectable()
class EmailService {
  public send(to: string, message: string) {
    // Real implementation would send email
    console.log(`Sending to ${to}: ${message}`);
  }
}

class MockEmailService {
  public readonly sent: Array<{ to: string; message: string }> = [];
  
  public send(to: string, message: string) {
    this.sent.push({ to, message });
  }
}

@NodeInjectable()
class NotificationService {
  private readonly email = nodeInject(EmailService);

  public notifyUser(userId: string, message: string) {
    this.email.send(`user-${userId}@example.com`, message);
  }
}

describe('NotificationService', () => {
  const createTest = createTestFactory({
    target: NotificationService,
    provide: [
      provide: EmailService,
      useClass: MockEmailService,
    ],
  });

  it('should send notification via email', () => {
    const { instance, nodeInject } = createTest();
    const mockEmail = nodeInject(EmailService) as MockEmailService;
    
    instance.notifyUser('123', 'Hello!');
    
    expect(mockEmail.sent).toHaveLength(1);
    expect(mockEmail.sent[0]).toEqual({
      to: 'user-123@example.com',
      message: 'Hello!',
    });
  });
});
```

## Testing with tokens

```typescript
import { NodeToken, NodeInjectable, nodeInject } from '@illuma/core';
import { createTestFactory } from '@illuma/core/testkit';

const API_URL = new NodeToken<string>('API_URL');
const API_KEY = new NodeToken<string>('API_KEY');

@NodeInjectable()
class ApiClient {
  private readonly url = nodeInject(API_URL);
  private readonly key = nodeInject(API_KEY);

  public getEndpoint() {
    return `${this.url}?key=${this.key}`;
  }
}

describe('ApiClient', () => {
  const createTest = createTestFactory({
    target: ApiClient,
    provide: [
      API_URL.withValue('https://api.test.com'),
      API_KEY.withValue('test-key-123'),
    ],
  });

  it('should construct endpoint URL', () => {
    const { instance } = createTest();
    
    expect(instance.getEndpoint()).toBe('https://api.test.com?key=test-key-123');
  });
});
```

## Testing Multi-Token dependencies

```typescript
import { MultiNodeToken, NodeInjectable, nodeInject } from '@illuma/core';
import { createTestFactory } from '@illuma/core/testkit';

interface Plugin {
  name: string;
  execute(): void;
}

const PLUGIN = new MultiNodeToken<Plugin>('PLUGIN');

@NodeInjectable()
class LoggerPlugin implements Plugin {
  public readonly name = 'logger';
  public execute() {
    console.log('Logging...');
  }
}

@NodeInjectable()
class CachePlugin implements Plugin {
  public readonly name = 'cache';
  public execute() {
    console.log('Caching...');
  }
}

@NodeInjectable()
class PluginManager {
  private readonly plugins = nodeInject(PLUGIN);

  public runAll() {
    this.plugins.forEach(p => p.execute());
  }

  public getPluginNames() {
    return this.plugins.map(p => p.name);
  }
}

describe('PluginManager', () => {
  const createTest = createTestFactory({
    target: PluginManager,
    provide: [
      PLUGIN.withAlias(LoggerPlugin),
      PLUGIN.withAlias(CachePlugin),
    ],
  });

  it('should have all plugins', () => {
    const { instance } = createTest();
    
    expect(instance.getPluginNames()).toEqual(['logger', 'cache']);
  });
});
```

## Optional dependencies

Test services with optional dependencies:

```typescript
import { NodeToken, NodeInjectable, nodeInject } from '@illuma/core';
import { createTestFactory } from '@illuma/core/testkit';

const LOGGER = new NodeToken<{ log(msg: string): void }>('LOGGER');

@NodeInjectable()
class Service {
  private readonly logger = nodeInject(LOGGER, { optional: true });

  public doWork() {
    this.logger?.log('Working...');
    return 'done';
  }
}

describe('Service', () => {
  it('should work without optional logger', () => {
    const createTest = createTestFactory({ target: Service });
    const { instance, nodeInject } = createTest();
    
    expect(nodeInject(LOGGER, { optional: true })).toBeNull();
    expect(instance.doWork()).toBe('done');
  });

  it('should use logger when provided', () => {
    const mockLogger = { log: jest.fn() };
    const createTest = createTestFactory({
      target: Service,
      provide: [LOGGER.withValue(mockLogger)],
    });
    
    const { instance } = createTest();
    instance.doWork();
    
    expect(mockLogger.log).toHaveBeenCalledWith('Working...');
  });
});
```

## Framework examples

While the examples above use Jest, the testkit works with any JavaScript testing framework.

### Vitest

```typescript
import { describe, it, expect } from 'vitest';
import { createTestFactory } from '@illuma/core/testkit';

describe('MyService', () => {
  const createTest = createTestFactory({ target: MyService });

  it('should work', () => {
    const { instance } = createTest();
    expect(instance.getValue()).toBe('expected');
  });
});
```

### Mocha

```typescript
import { expect } from 'chai';
import { createTestFactory } from '@illuma/core/testkit';

describe('MyService', () => {
  const createTest = createTestFactory({ target: MyService });

  it('should work', () => {
    const { instance } = createTest();
    expect(instance.getValue()).to.equal('expected');
  });
});
```

### Node test runner

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createTestFactory } from '@illuma/core/testkit';

describe('MyService', () => {
  const createTest = createTestFactory({ target: MyService });

  it('should work', () => {
    const { instance } = createTest();
    assert.strictEqual(instance.getValue(), 'expected');
  });
});
```

## API Reference

### `createTestFactory<T>(config)`

Creates a test factory for the specified target.

**Parameters:**

| Parameter          | Type               | Description                                        |
| ------------------ | ------------------ | -------------------------------------------------- |
| `config.target`    | `Token<T>`         | The class or token to instantiate                  |
| `config.provide`   | `Provider[]`       | Array of providers to include                      |

**Returns:** `TestFactoryFn<T>` - A function that creates test instances

### `TestFactoryFn<T>`

A function that creates a new test instance with a clean DI container.

**Returns:** `Spectator<T>`

### `Spectator<T>`

The object returned by test factory functions.

| Property/Method               | Type                        | Description                                 |
| ----------------------------- | --------------------------- | ------------------------------------------- |
| `instance`                    | `T`                         | The instantiated service being tested       |
| `nodeInject(token, options?)` | `<U>(token: Token<U>) => U` | Inject a dependency from the test container |

## Best practices

1. **Create factory once per test suite**: Define `createTest` outside of individual test cases for better performance
2. **Call factory in each test**: Call the factory function inside each test to ensure isolation
3. **Use mocks for external dependencies**: Replace external services (HTTP, database, etc.) with mocks
4. **Test one thing at a time**: Focus each test on a single behavior
5. **Leverage TypeScript**: Use types to ensure test correctness at compile time

## Related documentation

- [Getting Started](./GETTING_STARTED.md) - Setup and basic concepts
- [Providers Guide](./PROVIDERS.md) - Provider types
- [Tokens Guide](./TOKENS.md) - Using tokens
- [API Reference](./API.md) - Complete API documentation
- [Error Reference](./TROUBLESHOOTING.md) - Troubleshooting
