import type { NodeToken } from '../../api/token';

export interface iInstantiationParams<T> {
  readonly token: NodeToken<T>;
  readonly factory: () => T;
}
