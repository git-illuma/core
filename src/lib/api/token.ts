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

const NODE_TOKEN_CLASSES_KEY = Symbol.for("@illuma/core/NodeTokenClasses");

type iNodeTokenGlobalThis = typeof globalThis & {
  [NODE_TOKEN_CLASSES_KEY]?: {
    NodeBase: typeof NodeBaseImpl;
    NodeToken: typeof NodeTokenImpl;
    MultiNodeToken: typeof MultiNodeTokenImpl;
  };
};

const nodeTokenGlobal = globalThis as iNodeTokenGlobalThis;

/**
 * Base class for dependency injection tokens. Should not be instantiated directly.
 * Use {@link NodeToken} or {@link MultiNodeToken} instead.
 * @template T - The type of value this token represents
 */
abstract class NodeBaseImpl<T> {
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
class NodeTokenImpl<T> extends NodeBaseImpl<T> {
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
class MultiNodeTokenImpl<T> extends NodeBaseImpl<T> {
  public readonly multi = true as const;
  public override toString(): string {
    return `MultiNodeToken[${this.name}]`;
  }
}

if (!nodeTokenGlobal[NODE_TOKEN_CLASSES_KEY]) {
  nodeTokenGlobal[NODE_TOKEN_CLASSES_KEY] = {
    NodeBase: NodeBaseImpl,
    NodeToken: NodeTokenImpl,
    MultiNodeToken: MultiNodeTokenImpl,
  };
}

export type NodeBase<T> = NodeBaseImpl<T>;
export const NodeBase: typeof NodeBaseImpl =
  nodeTokenGlobal[NODE_TOKEN_CLASSES_KEY].NodeBase;

export type NodeToken<T> = NodeTokenImpl<T>;
export const NodeToken: typeof NodeTokenImpl =
  nodeTokenGlobal[NODE_TOKEN_CLASSES_KEY].NodeToken;

export type MultiNodeToken<T> = MultiNodeTokenImpl<T>;
export const MultiNodeToken: typeof MultiNodeTokenImpl =
  nodeTokenGlobal[NODE_TOKEN_CLASSES_KEY].MultiNodeToken;
