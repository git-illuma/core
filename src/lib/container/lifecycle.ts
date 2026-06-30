import { NodeToken } from "../api/token";
import { InjectionError } from "../errors";

const LIFECYCLE_REF_TOKEN_KEY = Symbol.for("@illuma/core/LifecycleRefToken");

type iLifecycleGlobalThis = typeof globalThis & {
  [LIFECYCLE_REF_TOKEN_KEY]?: NodeToken<LifecycleRefImpl>;
};

const lcrGlobal = globalThis as iLifecycleGlobalThis;

/** @internal Snapshot of every lifecycle hook registration. */
interface iLifecycleHookSnapshot {
  bootstrap: Set<() => void>;
  bootstrapChild: Set<() => void>;
  destroy: Set<() => void>;
  destroyChild: Set<() => void>;
}

/** @internal */
export class LifecycleRefImpl {
  private readonly _destroyCallbacks = new Set<() => void>();
  private readonly _destroyChildCallbacks = new Set<() => void>();

  private readonly _bootstrapCallbacks = new Set<() => void>();
  private readonly _bootstrapChildCallbacks = new Set<() => void>();

  private _destroyed = false;

  /**
   * Indicates whether the container that owns this references has already been destroyed.
   * If true, no further dependencies can be resolved, and existing providers are cleared.
   */
  public get destroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Registers a callback to be executed after the container has completed its bootstrap process.
   * This is useful for performing any setup that requires the container to be fully initialized.
   * @param callback The function to execute after bootstrap
   * @returns An unsubscribe function. Calling it unregisters the callback.
   */
  public afterBootstrap(callback: () => void): () => void {
    this._bootstrapCallbacks.add(callback);
    return () => this._bootstrapCallbacks.delete(callback);
  }

  /**
   * @internal
   * Registers a hook specifically intended for the phase when child containers are bootstrapped.
   * Runs after the standard afterBootstrap hooks.
   * @param callback The function to execute during the child-bootstrap phase
   * @returns An unsubscribe function. Calling it unregisters the callback.
   */
  public onChildBootstrap(callback: () => void): () => void {
    this._bootstrapChildCallbacks.add(callback);
    return () => this._bootstrapChildCallbacks.delete(callback);
  }

  /**
   * @internal
   * Executes all registered afterBootstrap hooks in order of registration.
   * Should be called by the container after the bootstrap process is complete.
   */
  public runBootstrapHooks(): void {
    // Isolate each hook so one throwing callback cannot strand sibling children;
    // surface the first error after all have run. Snapshot so a hook that
    // registers or clears callbacks cannot disturb the walk.
    const errors = this._runGuarded([
      Array.from(this._bootstrapCallbacks),
      Array.from(this._bootstrapChildCallbacks),
    ]);

    if (errors.length) throw errors[0];
  }

  /**
   * Runs every callback in each group, isolating throws, and returns the
   * collected errors (empty if none threw). Groups run in the order given.
   */
  private _runGuarded(groups: Array<Iterable<() => void>>): unknown[] {
    const errors: unknown[] = [];
    for (const group of groups) {
      for (const cb of group) {
        try {
          cb();
        } catch (e) {
          errors.push(e);
        }
      }
    }
    return errors;
  }

  /**
   * @internal
   * Captures all four hook sets so a failing bootstrap can roll them back,
   * dropping user hooks and child hooks a factory may have registered.
   */
  public snapshotHooks(): iLifecycleHookSnapshot {
    return {
      bootstrap: new Set(this._bootstrapCallbacks),
      bootstrapChild: new Set(this._bootstrapChildCallbacks),
      destroy: new Set(this._destroyCallbacks),
      destroyChild: new Set(this._destroyChildCallbacks),
    };
  }

  /**
   * @internal
   * Restores the hooks captured by {@link snapshotHooks}, dropping any added
   * since (e.g. by a factory in a failed build, or a child spawned during it).
   */
  public restoreHooks(snapshot: iLifecycleHookSnapshot): void {
    this._restore(this._bootstrapCallbacks, snapshot.bootstrap);
    this._restore(this._bootstrapChildCallbacks, snapshot.bootstrapChild);
    this._restore(this._destroyCallbacks, snapshot.destroy);
    this._restore(this._destroyChildCallbacks, snapshot.destroyChild);
  }

  private _restore(target: Set<() => void>, snapshot: Set<() => void>): void {
    target.clear();
    for (const cb of snapshot) target.add(cb);
  }

  /**
   * Registers a cleanup callback that will be executed when the container is being destroyed.
   * Execution happens bottom-up, in reverse order of registration.
   *
   * @param callback The function to execute before the container is destroyed
   * @returns An unsubscribe function. Calling it unregisters the callback.
   */
  public beforeDestroy(callback: () => void): () => void {
    this._destroyCallbacks.add(callback);
    return () => this._destroyCallbacks.delete(callback);
  }

  /**
   * @internal
   * Registers a hook specifically intended for the phase when child containers are destroyed.
   * Runs before the standard beforeDestroy hooks.
   *
   * @param callback The function to execute during the child-destruction phase
   * @returns An unsubscribe function
   */
  public onChildDestroy(callback: () => void): () => void {
    this._destroyChildCallbacks.add(callback);
    return () => this._destroyChildCallbacks.delete(callback);
  }

  /**
   * @internal
   * Cascades the destruction process through registered hooks and marks the reference as destroyed.
   * Will throw an InjectionError if already destroyed.
   */
  public destroy(): void {
    if (this._destroyed) throw InjectionError.destroyed();
    // Mark destroyed before running hooks so a hook that (re-entrantly) checks
    // `destroyed` observes true; a guarded re-entrant destroy is a safe no-op
    // instead of recursing infinitely.
    this._destroyed = true;

    // Guard each hook so one throwing callback cannot strand sibling children
    // or abort the cascade; surface the first error after every hook has run.
    const errors = this._runGuarded([
      Array.from(this._destroyChildCallbacks).reverse(),
      Array.from(this._destroyCallbacks).reverse(),
    ]);

    this._bootstrapCallbacks.clear();
    this._bootstrapChildCallbacks.clear();
    this._destroyChildCallbacks.clear();
    this._destroyCallbacks.clear();

    if (errors.length) throw errors[0];
  }
}

if (!lcrGlobal[LIFECYCLE_REF_TOKEN_KEY]) {
  lcrGlobal[LIFECYCLE_REF_TOKEN_KEY] = new NodeToken<LifecycleRefImpl>("LifecycleRef");
}

/**
 * A token representing the lifecycle reference for the current container.
 * This can be injected to register hooks for bootstrap and destruction phases.
 */
export const LifecycleRef: NodeToken<LifecycleRefImpl> =
  lcrGlobal[LIFECYCLE_REF_TOKEN_KEY];
