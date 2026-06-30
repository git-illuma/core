# Error Reference

This document provides detailed information about all error codes in Illuma and how to resolve them.

## Table of Contents

- [Quick Reference](#quick-reference)
- [Provider Errors (i100-i103)](#provider-errors)
- [Alias Errors (i200-i202)](#alias-errors)
- [Bootstrap Errors (i300-i305)](#bootstrap-errors)
- [Retrieval Errors (i400-i401)](#retrieval-errors)
- [Instantiation Errors (i500-i504)](#instantiation-errors)
- [Token Errors (i600)](#token-errors)
- [Middleware Errors (i700)](#middleware-errors)
- [Internal Errors (i800)](#internal-errors)
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
| i202 | Conflicting Strategies | Don't use `self` and `skipSelf` together |
| i300 | Not Bootstrapped       | Call `bootstrap()` first                 |
| i301 | Container Bootstrapped | Provide before `bootstrap()`             |
| i302 | Double Bootstrap       | Only bootstrap once                      |
| i303 | Container destroyed    | Container has been destroyed             |
| i304 | Parent Destroyed       | Keep the parent alive while children exist |
| i305 | Parent Not Bootstrapped | Bootstrap the parent before the child   |
| i400 | Provider Not Found     | Provide the token or use `optional`      |
| i401 | Circular Dependency    | Refactor to break cycle                  |
| i500 | Untracked Injection    | Use in class field initializers only     |
| i501 | Outside Context        | Use only in fields/factories             |
| i502 | Called Utils Outside   | Use only during instantiation            |
| i503 | Instance Access Failed | Check factory/constructor logic          |
| i504 | Access Failed          | Check provider configuration             |
| i600 | Global Token Conflict  | Use one token kind per global name       |
| i700 | Middleware Next Reused | Call `next()` at most once per middleware |
| i800 | Unknown ProtoNode      | Internal invariant — please report it    |

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

**Note:** You don't need to provide the alias target before creating the alias (unlike what you might expect). The target will be resolved when the container is bootstrapped. However, if the alias target is never provided, `bootstrap()` itself throws an `[i400] Provider Not Found` error (the whole container build fails, not just a later retrieval of the alias).

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

### [i202] Conflicting Strategies

**Error Message:**

```
Token "TokenName" cannot use both 'self' and 'skipSelf' strategies.
```

**Cause:**
You passed both `self: true` and `skipSelf: true` to a single `nodeInject()` call. Their semantics are mutually exclusive — `self` restricts resolution to the current container, while `skipSelf` skips the current container and delegates to the parent — so they cannot be combined.

**Example:**

```typescript
@NodeInjectable()
class MyService {
  // ❌ This will throw [i202]
  private readonly dep = nodeInject(SomeToken, { self: true, skipSelf: true });
}
```

**Solution:**
Pick the one that matches your intent:

```typescript
@NodeInjectable()
class MyService {
  // ✅ Only resolve from the current container
  private readonly local = nodeInject(SomeToken, { self: true });

  // ✅ Or skip the current container and resolve from a parent
  private readonly inherited = nodeInject(OtherToken, { skipSelf: true });
}
```

See [Resolution Modifiers](./RESOLUTION_MODIFIERS.md) for details on `self` and `skipSelf`.

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

### [i303] Container destroyed

**Error Message:**

```
Container has been already destroyed.
```

**Cause:**
You attempted to use an injector or the container it represents after it has been destroyed. Once a container is destroyed, it cannot be used to resolve dependencies, produce new instances, create child containers or be destroyed again.

**Example:**

```typescript
const container = new NodeContainer();

const SomeToken = new NodeToken('SomeToken');
container.provide(SomeToken.withValue('test'));
container.destroy();

container.get(SomeToken); // ❌ This will throw [i303]
```

**Solution:**
Make sure to only call `destroy()` when you are completely done with the container and its dependencies. Avoid using the container or any of its injectors after calling `destroy()`.

---

### [i304] Parent Destroyed

**Error Message:**

```
Parent container has been destroyed.
```

**Cause:**
You tried to create a child container whose parent was already destroyed, or you called `bootstrap()` on a child whose parent was destroyed after the child was created. A destroyed container can no longer parent or bootstrap children.

**Example:**

```typescript
const parent = new NodeContainer();
parent.bootstrap();
parent.destroy();

// ❌ This will throw [i304] - the parent is already destroyed
const child = new NodeContainer({ parent });
```

**Solution:**
Ensure the parent container outlives its children. Create and bootstrap child containers before the parent is destroyed, and when managing lifecycles manually, tear children down before (or together with) the parent.

---

### [i305] Parent Not Bootstrapped

**Error Message:**

```
Parent container has not been bootstrapped.
```

**Cause:**
You called `bootstrap()` on a child container before its parent container was bootstrapped. A child cannot complete its own bootstrap until the parent is ready.

**Example:**

```typescript
const parent = new NodeContainer();
const child = new NodeContainer({ parent });

// ❌ This will throw [i305] - the parent hasn't been bootstrapped yet
child.bootstrap();
```

**Solution:**
Bootstrap the parent first. A child created before its parent is bootstrapped is bootstrapped automatically when the parent bootstraps, so you usually only need to bootstrap the parent:

```typescript
const parent = new NodeContainer();
const child = new NodeContainer({ parent });

// ✅ Bootstrapping the parent cascades to the child
parent.bootstrap();
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

1. **Check for async issues:**

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

1. **Report the issue:**
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

## Token Errors

### [i600] Global Token Conflict

**Error Message:**

```
Global token "name" is already registered as NodeToken; cannot redeclare it as MultiNodeToken.
```

**Cause:**
You constructed two tokens with `{ global: true }` that share the same name but are of different kinds (for example a `NodeToken` and a `MultiNodeToken`). Global tokens are deduplicated by name in a process-wide registry so identically-named tokens from separately-bundled modules resolve to one instance — which only works if every declaration of that name agrees on the token kind.

**Example:**

```typescript
// ❌ Same global name, different kinds → throws [i600]
const CONFIG = new NodeToken('seam.config', { global: true });
const ALSO_CONFIG = new MultiNodeToken('seam.config', { global: true });
```

**Solution:**
Give each global token a unique, stable name and keep its kind consistent everywhere it is declared:

```typescript
// ✅ Distinct names, one kind each
const CONFIG = new NodeToken('seam.config', { global: true });
const PLUGINS = new MultiNodeToken('seam.plugins', { global: true });
```

Reserve `global: true` for cross-bundle seam tokens. Tokens used within a single bundle don't need it — ordinary (non-global) tokens are distinct by reference and never collide. See the [Tokens guide](./TOKENS.md) for more on the `global` option.

---

## Middleware Errors

### [i700] Middleware Next Reused

**Error Message:**

```
Middleware next() was called more than once.
```

**Cause:**
An instantiation middleware called its `next()` callback more than once. Each middleware in the chain must call `next()` at most once; a second call is rejected explicitly rather than silently re-running downstream middlewares.

**Example:**

```typescript
const badMiddleware: iMiddleware = (params, next) => {
  next(params);
  return next(params); // ❌ second call throws [i700]
};
```

**Solution:**
Call `next()` exactly once and return its result. To transform the produced instance, capture the result and modify it instead of calling `next()` again:

```typescript
const goodMiddleware: iMiddleware = (params, next) => {
  const instance = next(params); // ✅ called once
  // ...inspect or wrap `instance`...
  return instance;
};
```

---

## Internal Errors

### [i800] Unknown ProtoNode

**Error Message:**

```
Unknown ProtoNode type.
```

**Cause:**
An internal invariant failed: the resolver encountered a provider prototype node of an unrecognized type. This should not occur through normal use of the public API and usually indicates a bug in Illuma or a mismatched/corrupted build.

**Solution:**
This is an internal error. Please [report it on GitHub](https://github.com/git-illuma/core/issues) with a minimal reproduction, and make sure all `@illuma/*` packages are on compatible versions.

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
