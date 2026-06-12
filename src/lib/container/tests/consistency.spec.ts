import { afterEach, describe, expect, it } from "vitest";
import { MultiNodeToken, NodeToken, nodeInject } from "../../api";
import { Illuma } from "../../global";
import type { iDiagnosticsReport } from "../../plugins/diagnostics/types";
import { Injector } from "../../utils/injector";
import { NodeContainer } from "../container";

describe("multi token retrieval consistency", () => {
  it("get() returns [] for an unprovided multi token with skipSelf", () => {
    const parent = new NodeContainer();
    parent.bootstrap();
    const child = parent.child() as NodeContainer;
    child.bootstrap();

    const MULTI = new MultiNodeToken<number>("MULTI_SKIP_SELF");

    expect(child.get(MULTI)).toEqual([]);
    expect(child.get(MULTI, { skipSelf: true })).toEqual([]);
  });

  it("get() returns [] for an unprovided multi token with optional", () => {
    const container = new NodeContainer();
    container.bootstrap();

    const MULTI = new MultiNodeToken<number>("MULTI_OPTIONAL");

    expect(container.get(MULTI, { optional: true })).toEqual([]);
  });

  it("produce() resolves an unprovided multi token to [] regardless of strategy", () => {
    const container = new NodeContainer();
    container.bootstrap();

    const MULTI = new MultiNodeToken<number>("MULTI_PRODUCE");

    const produced = container.produce(() => ({
      plain: nodeInject(MULTI),
      skipSelf: nodeInject(MULTI, { skipSelf: true }),
    }));

    expect(produced.plain).toEqual([]);
    expect(produced.skipSelf).toEqual([]);
  });
});

describe("token declaration after implementation", () => {
  it("accepts a bare declaration after a value provider for the same token", () => {
    const TOKEN = new NodeToken<number>("DECLARED_AFTER_VALUE");

    const container = new NodeContainer();
    container.provide(TOKEN.withValue(7));
    expect(() => container.provide(TOKEN)).not.toThrow();

    container.bootstrap();
    expect(container.get(TOKEN)).toBe(7);
  });

  it("accepts a bare declaration after a provider for the same multi token", () => {
    const MULTI = new MultiNodeToken<number>("MULTI_DECLARED_AFTER_VALUE");

    const container = new NodeContainer();
    container.provide(MULTI.withValue(1));
    expect(() => container.provide(MULTI)).not.toThrow();

    container.bootstrap();
    expect(container.get(MULTI)).toEqual([1]);
  });

  it("still throws on a duplicate bare declaration", () => {
    const TOKEN = new NodeToken<number>("DOUBLE_DECLARATION");
    const MULTI = new MultiNodeToken<number>("DOUBLE_MULTI_DECLARATION");

    const container = new NodeContainer();
    container.provide(TOKEN);
    container.provide(MULTI);

    expect(() => container.provide(TOKEN)).toThrow();
    expect(() => container.provide(MULTI)).toThrow();
  });
});

describe("diagnostics report consistency", () => {
  afterEach(() => {
    (Illuma as any).__resetPlugins();
  });

  it("does not report built-in Injector and LifecycleRef as unused", () => {
    const reports: iDiagnosticsReport[] = [];
    Illuma.extendDiagnostics({ onReport: (r) => reports.push(r) });

    const container = new NodeContainer();
    container.bootstrap();

    expect(reports).toHaveLength(1);
    expect(reports[0].unusedNodes).toEqual([]);
  });
});

describe("allocation counting accuracy", () => {
  it("counts a dependency injected twice by the same factory once", () => {
    const DEP = new NodeToken<string>("DEP_TWICE");
    const HOST = new NodeToken<string>("HOST_TWICE");

    const container = new NodeContainer();
    container.provide(DEP.withValue("dep"));
    container.provide(
      HOST.withFactory(() => {
        nodeInject(DEP);
        nodeInject(DEP);
        return "host";
      }),
    );
    container.bootstrap();

    const rootNode = (container as any)._rootNode;
    expect(rootNode.find(DEP).allocations).toBe(1);
  });

  it("does not double-count a node listed twice in a multi token", () => {
    const SINGLE = new NodeToken<string>("MULTI_MEMBER");
    const MULTI = new MultiNodeToken<string>("MULTI_DOUBLE_ADD");

    const container = new NodeContainer();
    container.provide(SINGLE.withValue("member"));
    container.provide({ provide: MULTI, alias: SINGLE });
    container.bootstrap();

    const rootNode = (container as any)._rootNode;
    const multiNode = rootNode.find(MULTI);
    multiNode.addDependency(rootNode.find(SINGLE));
    multiNode.addDependency(rootNode.find(SINGLE));

    expect(rootNode.find(SINGLE).allocations).toBe(1);
  });

  it("resolves Injector via get() when a factory also injects it", () => {
    const HOST = new NodeToken<string>("INJECTOR_GET_HOST");

    const container = new NodeContainer();
    container.provide(
      HOST.withFactory(() => {
        nodeInject(Injector);
        return "host";
      }),
    );
    container.bootstrap();

    expect(container.get(Injector)).toBeDefined();
  });

  it("keeps the Injector allocation count intact", () => {
    const HOST = new NodeToken<string>("INJECTOR_HOST");

    const container = new NodeContainer();
    container.provide(
      HOST.withFactory(() => {
        nodeInject(Injector);
        return "host";
      }),
    );
    container.bootstrap();

    const rootNode = (container as any)._rootNode;
    expect(rootNode.find(Injector).allocations).toBe(1);
  });
});
