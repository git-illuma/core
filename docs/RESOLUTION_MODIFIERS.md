# Resolution Modifiers

Illuma supports Dependency Injection modifiers that control how the container resolves a dependency when using **hierarchical injection** (parent and child containers).

Modifiers can be used when calling `nodeInject()` inside factories/constructors, or when dynamically retrieving instances using `container.get()` and `injector.get()`.

## Table of contents

- [Resolution Modifiers](#resolution-modifiers)
  - [Table of contents](#table-of-contents)
  - [Overview](#overview)
  - [Modifiers](#modifiers)
    - [`self`](#self)
    - [`skipSelf`](#skipself)
    - [`optional`](#optional)
  - [Usage](#usage)
    - [In `nodeInject`](#in-nodeinject)
    - [In `container.get`](#in-containerget)
  - [Conflicting Modifiers](#conflicting-modifiers)
  - [Related documentation](#related-documentation)

## Overview

By default, when you request a dependency, Illuma searches for the provider in the **current container**. If the provider is not found locally, it will traverse **up the container hierarchy** inspecting the parent containers until it finds a provider or reaches the root container.

Sometimes you need to explicitly constrain this traversal to either:

1. Guarantee the instance comes **only from the local container** without checking parents (`self`).
2. Force the resolution to **skip the local container** and strictly look upstream (`skipSelf`).

## Modifiers

### `self`

When `self: true` is passed, the container stops traversal and **only looks for the provider in the current (local) container**.

If the provider is not registered locally, a `NotFound` error (`[i101]`) will be thrown (*unless `optional: true` is also provided*).

### `skipSelf`

When `skipSelf: true` is passed, the container **ignores providers in the current container** and immediately delegates the resolution to the parent container.

If the container has no parent, or if none of the parents provide the dependency, a `NotFound` error (`[i101]`) will be thrown (*unless `optional: true` is also provided*).

### `optional`

When `optional: true` is passed, the container does not throw an error if the dependency cannot be resolved. Instead, it safely returns `null`. This can be used in combination with `self` or `skipSelf`.

## Usage

### In `nodeInject`

Modifiers can be supplied as the second argument to `nodeInject()`.

```typescript
import { nodeInject, NodeInjectable, NodeToken } from '@illuma/core';

const MyToken = new NodeToken<string>('MyToken');

@NodeInjectable()
class ConfigLogger {
  // Looks exclusively in the local container context
  private readonly localConfig = nodeInject(MyToken, { self: true });
}

@NodeInjectable()
class UpstreamLogger {
  // Skips the local container completely and looks in the parent
  private readonly globalConfig = nodeInject(MyToken, { skipSelf: true });
}

@NodeInjectable()
class OptionalLocalLogger {
  // Returns `null` if it can't find it in the local container
  private readonly localOptionalConfig = nodeInject(MyToken, { self: true, optional: true });
}
```

### In `container.get`

Modifiers are also directly available via `get` methods on `NodeContainer` and `Injector`. This is helpful for dynamically resolving instances programmatically.

```typescript
const parent = new NodeContainer();
parent.provide(MyToken.withValue('Parent-Value'));
parent.bootstrap();

const child = new NodeContainer({ parent });
child.provide(MyToken.withValue('Child-Value'));
child.bootstrap();

// Normal resolution (starts locally)
console.log(child.get(MyToken)); // 'Child-Value'

// `self` resolution (looks only locally)
console.log(child.get(MyToken, { self: true })); // 'Child-Value'

// `skipSelf` resolution (skips locally, delegates to parent)
console.log(child.get(MyToken, { skipSelf: true })); // 'Parent-Value'
```

## Conflicting Modifiers

You cannot enforce both `self: true` and `skipSelf: true` at the same time for a single dependency request since their semantics are mutually exclusive. Attempting to do so will result in an `InjectionError` (`[i202]`, `CONFLICTING_STRATEGIES`).

```typescript
// ❌ Throws CONFLICTING_STRATEGIES
nodeInject(MyToken, { self: true, skipSelf: true });

// ❌ Throws CONFLICTING_STRATEGIES
container.get(MyToken, { self: true, skipSelf: true });
```

## Related documentation

- [API Reference](./API.md) - Complete API documentation
- [Tokens Guide](./TOKENS.md) - Learn about Tokens and how to provide them
- [Providers Guide](./PROVIDERS.md) - Provider types and how to declare them
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common errors and how to resolve them
