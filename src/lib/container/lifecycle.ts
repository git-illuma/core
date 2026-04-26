import { NodeToken } from "../api/token";
import { InjectionError } from "../errors";

/** @internal */
export class LifecycleRefImpl {
  private readonly _callbacks = new Set<() => void>();
  private readonly _childCallbacks = new Set<() => void>();

  private _destroyed = false;

  /**
   * Indicates whether the container that owns this references has already been destroyed.
   * If true, no further dependencies can be resolved, and existing providers are cleared.
   */
  public get destroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Registers a cleanup callback that will be executed when the container is being destroyed.
   * Execution happens bottom-up, in reverse order of registration.
   *
   * @param callback The function to execute before the container is destroyed
   * @returns An unsubscribe function. Calling it unregisters the callback.
   */
  public beforeDestroy(callback: () => void): () => void {
    this._callbacks.add(callback);
    return () => this._callbacks.delete(callback);
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
    this._childCallbacks.add(callback);
    return () => this._childCallbacks.delete(callback);
  }

  /**
   * @internal
   * Cascades the destruction process through registered hooks and marks the reference as destroyed.
   * Will throw an InjectionError if already destroyed.
   */
  public destroy(): void {
    if (this._destroyed) throw InjectionError.destroyed();

    for (const cb of Array.from(this._childCallbacks).reverse()) cb();
    for (const cb of Array.from(this._callbacks).reverse()) cb();

    this._childCallbacks.clear();
    this._callbacks.clear();
    this._destroyed = true;
  }
}

export const LifecycleRef = new NodeToken<LifecycleRefImpl>("LifecycleRef");
