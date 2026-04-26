import { NodeBase } from "./api/token";
import type { Ctor } from "./provider/types";

export const ERR_CODES = {
  // Provider errors
  DUPLICATE_PROVIDER: 100,
  DUPLICATE_FACTORY: 101,
  INVALID_CTOR: 102,
  INVALID_PROVIDER: 103,

  // Alias errors
  INVALID_ALIAS: 200,
  LOOP_ALIAS: 201,
  CONFLICTING_STRATEGIES: 202,

  // Bootstrap errors
  NOT_BOOTSTRAPPED: 300,
  BOOTSTRAPPED: 301,
  DOUBLE_BOOTSTRAP: 302,
  DESTROYED: 303,

  // Retrieval errors
  NOT_FOUND: 400,
  CIRCULAR_DEPENDENCY: 401,

  // Instantiation errors
  UNTRACKED: 500,
  OUTSIDE_CONTEXT: 501,
  CALLED_UTILS_OUTSIDE_CONTEXT: 502,
  INSTANCE_ACCESS_FAILED: 503,
  ACCESS_FAILED: 504,
} as const;

export class InjectionError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(`[i${code}] ${message}`);
    this.name = "InjectionError";
  }

  // Provider errors
  public static duplicate(token: NodeBase<unknown>): InjectionError {
    return new InjectionError(
      ERR_CODES.DUPLICATE_PROVIDER,
      `Duplicate provider for token "${token.toString()}" detected.`,
    );
  }
  public static duplicateFactory(token: NodeBase<unknown>): InjectionError {
    return new InjectionError(
      ERR_CODES.DUPLICATE_FACTORY,
      `Tried to re-provide factory for token "${token.toString()}" detected.`,
    );
  }

  public static invalidCtor(ctor: Ctor<unknown>): InjectionError {
    return new InjectionError(
      ERR_CODES.INVALID_CTOR,
      `Cannot use constructor for token "${ctor.name}". Please make sure to use @nodeInjectable() decorator`,
    );
  }

  public static invalidProvider(provider: unknown): InjectionError {
    return new InjectionError(
      ERR_CODES.INVALID_PROVIDER,
      `Cannot use provider as it is neither a NodeToken nor MultiNodeToken nor a valid constructor.:\n${provider}`,
    );
  }

  // Alias errors
  public static invalidAlias(alias: unknown): InjectionError {
    const aliasStr = formatNodeName(alias);
    return new InjectionError(
      ERR_CODES.INVALID_ALIAS,
      `Invalid alias target "${aliasStr}". Alias must be a NodeToken, MultiNodeToken, or a class decorated with @NodeInjectable().`,
    );
  }

  public static loopAlias(alias: NodeBase<unknown>): InjectionError {
    return new InjectionError(
      ERR_CODES.LOOP_ALIAS,
      `Token "${alias.toString()}" cannot alias itself in a loop.`,
    );
  }

  public static conflictingStrategies(alias: NodeBase<unknown>): InjectionError {
    return new InjectionError(
      ERR_CODES.CONFLICTING_STRATEGIES,
      `Token "${alias.toString()}" cannot use both 'self' and 'skipSelf' strategies.`,
    );
  }

  // Bootstrap errors
  public static notBootstrapped(): InjectionError {
    return new InjectionError(
      ERR_CODES.NOT_BOOTSTRAPPED,
      "Cannot retrieve providers before the container has been bootstrapped.",
    );
  }

  public static bootstrapped(): InjectionError {
    return new InjectionError(
      ERR_CODES.BOOTSTRAPPED,
      "Cannot modify providers after the container has been bootstrapped.",
    );
  }

  public static doubleBootstrap(): InjectionError {
    return new InjectionError(
      ERR_CODES.DOUBLE_BOOTSTRAP,
      "Container has already been bootstrapped and cannot be bootstrapped again.",
    );
  }

  public static destroyed(): InjectionError {
    return new InjectionError(
      ERR_CODES.DESTROYED,
      "Container has been already destroyed.",
    );
  }

  // Retrieval errors
  public static notFound(token: NodeBase<unknown>): InjectionError {
    return new InjectionError(
      ERR_CODES.NOT_FOUND,
      `No provider found for "${token.toString()}".`,
    );
  }

  public static circularDependency(
    provider: NodeBase<unknown> | Ctor<unknown>,
    path: (NodeBase<unknown> | Ctor<unknown>)[],
  ): InjectionError {
    const providerStr = formatNodeName(provider);
    const pathStr = path.map((p) => formatNodeName(p)).join(" -> ");

    return new InjectionError(
      ERR_CODES.CIRCULAR_DEPENDENCY,
      `Circular dependency detected while resolving "${providerStr}":\n${pathStr}`,
    );
  }

  // Instantiation errors
  public static untracked(
    token: NodeBase<unknown> | Ctor<unknown>,
    parent: NodeBase<unknown> | Ctor<unknown>,
  ): InjectionError {
    const tokenStr = formatNodeName(token);
    const parentStr = formatNodeName(parent);
    return new InjectionError(
      ERR_CODES.UNTRACKED,
      `Cannot instantiate ${parentStr} because it depends on untracked injection ${tokenStr}. Please make sure all injections are properly tracked.`,
    );
  }

  public static outsideContext(token: NodeBase<unknown> | Ctor<unknown>): InjectionError {
    const tokenStr = formatNodeName(token);
    return new InjectionError(
      ERR_CODES.OUTSIDE_CONTEXT,
      `Cannot inject "${tokenStr}" outside of an injection context.`,
    );
  }

  public static calledUtilsOutsideContext(): InjectionError {
    return new InjectionError(
      ERR_CODES.CALLED_UTILS_OUTSIDE_CONTEXT,
      "Cannot call injection utilities outside of an injection context.",
    );
  }

  public static instanceAccessFailed(token: NodeBase<unknown>): InjectionError {
    return new InjectionError(
      ERR_CODES.INSTANCE_ACCESS_FAILED,
      `Failed to access instance for token "${token.toString()}". It was not properly instantiated.`,
    );
  }

  public static accessFailed(): InjectionError {
    return new InjectionError(
      ERR_CODES.ACCESS_FAILED,
      "Failed to access the requested instance due to an unknown error.",
    );
  }
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof InjectionError && error.code === ERR_CODES.NOT_FOUND;
}

function formatNodeName(node: unknown): string {
  if (!node) return "Unknown";
  if (node instanceof NodeBase) return node.toString();
  if (typeof node === "function" && "name" in node) return node.name || "Unknown";
  return String(node);
}
