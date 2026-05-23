# Testing

Import testing utilities from the `@illuma/core/testkit` subpath:

```typescript
import { createTestFactory } from '@illuma/core/testkit';
```

## Basic service test

```typescript
import { describe, it, expect } from 'vitest';
import { NodeInjectable, nodeInject } from '@illuma/core';
import { createTestFactory } from '@illuma/core/testkit';

@NodeInjectable()
class UserService {
  public getUser() {
    return { id: 1, name: 'Alice' };
  }
}

describe('UserService', () => {
  const createTest = createTestFactory({ target: UserService });

  it('should return a user', () => {
    const { instance } = createTest();
    expect(instance.getUser()).toEqual({ id: 1, name: 'Alice' });
  });
});
```

## Mocking dependencies

```typescript
class MockEmailService {
  public readonly sent: string[] = [];
  public send(to: string) {
    this.sent.push(to);
  }
}

describe('NotificationService', () => {
  const createTest = createTestFactory({
    target: NotificationService,
    provide: [{ provide: EmailService, useClass: MockEmailService }],
  });

  it('should send an email', () => {
    const { instance, injector } = createTest();
    instance.notify('user@example.com');
    const mock = injector.get(EmailService) as MockEmailService;
    expect(mock.sent).toContain('user@example.com');
  });
});
```

## Testing with tokens

```typescript
const API_URL = new NodeToken<string>('API_URL');

describe('ApiClient', () => {
  const createTest = createTestFactory({
    target: ApiClient,
    provide: [API_URL.withValue('https://test.example.com')],
  });

  it('should use the provided URL', () => {
    const { instance } = createTest();
    expect(instance.baseUrl).toBe('https://test.example.com');
  });
});
```
