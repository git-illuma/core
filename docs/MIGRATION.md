# Migration guide

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
