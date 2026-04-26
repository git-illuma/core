import { NodeToken } from "../api/token";
import { InjectionError } from "../errors";

export class LifecycleRefImpl {
  private readonly _callbacks: (() => void)[] = [];
  private readonly _childCallbacks: (() => void)[] = [];

  private _destroyed = false;
  public get destroyed(): boolean {
    return this._destroyed;
  }

  public beforeDestroy(callback: () => void): () => void {
    this._callbacks.push(callback);
    return () => {
      const idx = this._callbacks.indexOf(callback);
      if (idx !== -1) this._callbacks.splice(idx, 1);
    };
  }

  public onChildDestroy(callback: () => void): () => void {
    this._childCallbacks.push(callback);
    return () => {
      const idx = this._childCallbacks.indexOf(callback);
      if (idx !== -1) this._childCallbacks.splice(idx, 1);
    };
  }

  public destroy(): void {
    if (this._destroyed) throw InjectionError.destroyed();
    for (let i = this._childCallbacks.length - 1; i >= 0; i--) {
      this._childCallbacks[i]();
    }

    for (let i = this._callbacks.length - 1; i >= 0; i--) {
      this._callbacks[i]();
    }

    this._destroyed = true;
  }
}

export const LifecycleRef = new NodeToken<LifecycleRefImpl>("LifecycleRef");
