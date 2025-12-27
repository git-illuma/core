import { NodeBase } from "./api";
import type { Ctor } from "./types";

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
      100,
      `Duplicate provider for token "${token.toString()}" detected.`,
    );
  }
  public static duplicateFactory(token: NodeBase<unknown>): InjectionError {
    return new InjectionError(
      101,
      `Tried to re-provide factory for token "${token.toString()}" detected.`,
    );
  }

  public static invalidCtor(ctor: Ctor<unknown>): InjectionError {
    return new InjectionError(
      102,
      `Cannot use constructor for token "${ctor.name}". Please make sure to use @nodeInjectable() decorator`,
    );
  }

  public static invalidProvider(provider: string): InjectionError {
    return new InjectionError(
      103,
      `Cannot use provider as it is neither a NodeToken nor MultiNodeToken nor a valid constructor.:\n${provider}`,
    );
  }

  // Alias errors
  public static invalidAlias(alias: unknown): InjectionError {
    const aliasStr =
      typeof alias === "function" ? (alias as any).name || "Unknown" : String(alias);
    return new InjectionError(
      200,
      `Invalid alias target "${aliasStr}". Alias must be a NodeToken, MultiNodeToken, or a class decorated with @NodeInjectable().`,
    );
  }

  public static loopAlias(alias: NodeBase<unknown>): InjectionError {
    return new InjectionError(
      201,
      `Token "${alias.toString()}" cannot alias itself in a loop.`,
    );
  }

  // Bootstrap errors
  public static notBootstrapped(): InjectionError {
    return new InjectionError(
      300,
      "Cannot retrieve providers before the container has been bootstrapped.",
    );
  }

  public static bootstrapped(): InjectionError {
    return new InjectionError(
      301,
      "Cannot modify providers after the container has been bootstrapped.",
    );
  }

  public static doubleBootstrap(): InjectionError {
    return new InjectionError(
      302,
      "Container has already been bootstrapped and cannot be bootstrapped again.",
    );
  }

  // Retrieval errors
  public static notFound(token: NodeBase<unknown>): InjectionError {
    return new InjectionError(400, `No provider found for "${token.toString()}".`);
  }

  public static circularDependency(
    provider: NodeBase<unknown> | Ctor<unknown>,
    path: (NodeBase<unknown> | Ctor<unknown>)[],
  ): InjectionError {
    const providerStr =
      provider instanceof NodeBase ? provider.toString() : provider.name;
    const pathStr = path
      .map((p) => (p instanceof NodeBase ? p.toString() : p.name))
      .join(" -> ");

    return new InjectionError(
      401,
      `Circular dependency detected while resolving "${providerStr}":\n${pathStr}`,
    );
  }

  // Instantiation errors
  public static untracked(
    token: NodeBase<unknown> | Ctor<unknown>,
    parent: NodeBase<unknown> | Ctor<unknown>,
  ): InjectionError {
    const tokenStr = token instanceof NodeBase ? token.toString() : token.name;
    const parentStr = parent instanceof NodeBase ? parent.toString() : parent.name;
    return new InjectionError(
      500,
      `Cannot instantiate ${parentStr} because it depends on untracked injection ${tokenStr}. Please make sure all injections are properly tracked.`,
    );
  }

  public static outsideContext(token: NodeBase<unknown> | Ctor<unknown>): InjectionError {
    const tokenStr = token instanceof NodeBase ? token.toString() : token.name;
    return new InjectionError(
      501,
      `Cannot inject "${tokenStr}" outside of an injection context.`,
    );
  }

  public static calledUtilsOutsideContext(): InjectionError {
    return new InjectionError(
      502,
      "Cannot call injection utilities outside of an injection context.",
    );
  }

  public static instanceAccessFailed(token: NodeBase<unknown>): InjectionError {
    return new InjectionError(
      503,
      `Failed to access instance for token "${token.toString()}". It was not properly instantiated.`,
    );
  }

  public static accessFailed(): InjectionError {
    return new InjectionError(
      504,
      "Failed to access the requested instance due to an unknown error.",
    );
  }
}
