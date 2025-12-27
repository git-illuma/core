# Deep dive: How Illuma Works

This article is an in-depth overview of how dependency injection works in Illuma, covering the internal architecture, data structures, and the lifecycle of dependency resolution and instantiation.

## Table of Contents

- [Overview](#overview)
- [Key Concepts](#key-concepts)
- [The Container](#the-container)
- [Proto Nodes](#proto-nodes)
- [Tree Nodes](#tree-nodes)
- [Injection Context](#injection-context)
- [The nodeInject Function](#the-nodeinject-function)
- [Dependency Resolution](#dependency-resolution)
- [Instantiation Process](#instantiation-process)
- [Child Containers](#child-containers)
- [Complete Lifecycle Example](#complete-lifecycle-example)

## Overview

Illuma implements a sophisticated dependency injection system that operates in distinct phases:

1. **Registration Phase**: Providers are registered and converted into proto nodes
2. **Resolution Phase**: Proto nodes are resolved into tree nodes with full dependency graphs
3. **Instantiation Phase**: Tree nodes are instantiated in dependency order

This separation ensures that circular dependencies are detected before any instantiation occurs and allows for efficient batch instantiation of the entire dependency graph.

## Key Concepts

### Tokens

Tokens are the identifiers used to register and retrieve dependencies:

- **`NodeToken<T>`**: Represents a single injectable value (singleton pattern)
- **`MultiNodeToken<T>`**: Represents multiple injectable values of the same type (being injected as an array)

### The @NodeInjectable Decorator

The `@NodeInjectable()` decorator is used to mark classes as injectable. It automatically creates and associates a `NodeToken` with the class, allowing the class to be used directly with the container without manually creating a token.

**How it works:**

```typescript
@NodeInjectable()
class UserService {
  private readonly _logger = nodeInject(LoggerToken);
  
  public getUser() {
    this._logger.log('Fetching user');
    return { id: 1, name: 'John' };
  }
}

// The class can now be provided and retrieved directly
container.provide(UserService);
container.bootstrap();
const service = container.get(UserService);
```

**What happens internally:**

When you apply `@NodeInjectable()` to a class, the decorator:
1. Creates a `NodeToken<T>` with the name `_ClassName`
2. Attaches the token to the class using a special symbol (`INJECTION_SYMBOL`)
3. Associates a factory function `() => new ClassName()` with the token

This allows the container to:
- Recognize the class as injectable via `isInjectable()`
- Extract the associated token via `getInjectableToken()`
- Use the class constructor as the provider

**Alternative for non-decorator environments:**

If you're in an environment that doesn't support decorators, use `makeInjectable()`:

```typescript
class _UserService {
  private readonly _logger = nodeInject(LoggerToken);

  public getUser() {
    this._logger.log('Fetching user');
    return { id: 1, name: "John Doe" };
  }
}

export type UserService = _UserService;
export const UserService = makeInjectable(_UserService);
```

**Without `@NodeInjectable` and `makeInjectable`:**

If you don't use the decorator, you must manually create and use tokens:

```typescript
// Without decorator - manual token management
const UserServiceToken = new NodeToken<UserService>('UserService');

class UserService {
  private readonly logger = nodeInject(LoggerToken);
}

container.provide({ provide: UserServiceToken, useClass: UserService });
container.bootstrap();
const service = container.get(UserServiceToken);
```

### Nodes

Internally, the system uses two lightweight types of node representations:

- **Proto Nodes**: Metadata nodes created during registration that store information about **how** to instantiate given tokens
- **Tree Nodes**: Runtime nodes created during resolution that represent the actual dependency graph and hold instances

### Context

`InjectionContext` is a global state manager that tracks dependency injection calls during factory execution, allowing Illuma to discover dependencies dynamically.

While scanning, factories are being called in complete isolation. It means, `nodeInject` function does not actually provide a value, but a placeholder.

If a factory throws an error during scanning (e.g. you are trying to access a dependency right away), it's caught and scan execution stops halfway, so injection calls that are made before the error are still recorded, but those made after **are not**.

## The Container

The `NodeContainer` is the central orchestrator of the dependency injection system. It manages the entire lifecycle from registration to instantiation.

### Container Phases

#### 1. Registration Phase (`provide`)

During registration, the container:
- Accepts various provider formats (classes, tokens, factory functions)
- Creates proto nodes that store metadata about how to create instances
- Validates that no duplicates are registered
- Scans factory functions to discover dependencies

```typescript
container.provide(UserService);
container.provide({ provide: LoggerToken, factory: () => new ConsoleLogger() });
container.provide({ provide: PluginToken, multi: true, useClass: AuthPlugin });
```

#### 2. Bootstrap Phase (`bootstrap`)

During bootstrap, the container:
- Converts proto nodes into tree nodes with complete dependency graphs
- Detects circular dependencies
- Instantiates all dependencies in the correct order
- Creates an index of tokens and their corresponding tree nodes (with instances)
- Clears proto node maps to free memory

```typescript
container.bootstrap();
```

#### 3. Retrieval Phase (`get`)

After bootstrap, instances can be retrieved:
- Looks up tree nodes by token
- Returns the cached instance
- Falls back to parent container if not found (if provided)

```typescript
const service = container.get(UserServiceToken);
```

## Proto Nodes

Proto nodes are metadata objects created during the registration phase. They store information about how to create instances but don't hold actual instances.

### ProtoNodeSingle

Represents a singleton injectable:

```typescript
class ProtoNodeSingle<T> {
  public readonly token: NodeToken<T>;
  public readonly injections: Set<InjectionNode<any>>;
  public factory: (() => T) | null = null;
}
```

- **`token`**: The unique identifier for this dependency
- **`factory`**: The function that creates instances of this dependency
- **`injections`**: Discovered dependencies by scanning the factory function

**Example:**
```typescript
// When you register:
container.provide({
  provide: USER_SERVICE_NODE,
  useClass: UserService,
});

// Illuma creates:
new ProtoNodeSingle(
  USER_SERVICE_NODE,
  () => new UserService()
)
// And scans the factory to discover that LoggerToken is a dependency
```

### ProtoNodeMulti

Represents multiple injectable values of the same type:

```typescript
class ProtoNodeMulti<T> {
  public readonly token: MultiNodeToken<T>;
  public readonly singleNodes = new Set<NodeToken<T>>();
  public readonly multiNodes = new Set<MultiNodeToken<T>>();
  public readonly transparentNodes = new Set<ProtoNodeTransparent<T>>();
}
```

- **`singleNodes`**: References to single node tokens that should be included in the array
- **`multiNodes`**: References to other multi tokens (for composition)
- **`transparentNodes`**: Direct factory functions without tokens

**Example:**
```typescript
const PluginToken = new MultiNodeToken<Plugin>('Plugin');

container.provide({ provide: PluginToken, useClass: AuthPlugin });
container.provide({ provide: PluginToken, useClass: LoggingPlugin });
container.provide({ provide: PluginToken, factory: createCachePlugin });

// Creates a ProtoNodeMulti with:
// - Two single node references (AuthPlugin and LoggingPlugin tokens)
// - One transparent node (the CachePlugin factory)
```

### ProtoNodeTransparent

Transparent nodes are special proto nodes used for factories provided directly to multi tokens without their own token:

```typescript
class ProtoNodeTransparent<T> {
  public readonly factory: () => T;
  public readonly injections: Set<InjectionNode<any>>;
  public readonly parent: ProtoNodeSingle<T> | ProtoNodeMulti<T>;
}
```

- **`parent`**: Reference to the multi node that owns this transparent node
- **`factory`**: The factory function to create the instance
- **`injections`**: Dependencies discovered by scanning the factory

Transparent nodes allow you to provide implementations directly without creating dedicated tokens for each one.

Aliases are also being resolved to transparent nodes with factory of `() => nodeInject(OriginalService)`.

## Tree Nodes

Tree nodes are created during the bootstrap phase and represent the actual runtime dependency graph. Unlike proto nodes, tree nodes hold the actual instantiated values.

### TreeRootNode

The root of the dependency tree that manages all top-level dependencies:

```typescript
class TreeRootNode {
  private readonly _deps: Set<TreeNode<any>> = new Set();
  private readonly _treePool: DependencyPool = new Map();
}
```

- **`_deps`**: All top-level dependencies in the container
- **`_treePool`**: Map of tokens to their tree nodes for fast lookup

The root node orchestrates the instantiation process by calling `instantiate()` on all dependencies, which recursively instantiates their dependencies first.

### TreeNodeSingle

Represents a single instantiated value with its dependencies:

```typescript
class TreeNodeSingle<T> {
  private readonly _transparent: Set<TreeNodeTransparent> = new Set();
  private readonly _deps: DependencyPool = new Map();
  private _instance: T | null = null;
  private _resolved = false;
  public allocations = 0;
}
```

- **`_deps`**: Map of dependency tokens to their tree nodes
- **`_transparent`**: Set of transparent dependencies (for multi-injection)
- **`_instance`**: The cached instance (null until instantiated)
- **`_resolved`**: Whether this node has been instantiated
- **`allocations`**: Count of how many times this dependency is used (for diagnostics)

**Instantiation process:**
1. Check if already resolved (avoid duplicate instantiation)
2. Recursively instantiate all dependencies first
3. Create a retriever function that looks up dependencies from the `_deps` map
4. Execute the factory within an injection context, providing the retriever
5. Cache the result and mark as resolved

### TreeNodeTransparent

Similar to `TreeNodeSingle` but for transparent proto nodes:

```typescript
class TreeNodeTransparent<T> {
  private readonly _transparent = new Set<TreeNodeTransparent>();
  private readonly _deps: DependencyPool = new Map();
  private _instance: T | null = null;
  private _resolved = false;
  public allocations = 0;
  
  public readonly proto: ProtoNodeTransparent<T>;
}
```

Transparent nodes don't have their own token, so they're referenced by their parent multi node. They follow the same instantiation pattern as single nodes.

### TreeNodeMulti

Represents multiple values collected into an array:

```typescript
class TreeNodeMulti<T> {
  private readonly _deps = new Set<TreeNode<any>>();
  public readonly instance: T[] = [];
  private _resolved = false;
  public allocations = 0;
}
```

- **`_deps`**: All tree nodes that contribute to this multi-injection
- **`instance`**: The array of instances (public, not cached behind a getter)

**Instantiation process:**
1. Check if already resolved
2. Instantiate all dependencies
3. Collect instances from each dependency:
   - `TreeNodeSingle`: Add single instance
   - `TreeNodeMulti`: Spread array of instances
   - `TreeNodeTransparent`: Add single instance
4. Mark as resolved

## Injection Context

The `InjectionContext` is a global singleton that manages the state during factory execution. It's crucial for discovering dependencies and providing instances during instantiation.

### Context Structure

```typescript
abstract class InjectionContext {
  public static contextOpen = false;
  public static calls = new Set<InjectionNode<any>>();
  public static injector: InjectorFn | null = null;
}
```

- **`contextOpen`**: Whether a context is currently active
- **`calls`**: Set of all `nodeInject()` calls made during the current context
- **`injector`**: Optional function to provide actual instances (used during instantiation)

### Context Lifecycle

#### 1. Scanning Phase (Registration)

When a factory is registered, Illuma scans it to discover dependencies:

```typescript
const factory = () => new UserService();

// Illuma opens a context and tries to execute the factory
InjectionContext.open();
try {
  factory(); // This will fail but that's okay
} catch {
  // Errors are expected since dependencies don't exist yet
}

// Now InjectionContext.calls contains all nodeInject() calls
const dependencies = InjectionContext.getCalls();
InjectionContext.close();
```

During scanning:
- Context is open but `injector` is null
- `nodeInject()` records the call and returns a placeholder `InjectionNode`
- Factory execution may throw errors (which are caught and ignored)
- The goal is to discover what dependencies are needed, not to construct final instances

#### 2. Instantiation Phase (Bootstrap)

When instantiating a factory, Illuma provides actual dependencies:

```typescript
InjectionContext.instantiate(factory, (token, optional) => {
  // Look up the dependency in the resolved tree
  const node = dependencyPool.get(token);
  if (!node && !optional) throw InjectionError.untracked(token);
  return node?.instance ?? null;
});
```

During instantiation:
- Context is open and `injector` is set to a retriever function
- `nodeInject()` calls the injector to get actual instances
- Factory executes successfully and returns the created instance
- Context is closed after factory completes

### InjectionNode

An `InjectionNode` represents a single dependency injection point:

```typescript
class InjectionNode<T> {
  constructor(
    public readonly token: NodeToken<T> | MultiNodeToken<T>,
    public readonly optional = false
  ) {}
}
```

These are collected during scanning to build the dependency graph.

## The `nodeInject` Function

`nodeInject()` is the core function for declaring dependencies. It must be called within a factory function.

### Function Signature

```typescript
function nodeInject<N>(token: N, options?: { optional?: boolean }): ExtractInjectedType<N>;
```

### Behavior

The function behaves differently depending on the context state:

#### During Scanning (Context Open, No Injector)

```typescript
// This is what happens during factory scanning:
const LoggerToken = new NodeToken<Logger>('Logger');

const userServiceFactory = () => {
  // During scanning, nodeInject creates and returns an InjectionNode
  // It's recorded in InjectionContext.calls
  return new UserService();
};
```

#### During Instantiation (Context Open, With Injector)

```typescript
// This is what happens during actual instantiation:
const userServiceFactory = () => {
  // During instantiation, nodeInject calls InjectionContext.injector
  // Which returns the actual Logger instance
  return new UserService();
};
```

#### Outside Context (Error)

```typescript
// This is invalid and throws an error:
const logger = nodeInject(LoggerToken);
// ↑ InjectionError: nodeInject called outside injection context
```

### Optional Dependencies

Optional dependencies don't throw errors if not found:

```typescript
container.provide({
  provide: ServiceToken,
  factory: () => {
    const required = nodeInject(RequiredToken);
    const optional = nodeInject(OptionalToken, { optional: true });
    // optional will be null if OptionalToken is not registered
    return new Service();
  }
});
```

## Dependency Resolution

The dependency resolution process transforms proto nodes into tree nodes with complete dependency graphs. This happens during the bootstrap phase.

### Resolution Algorithm

The `resolveTreeNode()` function uses a [depth-first traversal](https://en.wikipedia.org/wiki/Depth-first_search) with cycle detection:

```typescript
function resolveTreeNode<T>(
  rootProto: ProtoNode<T>,
  cache: Map<ProtoNode, TreeNode>,
  singleNodes: Map<NodeToken<any>, ProtoNodeSingle>,
  multiNodes: Map<MultiNodeToken<any>, ProtoNodeMulti>,
  upstreamGetter?: UpstreamGetter
): TreeNode<T>
```

**Parameters:**
- **`rootProto`**: The proto node to resolve
- **`cache`**: Map of already resolved proto nodes (avoids duplicate work)
- **`singleNodes`**: Container's single proto nodes registry
- **`multiNodes`**: Container's multi proto nodes registry
- **`upstreamGetter`**: Function to retrieve dependencies from parent containers

### Resolution Steps

1. **Check Cache**: If this proto node was already resolved, return the cached tree node

2. **Create Tree Node**: Create a tree node corresponding to the proto node type

3. **Iterative DFS**: Use a stack-based approach to resolve all dependencies:
   ```typescript
   const stack: StackFrame[] = [{ proto: rootProto, node: rootNode, processed: false }];
   const visiting = new Set<ProtoNode>();
   ```

4. **Cycle Detection**: Track visiting nodes to detect circular dependencies:
   ```typescript
   if (visiting.has(proto)) {
     // Extract cycle path and throw InjectionError.circularDependency
   }
   ```

5. **Dependency Discovery**: For each proto node, find its dependencies:
   - For `ProtoNodeSingle` and `ProtoNodeTransparent`: Look up tokens from their `injections` set
   - For `ProtoNodeMulti`: Collect all single nodes, multi nodes, and transparent nodes

6. **Upstream Resolution**: If a dependency isn't found locally, try the parent container:
   ```typescript
   const upstream = upstreamGetter?.(token);
   if (upstream) {
     deps.push(upstream);
   }
   ```

7. **Link Dependencies**: Add each dependency to the tree node:
   ```typescript
   node.addDependency(dependencyTreeNode);
   ```

8. **Cache Result**: Store the resolved tree node in the cache for reuse

### Example Resolution

```typescript
// Registration:
container.provide(LoggerToken);
container.provide(CacheToken);
container.provide({
  provide: UserServiceToken,
  useClass: UserService
});

// During bootstrap, resolution creates:
TreeNodeSingle<UserService> {
  _deps: Map {
    LoggerToken => TreeNodeSingle<Logger>,
    CacheToken => TreeNodeSingle<Cache>
  }
}
```

## Instantiation Process

After resolution, the container has a complete dependency graph as tree nodes. Instantiation traverses this graph and creates actual instances.

### Instantiation Order

The `TreeRootNode.instantiate()` method orchestrates the process:

```typescript
public instantiate(): void {
  for (const dep of this._deps) {
    dep.instantiate(this._treePool);
    if ("token" in dep.proto) {
      this._treePool.set(dep.proto.token, dep);
    }
  }
}
```

Each tree node instantiates its dependencies before instantiating itself, ensuring the correct order.

### Single Node Instantiation

```typescript
class TreeNodeSingle<T> {
  public instantiate(pool?: DependencyPool): void {
    if (this._resolved) return; // Already instantiated

    // 1. Instantiate all dependencies first
    for (const node of this._deps.values()) {
      node.instantiate(pool);
    }
    for (const dep of this._transparent) {
      dep.instantiate(pool);
    }

    // 2. Create retriever for nodeInject calls
    const retriever = (token, optional) => {
      const depNode = this._deps.get(token);
      if (!depNode && !optional) throw InjectionError.untracked(token);
      return depNode?.instance ?? null;
    };

    // 3. Execute factory within injection context
    const factory = this.proto.factory ?? this.proto.token.opts?.factory;
    this._instance = InjectionContext.instantiate(factory, retriever);

    // 4. Mark as resolved and add to pool
    this._resolved = true;
    if (pool) pool.set(this.proto.token, this);
  }
}
```

### Multi Node Instantiation

```typescript
class TreeNodeMulti<T> {
  public instantiate(pool?: DependencyPool): void {
    if (this._resolved) return;

    // Instantiate all dependencies and collect instances
    for (const dep of this._deps) {
      dep.instantiate(pool);

      if (dep instanceof TreeNodeSingle) {
        this.instance.push(dep.instance);
      } else if (dep instanceof TreeNodeMulti) {
        this.instance.push(...dep.instance);
      } else if (dep instanceof TreeNodeTransparent) {
        this.instance.push(dep.instance);
      }
    }

    this._resolved = true;
    if (pool) pool.set(this.proto.token, this);
  }
}
```

### Retriever Function

The retriever function is critical during instantiation. It's passed as the `injector` to the injection context:

```typescript
const retriever = (token: NodeBase<any>, optional?: boolean) => {
  // Look up in local dependencies
  const depNode = this._deps.get(token);
  
  // Check transparent nodes for multi-injection
  if (!depNode && !optional) {
    const transparent = Array.from(this._transparent).find(
      n => n.proto.parent.token === token
    );
    if (transparent) return transparent.instance;
    
    throw InjectionError.untracked(token, node);
  }

  return depNode?.instance ?? null;
};
```

When `nodeInject()` is called during factory execution, it calls this retriever to get the actual instance.

## Child Containers

Child containers enable hierarchical dependency injection, where a child container can access dependencies from its parent but not vice versa.

### Creating a Child Container

```typescript
const parent = new NodeContainer();
parent.provide(LoggerToken);
parent.bootstrap();

const child = new NodeContainer({ parent });
child.provide(UserServiceToken); // Can inject LoggerToken from parent
child.bootstrap();
```

### Upstream Resolution

When resolving dependencies, the container uses an `upstreamGetter` function:

```typescript
private _getFromParent<T>(token: Token<T>): TreeNode<T> | null {
  if (!this._parent) return null;
  const parentNode = this._parent as NodeContainer;
  return parentNode.findNode(token);
}
```

This function is passed to `resolveTreeNode()` and is called when a dependency isn't found locally:

```typescript
function addDependency(token: Token<any>, optional = false) {
  // Try to find in local proto nodes
  const localProto = singleNodes.get(token) || multiNodes.get(token);
  if (localProto) {
    deps.push(localProto);
    return;
  }

  // Try parent container
  const upstream = upstreamGetter?.(token);
  if (upstream) {
    deps.push(upstream); // Use parent's tree node directly
    return;
  }

  // Not found anywhere
  if (!optional) throw InjectionError.notFound(token);
}
```

### Instance Retrieval from Parent

When calling `get()`, if a dependency isn't found locally, the container checks the parent:

```typescript
public get<T>(token: Token<T>): T | T[] {
  const treeNode = this._rootNode.find(token);
  if (!treeNode) {
    const upstream = this._getFromParent(token);
    if (upstream) return upstream.instance;
    
    if (token instanceof MultiNodeToken) return [];
    throw InjectionError.notFound(token);
  }

  return treeNode.instance;
}
```

### Child Container Characteristics

- **Isolation**: Child containers can override parent dependencies without affecting the parent
- **Inheritance**: Child containers can access all parent dependencies
- **Scoping**: Different child containers can have different implementations of the same token
- **Lifecycle**: Parent must be bootstrapped before child, but they're independent after that

**Example use case:**
```typescript
// Parent provides shared services
const parent = new NodeContainer();
parent.provide(DatabaseToken);
parent.provide(ConfigToken);
parent.bootstrap();

// Child 1: Production environment
const prod = new NodeContainer({ parent });
prod.provide({ provide: LoggerToken, useClass: ProductionLogger });
prod.bootstrap();

// Child 2: Development environment
const dev = new NodeContainer({ parent });
dev.provide({ provide: LoggerToken, useClass: DevelopmentLogger });
dev.bootstrap();

// Both children share Database and Config, but have different loggers
```

## Complete Lifecycle Example

Let's walk through a complete example from registration to retrieval:

### 1. Define Tokens and Classes

```typescript
const LoggerToken = new NodeToken<Logger>('Logger');
const ConfigToken = new NodeToken<Config>('Config');
const UserServiceToken = new NodeToken<UserService>('UserService');
const PluginToken = new MultiNodeToken<Plugin>('Plugin');

@Injectable()
class Logger { /* ... */ }

@Injectable()
class Config { /* ... */ }

@Injectable()
class UserService {
  // Dependencies are injected via nodeInject() in class body
  private readonly logger = nodeInject(LoggerToken);
  private readonly config = nodeInject(ConfigToken);
  private readonly plugins = nodeInject(PluginToken);
}

@Injectable()
class AuthPlugin { /* ... */ }

@Injectable()
class CachePlugin { /* ... */ }
```

### 2. Register Providers

```typescript
const container = new NodeContainer();

// Simple registration
container.provide({
  provide: LoggerToken,
  useClass: Logger,
});

// With configuration
container.provide({
  provide: ConfigToken,
  value: { apiUrl: 'https://api.example.com' }
});

// With dependencies
container.provide({
  provide: UserServiceToken,
  useClass: UserService,
});

// Multi-injection
container.provide({ provide: PluginToken, useClass: AuthPlugin });
container.provide({ provide: PluginToken, factory: () => new CachePlugin() });
```

**Internal state after registration:**

```typescript
container._protoNodes = Map {
  LoggerToken => ProtoNodeSingle {
    token: LoggerToken,
    factory: () => new Logger(),
    injections: Set {}  // No dependencies
  },
  ConfigToken => ProtoNodeSingle {
    token: ConfigToken,
    factory: () => ({ apiUrl: '...' }),
    injections: Set {}
  },
  UserServiceToken => ProtoNodeSingle {
    token: UserServiceToken,
    factory: () => new UserService(),
    injections: Set {
      InjectionNode(LoggerToken, false),
      InjectionNode(ConfigToken, false),
      InjectionNode(PluginToken, false)
    }
  },
  AuthPluginToken => ProtoNodeSingle {
    token: AuthPluginToken,
    factory: () => new AuthPlugin(),
    injections: Set {}
  }
}

container._multiProtoNodes = Map {
  PluginToken => ProtoNodeMulti {
    token: PluginToken,
    singleNodes: Set { AuthPluginToken },
    transparentNodes: Set {
      ProtoNodeTransparent {
        parent: PluginToken,
        factory: () => new CachePlugin(),
        injections: Set {}
      }
    }
  }
}
```

### 3. Bootstrap

```typescript
container.bootstrap();
```

**Resolution phase creates tree nodes:**

```typescript
// TreeRootNode is created with all dependencies
container._rootNode = TreeRootNode {
  _deps: Set {
    TreeNodeSingle<Logger> {
      proto: ProtoNodeSingle<Logger>,
      _deps: Map {},  // No dependencies
      _instance: null
    },
    TreeNodeSingle<Config> {
      proto: ProtoNodeSingle<Config>,
      _deps: Map {},
      _instance: null
    },
    TreeNodeSingle<AuthPlugin> {
      proto: ProtoNodeSingle<AuthPlugin>,
      _deps: Map {},
      _instance: null
    },
    TreeNodeTransparent<CachePlugin> {
      proto: ProtoNodeTransparent<CachePlugin>,
      _deps: Map {},
      _instance: null
    },
    TreeNodeMulti<Plugin> {
      proto: ProtoNodeMulti<Plugin>,
      _deps: Set {
        TreeNodeSingle<AuthPlugin>,
        TreeNodeTransparent<CachePlugin>
      },
      instance: []
    },
    TreeNodeSingle<UserService> {
      proto: ProtoNodeSingle<UserService>,
      _deps: Map {
        LoggerToken => TreeNodeSingle<Logger>,
        ConfigToken => TreeNodeSingle<Config>,
        PluginToken => TreeNodeMulti<Plugin>
      },
      _instance: null
    }
  },
  _treePool: Map {}  // Empty until instantiation
}
```

**Instantiation phase:**

1. `TreeRootNode.instantiate()` is called
2. For each dependency in `_deps`:
   - `TreeNodeSingle<Logger>.instantiate()`: No dependencies, creates instance
   - `TreeNodeSingle<Config>.instantiate()`: No dependencies, creates instance
   - `TreeNodeSingle<AuthPlugin>.instantiate()`: No dependencies, creates instance
   - `TreeNodeTransparent<CachePlugin>.instantiate()`: No dependencies, creates instance
   - `TreeNodeMulti<Plugin>.instantiate()`: Instantiates children, collects into array
   - `TreeNodeSingle<UserService>.instantiate()`: All dependencies ready, creates instance

3. After instantiation:

```typescript
container._rootNode = TreeRootNode {
  _deps: Set { /* same tree nodes */ },
  _treePool: Map {
    LoggerToken => TreeNodeSingle { _instance: Logger {}, _resolved: true },
    ConfigToken => TreeNodeSingle { _instance: { apiUrl: '...' }, _resolved: true },
    AuthPluginToken => TreeNodeSingle { _instance: AuthPlugin {}, _resolved: true },
    PluginToken => TreeNodeMulti { instance: [AuthPlugin {}, CachePlugin {}], _resolved: true },
    UserServiceToken => TreeNodeSingle { _instance: UserService {}, _resolved: true }
  }
}
```

### 4. Retrieve Instances

```typescript
const logger = container.get(LoggerToken);
// Returns the Logger instance from _treePool

const userService = container.get(UserServiceToken);
// Returns the UserService instance with all dependencies injected

const plugins = container.get(PluginToken);
// Returns [AuthPlugin {}, CachePlugin {}]
```
