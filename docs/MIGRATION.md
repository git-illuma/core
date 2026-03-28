# Migration guide

## To version 2.0

### Breaking changes

#### MultiNodeToken behavior

**Injecting `MultiNodeToken` without providers** now returns an empty array instead of throwing an error. This allows for more flexible plugin architectures where plugins can optionally provide implementations.

#### `NodeInjectable` and `makeInjectable` symbol-free lock-in

`NodeInjectable` and `makeInjectable` are no longer using specific symbol for injection in favor of using an underlying global registry. This means that you can now use these utilities  without worrying about symbol conflicts or memory leaks. However, this also means that you can no longer use `NodeInjectable` or `makeInjectable` across different versions of the library without potential issues.

#### Diagnostics

`diagnostics` flag in `NodeContainer` options has been removed. Instead, you can now use the `enableIllumaDiagnostics()` function to enable diagnostics globally. This means that you can omit toggling diagnostics for each container instance and instead enable it once for the entire application.
