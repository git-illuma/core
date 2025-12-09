import { InjectionError } from "../errors";
import type {
  Ctor,
  iNodeAliasProvider,
  iNodeClassProvider,
  iNodeFactoryProvider,
  iNodeTokenBaseOptions,
  iNodeValueProvider,
  Token,
} from "../types";
import { getInjectableToken, isInjectable } from "./decorator";

/**
 * Base class for dependency injection tokens.
 * This class should not be instantiated directly. Use {@link NodeToken} or {@link MultiNodeToken} instead.
 *
 * @template T - The type of value this token represents
 */
export class NodeBase<T> {
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
 * @param specimen - The value to check
 * @returns True if the specimen is a NodeToken or MultiNodeToken, false otherwise
 * @internal
 */
export function isNodeBase<T>(
  specimen: unknown,
): specimen is NodeToken<T> | MultiNodeToken<T> {
  return specimen instanceof NodeToken || specimen instanceof MultiNodeToken;
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
  let token: NodeBase<T> | null = null;
  if (isInjectable<T>(provider)) {
    token = getInjectableToken<T>(provider);
  } else if (isNodeBase<T>(provider)) token = provider;

  if (!token || !isNodeBase<T>(token)) {
    if (isAlias) throw InjectionError.invalidAlias(provider);
    throw InjectionError.invalidProvider(JSON.stringify(provider));
  }

  return token;
}
