import { InjectionError } from "../errors";
import type {
  Ctor,
  ImplementationShape,
  iNodeAliasProvider,
  iNodeClassProvider,
  iNodeFactoryProvider,
  iNodeProvider,
  iNodeTokenBaseOptions,
  iNodeValueProvider,
  Token,
} from "../provider/types";
import { getInjectableToken, isInjectable } from "./decorator";

/**
 * Base class for dependency injection tokens. Should not be instantiated directly.
 * Use {@link NodeToken} or {@link MultiNodeToken} instead.
 * @template T - The type of value this token represents
 */
export abstract class NodeBase<T> {
  constructor(
    public readonly name: string,
    public readonly opts?: iNodeTokenBaseOptions<T>,
  ) {}

  /** Provides this token with a value */
  public withValue(value: T): iNodeValueProvider<T> {
    return {
      provide: this,
      value,
    };
  }

  /** Provides this token using a factory function */
  public withFactory(factory: () => T): iNodeFactoryProvider<T> {
    return {
      provide: this,
      factory,
    };
  }

  /** Provides this token using a class constructor */
  public withClass(ctor: Ctor<T>): iNodeClassProvider<T> {
    return {
      provide: this,
      useClass: ctor,
    };
  }

  /** Creates an alias to another token */
  public withAlias<K extends T>(alias: Token<K>): iNodeAliasProvider<T> {
    return {
      provide: this,
      alias,
    };
  }

  /**
   * Provides this token using a provider implementation shape
   * @param shape - The provider implementation shape
   * @returns The configured provider
   *
   * @example
   * ```typescript
   * const LOGGER_NODE = new NodeToken<Logger>('Logger');
   * const provider = LOGGER_NODE.implement({ useClass: ConsoleLogger });
   * container.provide(provider);
   * ```
   */
  public implement(shape: ImplementationShape<T>): iNodeProvider<T> {
    return {
      provide: this,
      ...shape,
    };
  }

  public toString(): string {
    return `Token[${this.name}]`;
  }
}
/**
 * A token that represents a single dependency in the dependency injection system.
 * Use this to define injectable dependencies that have exactly one provider.
 *
 * @template T - The type of value this token represents
 *
 * @example
 * ```typescript
 * const LoggerToken = new NodeToken<Logger>('Logger');
 * container.provide({ provide: LoggerToken, useClass: ConsoleLogger });
 * const logger = container.get(LoggerToken);
 * ```
 */
export class NodeToken<T> extends NodeBase<T> {
  public readonly multi = false as const;
  public override toString(): string {
    return `NodeToken[${this.name}]`;
  }
}

/**
 * A token that represents multiple dependencies in the dependency injection system.
 * Use this to define injectable dependencies that can have multiple providers.
 * When retrieved, returns an array of all registered providers.
 *
 * @template T - The type of value this token represents
 *
 * @example
 * ```typescript
 * const PluginToken = new MultiNodeToken<Plugin>('Plugins');
 * container.provide({ provide: PluginToken, useClass: PluginA });
 * container.provide({ provide: PluginToken, useClass: PluginB });
 * const plugins = container.get(PluginToken); // [PluginA instance, PluginB instance]
 * ```
 */
export class MultiNodeToken<T> extends NodeBase<T> {
  public readonly multi = true as const;
  public override toString(): string {
    return `MultiNodeToken[${this.name}]`;
  }
}

/**
 * Type guard to check if a value is a valid dependency injection token.
 *
 * @template T - The type of value the token represents
 * @param obj - The value to check
 * @returns True if the object is a NodeToken or MultiNodeToken, false otherwise
 * @internal
 */
export function isNodeBase<T>(obj: unknown): obj is NodeToken<T> | MultiNodeToken<T> {
  return obj instanceof NodeToken || obj instanceof MultiNodeToken;
}

/**
 * Extracts a valid NodeBase token from a given provider.
 * If the provider is a class constructor decorated with @NodeInjectable, it retrieves the associated token.
 * If the provider is already a NodeBase token, it returns it directly.
 * Throws an InjectionError if the provider is invalid.
 *
 * @template T - The type of value the token represents
 * @param provider - The provider to extract the token from
 * @param isAlias - Whether the provider is being used as an alias
 * @returns The extracted NodeBase token
 * @throws {InjectionError} If the provider is invalid
 * @internal
 */
export function extractToken<T>(
  provider: Token<T>,
  isAlias = false,
): NodeToken<T> | MultiNodeToken<T> {
  if (isNodeBase<T>(provider)) return provider;

  if (typeof provider === "function") {
    if (!isInjectable<T>(provider)) throw InjectionError.invalidCtor(provider);
    return getInjectableToken<T>(provider);
  }

  if (isAlias) throw InjectionError.invalidAlias(provider);
  throw InjectionError.invalidProvider(String(provider));
}
