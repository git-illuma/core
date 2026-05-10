import { NodeToken } from "../api/token";
import { InjectionError } from "../errors";

const LIFECYCLE_REF_TOKEN_KEY = Symbol.for("@illuma/core/LifecycleRefToken");

type iLifecycleGlobalThis = typeof globalThis & {
  [LIFECYCLE_REF_TOKEN_KEY]?: NodeToken<LifecycleRefImpl>;
};

const lcrGlobal = globalThis as iLifecycleGlobalThis;

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
    for (const cb of this._bootstrapCallbacks) cb();
    for (const cb of this._bootstrapChildCallbacks) cb();
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

    for (const cb of Array.from(this._destroyChildCallbacks).reverse()) cb();
    for (const cb of Array.from(this._destroyCallbacks).reverse()) cb();

    this._bootstrapCallbacks.clear();
    this._bootstrapChildCallbacks.clear();
    this._destroyChildCallbacks.clear();
    this._destroyCallbacks.clear();
    this._destroyed = true;
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
