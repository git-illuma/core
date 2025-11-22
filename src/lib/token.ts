import type { iNodeTokenBaseOptions } from "./types";

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
 */
export function isNodeBase<T>(
  specimen: unknown,
): specimen is NodeToken<T> | MultiNodeToken<T> {
  return specimen instanceof NodeToken || specimen instanceof MultiNodeToken;
}
