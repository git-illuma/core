# Migration guide

## To version 2.1

### Breaking changes

#### `InjectorImpl` is no longer exported

The `InjectorImpl` class has been removed from the public API. You should re-provide any custom implementations of `Injector` using the `Injector` token instead. For example:

```typescript
import { nodeInject, type iInjector } from "@illuma/core";

class CustomInjector implements iInjector {
  private readonly _original = nodeInject(Injector);
  // ... your implementation
}

// In your container setup
container.provide({
  token: NewInjector, // New token for your custom injector
  useClass: CustomInjector,
});
```

### New features

#### `LifecycleRef` for managing container lifecycle

The `LifecycleRef` is introduced as a new utility for managing container lifecycle events. It provides methods to register callbacks that will be called before the container is destroyed and when child containers are destroyed. This allows for better resource management and cleanup in complex applications. See [Lifecycle docs](./LIFECYCLE.md).

### `nodeInject` now supports `{ self: true }` and `{ skipSelf: true }` options

For better compatibility with Angular's DI patterns, the `nodeInject` function now supports `{ self: true }` and `{ skipSelf: true }` options. This allows you to control the scope of your injections more precisely, enabling scenarios where you want to inject dependencies from the current container only (`self`) or from parent containers only (`skipSelf`). See [Resolution Modifiers](./RESOLUTION_MODIFIERS.md) for more details.

## To version 2.0

### Breaking changes

#### MultiNodeToken behavior

**Injecting `MultiNodeToken` without providers** now returns an empty array instead of throwing an error. This allows for more flexible plugin architectures where plugins can optionally provide implementations.

#### `NodeInjectable` and `makeInjectable` symbol-free lock-in

`NodeInjectable` and `makeInjectable` are no longer using specific symbol for injection in favor of using an underlying global registry. This means that you can now use these utilities  without worrying about symbol conflicts or memory leaks. However, this also means that you can no longer use `NodeInjectable` or `makeInjectable` across different versions of the library without potential issues.

*Note:* `INJECTION_SYMBOL` export was completely removed. Any workflows relying on it for custom integration should switch to `getInjectableToken` or other public APIs.

#### `iInjectionOptions` property rename

If you're using helper utilities like `injectEntryAsync`, `injectGroupAsync`, or `injectAsync`, the `overrides` property in the options object has been renamed to `config`.

- **Before:** `injectEntryAsync(..., { overrides: [...] })`
- **After:** `injectEntryAsync(..., { config: [...] })`

#### Diagnostics

`diagnostics` flag in `NodeContainer` options has been removed. Instead, you can now use the `enableIllumaDiagnostics()` function to enable diagnostics globally. This means that you can omit toggling diagnostics for each container instance and instead enable it once for the entire application.

### New Features

#### Root-scoped Singletons

The library now supports root-scoped singletons for class injectables and `NodeToken` providers using the `{ singleton: true }` option.

```typescript
@NodeInjectable({ singleton: true })
class AppConfigService {}
```

When an injectable is marked with `singleton: true`, there is no need to manually call `.provide()` on the container for this token. It behaves similarly to Angular's `providedIn: 'root'`, meaning it will be automatically provided and resolved as a singleton in the root container when first requested. The same instance is then shared across all child containers, unless explicitly overridden locally.

#### Restored `InjectionContext.scan`

The `InjectionContext.scan` method has been reworked and now implicitly calls `InjectionContext.scanInto`. This is the result of massive performance optimizations and internal refactoring.
