# ⚠️ Error Reference

This document provides detailed information about all error codes in Illuma and how to resolve them.

## Table of Contents

- [Quick Reference](#quick-reference)
- [Provider Errors (i100-i103)](#provider-errors)
- [Alias Errors (i200-i201)](#alias-errors)
- [Bootstrap Errors (i300-i302)](#bootstrap-errors)
- [Retrieval Errors (i400-i401)](#retrieval-errors)
- [Instantiation Errors (i500-i504)](#instantiation-errors)
- [Debugging Tips](#debugging-tips)

## Quick Reference

| Code | Error                  | Quick Fix                                |
| ---- | ---------------------- | ---------------------------------------- |
| i100 | Duplicate Provider     | Remove duplicate or use `MultiNodeToken` |
| i101 | Duplicate Factory      | Only provide one factory per token       |
| i102 | Invalid Constructor    | Add `@NodeInjectable()` decorator        |
| i103 | Invalid Provider       | Use valid provider syntax                |
| i200 | Invalid Alias          | Use token or decorated class             |
| i201 | Loop Alias             | Point alias to different token           |
| i300 | Not Bootstrapped       | Call `bootstrap()` first                 |
| i301 | Container Bootstrapped | Provide before `bootstrap()`             |
| i302 | Double Bootstrap       | Only bootstrap once                      |
| i400 | Provider Not Found     | Provide the token or use `optional`      |
| i401 | Circular Dependency    | Refactor to break cycle                  |
| i500 | Untracked Injection    | Use in class field initializers only     |
| i501 | Outside Context        | Use only in fields/factories             |
| i502 | Called Utils Outside   | Use only during instantiation            |
| i503 | Instance Access Failed | Check factory/constructor logic          |
| i504 | Access Failed          | Check provider configuration             |

---

## Provider Errors

### [i100] Duplicate Provider

**Error Message:**
```
Duplicate provider for token "TokenName" detected.
```

**Cause:**
You attempted to register the same token multiple times with different providers (excluding `MultiNodeToken`, which is designed for multiple providers).

**Example:**
```typescript
const CONFIG = new NodeToken<Config>('CONFIG');

container.provide({
  provide: CONFIG,
  value: { apiUrl: 'http://api1.com' }
});

// ❌ This will throw [i100]
container.provide({
  provide: CONFIG,
  value: { apiUrl: 'http://api2.com' }
});
```

**Solution:**
- Remove the duplicate provider registration
- If you need multiple values, use `MultiNodeToken` instead:

```typescript
const CONFIGS = new MultiNodeToken<Config>('CONFIGS');

container.provide({
  provide: CONFIGS,
  value: { apiUrl: 'http://api1.com' }
});

container.provide({
  provide: CONFIGS,
  value: { apiUrl: 'http://api2.com' }
});
// ✅ This works with MultiNodeToken
```

---

### [i101] Duplicate Factory

**Error Message:**
```
Tried to re-provide factory for token "TokenName" detected.
```

**Cause:**
You attempted to provide a factory for a token that already has a factory defined. This can happen when:
- You provide the same decorated class multiple times with different factories
- You override a token's built-in factory

**Example:**
```typescript
@NodeInjectable()
class MyService {
  public value = 'original';
}

container.provide(MyService);

// ❌ This will throw [i101]
container.provide({
  provide: MyService,
  factory: () => new MyService()
});
```

**Solution:**
Only provide one factory per token:

```typescript
@NodeInjectable()
class MyService {
  public value = 'original';
}

// ✅ Only provide the class once
container.provide(MyService);
```

For testing/overriding, use a different token:

```typescript
const MY_SERVICE = new NodeToken<MyService>('MY_SERVICE');

// ✅ Original
container.provide({
  provide: MY_SERVICE,
  useClass: MyService
});

// ✅ For testing, create a new container with mock
const testContainer = new NodeContainer();
testContainer.provide({
  provide: MY_SERVICE,
  factory: () => new MockMyService()
});
```

---

### [i102] Invalid Constructor

**Error Message:**
```
Cannot use constructor for token "ClassName". Please make sure to use @NodeInjectable() decorator
```

**Cause:**
You tried to provide a class directly to the container without marking it as injectable with the `@NodeInjectable()` decorator.

**Example:**
```typescript
class MyService {
  public doSomething() { }
}

// ❌ This will throw [i102]
container.provide(MyService);
```

**Solution:**
Add the `@NodeInjectable()` decorator to your class:

```typescript
@NodeInjectable()
class MyService {
  public doSomething() { }
}

// ✅ This works
container.provide(MyService);
```

Alternatively, use a token with a provider object:

```typescript
const MY_SERVICE = new NodeToken<MyService>('MY_SERVICE');

container.provide({
  provide: MY_SERVICE,
  useClass: MyService
});
// ✅ This also works
```

---

### [i103] Invalid Provider

**Error Message:**
```
Cannot use provider as it is neither a NodeToken nor MultiNodeToken nor a valid constructor.
```

**Cause:**
You passed an invalid value to `container.provide()`. The provider must be one of:
- A `NodeToken` or `MultiNodeToken`
- A class decorated with `@NodeInjectable()`
- A valid provider object with a `provide` property

**Example:**
```typescript
// ❌ All of these will throw [i103]
container.provide("some string");
container.provide(123);
container.provide({ invalid: 'object' });
container.provide(null);
```

**Solution:**
Use valid provider syntax:

```typescript
// ✅ Using decorated class
@NodeInjectable()
class MyService { }
container.provide(MyService);

// ✅ Using token
const TOKEN = new NodeToken('TOKEN');
container.provide(TOKEN);

// ✅ Using provider object
container.provide({
  provide: TOKEN,
  value: 'some value'
});
```

---

## Alias Errors

### [i200] Invalid Alias

**Error Message:**
```
Invalid alias target "<value>". Alias must be a NodeToken, MultiNodeToken, or a class decorated with @NodeInjectable().
```

**Cause:**
You tried to create an alias using an invalid target. The `alias` property must be one of:
- A `NodeToken`
- A `MultiNodeToken`
- A class decorated with `@NodeInjectable()`

Common mistakes:
- Using a plain string, number, or object as the alias
- Using an undecorated class
- Using a raw value instead of a token

**Example:**
```typescript
const SERVICE_A = new NodeToken('SERVICE_A');

// ❌ This will throw [i200] - string is not valid
container.provide({
  provide: SERVICE_A,
  alias: 'some-string'
});

// ❌ This will throw [i200] - plain object is not valid
container.provide({
  provide: SERVICE_A,
  alias: { value: 'test' }
});

// ❌ This will throw [i200] - undecorated class
class MyService { }

container.provide({
  provide: SERVICE_A,
  alias: MyService // Missing @NodeInjectable()
});
```

**Solution:**
Use a valid token or decorated class as the alias target:

```typescript
const SERVICE_A = new NodeToken('SERVICE_A');
const SERVICE_B = new NodeToken('SERVICE_B');

// ✅ Option 1: Alias to another token
container.provide({
  provide: SERVICE_B,
  useClass: MyService,
});

container.provide({
  provide: SERVICE_A,
  alias: SERVICE_B, // Valid: NodeToken
});

// ✅ Option 2: Alias to a decorated class
@NodeInjectable()
class MyService { }

container.provide(MyService);

container.provide({
  provide: SERVICE_A,
  alias: MyService // Valid: decorated class
});

// ✅ Option 3: Alias to a MultiNodeToken
const MULTI = new MultiNodeToken('MULTI');

container.provide({
  provide: SERVICE_A,
  alias: MULTI // Valid: MultiNodeToken
});
```

**Note:** You don't need to provide the alias target before creating the alias (unlike what you might expect). The target will be resolved when the container is bootstrapped. However, if the alias target is never provided, you'll get an `[i400] Provider Not Found` error when trying to retrieve it.

---

### [i201] Loop Alias

**Error Message:**
```
Token "TokenName" cannot alias itself in a loop.
```

**Cause:**
You tried to create a self-referential alias where a token points to itself.

**Example:**
```typescript
const TOKEN = new NodeToken('TOKEN');

// ❌ This will throw [i201]
container.provide({
  provide: TOKEN,
  alias: TOKEN
});
```

**Solution:**
Ensure aliases point to different tokens:

```typescript
const TOKEN_A = new NodeToken('TOKEN_A');
const TOKEN_B = new NodeToken('TOKEN_B');

container.provide({
  provide: TOKEN_B,
  value: 'some value'
});

// ✅ This works
container.provide({
  provide: TOKEN_A,
  alias: TOKEN_B
});
```

---

## Bootstrap Errors

### [i300] Not Bootstrapped

**Error Message:**
```
Cannot retrieve providers before the container has been bootstrapped.
```

**Cause:**
You attempted to call `container.get()` before calling `container.bootstrap()`.

**Example:**
```typescript
const container = new NodeContainer();
const TOKEN = new NodeToken('TOKEN');

container.provide({
  provide: TOKEN,
  value: 'test'
});

// ❌ This will throw [i300]
const value = container.get(TOKEN);
```

**Solution:**
Always call `bootstrap()` before retrieving providers:

```typescript
const container = new NodeContainer();
const TOKEN = new NodeToken('TOKEN');

container.provide({
  provide: TOKEN,
  value: 'test'
});

// ✅ Bootstrap first
container.bootstrap();

// ✅ Now you can get providers
const value = container.get(TOKEN);
```

---

### [i301] Container Bootstrapped

**Error Message:**
```
Cannot modify providers after the container has been bootstrapped.
```

**Cause:**
You tried to register providers after calling `container.bootstrap()`.

**Example:**
```typescript
const container = new NodeContainer();
container.bootstrap();

const TOKEN = new NodeToken('TOKEN');

// ❌ This will throw [i301]
container.provide({
  provide: TOKEN,
  value: 'test'
});
```

**Solution:**
Register all providers before bootstrapping:

```typescript
const container = new NodeContainer();
const TOKEN = new NodeToken('TOKEN');

// ✅ Provide before bootstrap
container.provide({
  provide: TOKEN,
  value: 'test'
});

// ✅ Bootstrap after all providers are registered
container.bootstrap();
```

---

### [i302] Double Bootstrap

**Error Message:**
```
Container has already been bootstrapped and cannot be bootstrapped again.
```

**Cause:**
You called `container.bootstrap()` more than once on the same container instance.

**Example:**
```typescript
const container = new NodeContainer();
container.bootstrap();

// ❌ This will throw [i302]
container.bootstrap();
```

**Solution:**
Only call `bootstrap()` once per container:

```typescript
const container = new NodeContainer();

// Register all providers
container.provide(/* ... */);

// ✅ Bootstrap once
container.bootstrap();

// Don't call bootstrap() again
```

If you need a fresh container, create a new instance:

```typescript
function createContainer() {
  const container = new NodeContainer();
  // Register providers...
  container.bootstrap();
  return container;
}

const container1 = createContainer();
const container2 = createContainer(); // ✅ New instance
```

---

## Retrieval Errors

### [i400] Provider Not Found

**Error Message:**
```
No provider found for "TokenName".
```

**Cause:**
You tried to retrieve a token that hasn't been registered in the container.

**Example:**
```typescript
const container = new NodeContainer();
const TOKEN = new NodeToken('TOKEN');

container.bootstrap();

// ❌ This will throw [i400]
const value = container.get(TOKEN);
```

**Solution:**
Register the provider before bootstrapping:

```typescript
const container = new NodeContainer();
const TOKEN = new NodeToken('TOKEN');

// ✅ Provide the token
container.provide({
  provide: TOKEN,
  value: 'test'
});

container.bootstrap();

// ✅ Now it can be retrieved
const value = container.get(TOKEN);
```

For optional dependencies, use the `optional` flag:

```typescript
@NodeInjectable()
class MyService {
  // ✅ Returns null if not found instead of throwing
  private readonly logger = nodeInject(Logger, { optional: true });
  
  public doSomething() {
    this.logger?.log('Doing something');
  }
}
```

---

### [i401] Circular Dependency

**Error Message:**
```
Circular dependency detected while resolving "ProviderName":
ServiceA -> ServiceB -> ServiceA
```

**Cause:**
Two or more services depend on each other in a circular way.

**Example:**
```typescript
@NodeInjectable()
class ServiceA {
  private readonly b = nodeInject(ServiceB);
}

@NodeInjectable()
class ServiceB {
  private readonly a = nodeInject(ServiceA); // ❌ Circular!
}

container.provide(ServiceA);
container.provide(ServiceB);
container.bootstrap(); // ❌ This will throw [i401]
```

**Solution:**
Refactor to break the circular dependency:

**Option 1: Extract shared logic**
```typescript
@NodeInjectable()
class SharedService {
  public sharedMethod() { }
}

@NodeInjectable()
class ServiceA {
  private readonly shared = nodeInject(SharedService);
}

@NodeInjectable()
class ServiceB {
  private readonly shared = nodeInject(SharedService);
}
// ✅ No circular dependency
```

**Option 2: Use events/callbacks**
```typescript
@NodeInjectable()
class ServiceA {
  private callbacks: Array<() => void> = [];
  
  public registerCallback(cb: () => void) {
    this.callbacks.push(cb);
  }
}

@NodeInjectable()
class ServiceB {
  constructor() {
    const serviceA = nodeInject(ServiceA);
    serviceA.registerCallback(() => {
      // Handle callback
    });
  }
}
// ✅ ServiceB depends on A, but A doesn't depend on B
```

**Option 3: Use defer Injection**
You can use `injectDefer` to defer the resolution of one of the dependencies. This works because the dependency is not resolved until the function is called, breaking the cycle during instantiation in a cost of transparency on bootstrap.

```typescript
@NodeInjectable()
class ServiceA {
  // injectDefer returns a function () => ServiceB
  private readonly injectB = injectDefer(ServiceB);
  private get b() {
    return this.injectB();
  }

public someMethod() {
    // Resolve dependency only when needed
    this.b.method();
  }
}

@NodeInjectable()
class ServiceB {
  private readonly a = nodeInject(ServiceA);
}
// ✅ Initialization cycle is broken
```

---

## Instantiation Errors

### [i500] Untracked Injection

**Error Message:**
```
Cannot instantiate ParentName because it depends on untracked injection TokenName. 
Please make sure all injections are properly tracked.
```

**Cause:**
You used `nodeInject()` outside of an injection context, or the dependency wasn't properly registered in the container's dependency tree.

**Example:**
```typescript
@NodeInjectable()
class MyService {
  // ❌ Don't use conditional injection – function may produce uncertain result and break tracking
  private readonly _untracked = someFunction() ? nodeInject(Logger) : null;
  private readonly _unreachable = nodeInject(getUntrackedToken());

  // ❌ Don't call nodeInject in methods
  public doSomething() {
    const logger = nodeInject(Logger);
    logger.log('test');
  }
}
```

**Solution:**
Only use `nodeInject()` during class initialization (in class field initializers):

```typescript
@NodeInjectable()
class MyService {
  // ✅ Inject in class field
  private readonly logger = nodeInject(Logger);
  
  public doSomething() {
    // ✅ Use the injected dependency
    this.logger.log('test');
  }
}
```

Make sure all dependencies are provided:

```typescript
@NodeInjectable()
class Logger { }

@NodeInjectable()
class MyService {
  private readonly logger = nodeInject(Logger);
}

// ✅ Provide all services
container.provide(Logger);
container.provide(MyService);
container.bootstrap();
```

---

### [i501] Outside Context

**Error Message:**
```
Cannot inject "TokenName" outside of an injection context.
```

**Cause:**
You tried to use `nodeInject()` outside of a valid injection context. `nodeInject()` can only be called:
- During class field initialization in injectable classes
- Inside factory functions provided to the container

**Example:**
```typescript
// ❌ This will throw [i501] - top-level call
const logger = nodeInject(Logger);

@NodeInjectable()
class MyService {
  constructor() {
    // ✅ This is valid - in constructor
    const logger = nodeInject(Logger);
  }
  
  public doSomething() {
    // ❌ This is not – will throw [i501]
    const logger = nodeInject(Logger);
  }
}
```

**Solution:**
Only use `nodeInject()` in class field initializers or factory functions:

```typescript
@NodeInjectable()
class MyService {
  // ✅ In class field initializer
  private readonly logger = nodeInject(Logger);
  
  public doSomething() {
    // ✅ Use the injected field
    this.logger.log('Doing something');
  }
}

// ✅ In factory function
const TOKEN = new NodeToken<MyService>('TOKEN');
container.provide({
  provide: TOKEN,
  factory: () => {
    const logger = nodeInject(Logger);
    return new MyService(logger);
  }
});
```

---

### [i502] Called Utils Outside Context

**Error Message:**
```
Cannot call injection utilities outside of an injection context.
```

**Cause:**
You attempted to call injection utility functions outside of a valid injection context. These utilities are only available during the dependency resolution phase.

**Solution:**
Ensure utility functions are only called within:
- Factory functions
- Class field initializers in injectable classes

```typescript
// ✅ Correct usage in factory
container.provide({
  provide: TOKEN,
  factory: () => {
    // Utility calls here are in context
    return createInstance();
  }
});
```

---

### [i503] Instance Access Failed

**Error Message:**
```
Failed to access instance for token "TokenName". It was not properly instantiated.
```

**Cause:**
The container tried to retrieve an instance that wasn't properly instantiated. This typically indicates an internal error in the dependency resolution system.

**Common causes:**
- The dependency tree wasn't built correctly
- An instantiation callback failed silently
- The instance was garbage collected prematurely

**Solution:**
This error usually indicates a bug in Illuma or a very unusual edge case. Try:

1. **Simplify your setup:**
```typescript
// Create a minimal reproduction
const container = new NodeContainer();
container.provide(OnlyTheFailingToken);
container.bootstrap();
```

2. **Check for async issues:**
```typescript
// Ensure factories are synchronous
container.provide({
  provide: TOKEN,
  factory: () => {
    // ❌ Don't use async/await in factories
    // return await fetchData();
    
    // ✅ Return synchronous values
    return new MyService();
  }
});
```

3. **Report the issue:**
If the problem persists, please [report it on GitHub](https://github.com/git-illuma/core/issues) with a minimal reproduction.

---

### [i504] Access Failed

**Error Message:**
```
Failed to access the requested instance due to an unknown error.
```

**Cause:**
A general instance access failure occurred that doesn't fit into other error categories. This is a catch-all error for unexpected situations.

**Solution:**
1. Check your provider configuration for syntax errors
2. Ensure all factories return valid values
3. Verify that class constructors don't throw errors
4. Review the full error stack trace for more details

If the issue persists, create a minimal reproduction and [report it on GitHub](https://github.com/git-illuma/core/issues).

---

## Debugging Tips

### Enable Performance Monitoring

```typescript
const container = new NodeContainer({
  measurePerformance: true
});
```

This can help identify slow instantiation or resolution issues.

### Check the Dependency Tree

If you encounter resolution errors, trace your dependencies:

```typescript
// Start with the failing service
@NodeInjectable()
class FailingService {
  // List all dependencies
  private readonly dep1 = nodeInject(Dependency1);
  private readonly dep2 = nodeInject(Dependency2);
}

// Make sure each dependency is provided
container.provide(Dependency1);
container.provide(Dependency2);
container.provide(FailingService);
```

### Test in Isolation

Create minimal test cases to isolate the problem:

```typescript
// Minimal reproduction
const container = new NodeContainer();
container.provide(OnlyTheFailingService);
container.bootstrap();
container.get(OnlyTheFailingService);
```

---

## Getting Help

If you encounter an error not covered here:

1. **Check the error code** in the quick reference table
2. **Review the detailed section** for your error code
3. **Create a minimal reproduction** to isolate the issue
4. **Report issues**: [GitHub Issues](https://github.com/git-illuma/core/issues)

## Related documentation

- [Getting Started](./GETTING_STARTED.md) - Setup and basic concepts
- [Providers Guide](./PROVIDERS.md) - Provider types
- [Tokens Guide](./TOKENS.md) - Using tokens
- [API Reference](./API.md) - Complete API documentation
