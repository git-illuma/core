# Lifecycle hooks and container destruction

When working with stateful services—like database connections, file handles, interval timers, or external subscriptions—it is crucial to clean them up properly once the container is no longer needed. This is achieved by explicitly destroying the container and leveraging lifecycle hooks.

## Container Destruction Cycle

When a container has fulfilled its purpose (e.g. at the end of an HTTP request, when a component unmounts, or when shutting down an application), you should call the `destroy()` method on the container to cleanup it's resources and resources of all its child containers.

```typescript
import { NodeContainer } from "@illuma/core";

const container = new NodeContainer();
// Use the container...

// Gracefully shutdown the container and run all hooks
container.destroy();
```

When `destroy()` is called, the following execution rules apply:

1. **Hierarchical destruction**: All child containers are automatically destroyed *before* their parent containers.
2. **Reverse initialization order**: Teardown hooks within a container execute bottom-up in the exact reverse order they were registered.
3. **Immutability**: Once a container is destroyed, calling `destroy()` again or attempting to resolve any dependencies from it will throw an `InjectionError` (see [Injection Error 303](./TROUBLESHOOTING.md)).

## Using `LifecycleRef`

You can use the `LifecycleRef` token to hook into the destruction sequence from within a provider or service without having a direct reference to the container. It provides an API to run clean-up tasks when its bounding container is being destroyed.

### Registering a `beforeDestroy` Hook

Inject `LifecycleRef` into your service and use its `beforeDestroy` method to register hooks. This method returns an unsubscribe function you can call to remove the hook prematurely.

```typescript
import { nodeInject, LifecycleRef } from "@illuma/core";

export class DatabaseService {
  private readonly _connection;
  private readonly _lifecycle = nodeInject(LifecycleRef);

  constructor() {
    this._connection = connectToDb();
    console.log("Database connection opened!");

    // Register a hook that executes during container destruction
    this._lifecycle.beforeDestroy(() => {
      this._connection.close();
      console.log("Database connection closed!");
    });
  }
}
```

### Unsubscribing a Hook

If your service ends up closing the resource on its own (for instance, the connection naturally times out), you can easily avoid redundant tear-downs by invoking the callback returned by `beforeDestroy`:

```typescript
import { nodeInject, LifecycleRef } from "@illuma/core";

export class PollingService {
  private readonly _lifecycle = nodeInject(LifecycleRef);
  private _interval: NodeJS.Timeout;
  private _stopHook: () => void;

  constructor() {
    this._interval = setInterval(() => this.poll(), 1000);

    this._stopHook = this._lifecycle.beforeDestroy(() => {
      clearInterval(this._interval);
    });
  }

  // Sometime later, if you stop manually before the container drops:
  public stop() {
    clearInterval(this._interval);
    this._stopHook();
  }
  
  private poll() {
    // ...
  }
}
```

### Checking the Destruction State

Sometimes your components execute asynchronous operations. To check whether the container is already destroyed inside an asynchronous block (thus avoiding performing tasks that mutate destroyed state), you can read the `destroyed` property on the `LifecycleRef` instance:

```typescript
import { nodeInject, LifecycleRef } from "@illuma/core";

export class AsyncWorker {
  private readonly _lifecycle = nodeInject(LifecycleRef);

  async doWork() {
    await someLongRunningTask();
    
    // Check if the container was destroyed while awaiting the task
    if (this._lifecycle.destroyed) {
      return; 
    }

    // Safely continue with normal operation...
  }
}
```

## Internal Hooks

If you are building low-level tools integrating directly with container hierarchies, `LifecycleRef` also exposes an `onChildDestroy` hook. This behaves exactly like `beforeDestroy`, but executes specifically during the *children destruction* phase, guaranteeing it runs exclusively before the regular `beforeDestroy` hooks of the current container regardless of registration order. In most standard application logic, `beforeDestroy` is the only hook you need.
