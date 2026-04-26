import { NodeToken } from "../api/token";
import { InjectionError } from "../errors";

export class LifecycleRefImpl {
  private readonly _callbacks = new Set<() => void>();
  private readonly _childCallbacks = new Set<() => void>();

  private _destroyed = false;
  public get destroyed(): boolean {
    return this._destroyed;
  }

  public beforeDestroy(callback: () => void): () => void {
    this._callbacks.add(callback);
    return () => this._callbacks.delete(callback);
  }

  public onChildDestroy(callback: () => void): () => void {
    this._childCallbacks.add(callback);
    return () => this._childCallbacks.delete(callback);
  }

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
