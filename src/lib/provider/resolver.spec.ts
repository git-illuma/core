import { describe, expect, it, vi } from "vitest";
import { MultiNodeToken, NodeToken, nodeInject } from "../api";
import { InjectionError } from "../errors";
import { ProtoNodeMulti, ProtoNodeSingle } from "./proto";
import { resolveTreeNode } from "./resolver";
import { TreeNodeMulti, TreeNodeSingle } from "./tree-node";

describe("resolveTreeNode", () => {
  it("should resolve a single node with no dependencies", () => {
    const token = new NodeToken<string>("test");
    const proto = new ProtoNodeSingle(token, () => "value");
    const cache = new Map();
    const singleNodes = new Map([[token, proto]]);
    const multiNodes = new Map();

    const node = resolveTreeNode(proto, cache, singleNodes, multiNodes);

    expect(node).toBeInstanceOf(TreeNodeSingle);
    expect((node as TreeNodeSingle).proto).toBe(proto);
    expect(cache.get(proto)).toBe(node);
  });

  it("should resolve a single node with dependencies", () => {
    const depToken = new NodeToken<string>("dep");
    const depProto = new ProtoNodeSingle(depToken, () => "dep");

    const token = new NodeToken<string>("test");
    const factory = () => {
      nodeInject(depToken);
      return "value";
    };
    const proto = new ProtoNodeSingle(token, factory);

    const cache = new Map();
    const singleNodes = new Map<any, any>([
      [token, proto],
      [depToken, depProto],
    ]);
    const multiNodes = new Map();

    const node = resolveTreeNode(proto, cache, singleNodes, multiNodes);

    expect(node).toBeInstanceOf(TreeNodeSingle);
  });

  it("should throw on missing dependency", () => {
    const depToken = new NodeToken<string>("dep");
    const token = new NodeToken<string>("test");
    const factory = () => {
      nodeInject(depToken);
      return "value";
    };
    const proto = new ProtoNodeSingle(token, factory);

    const cache = new Map();
    const singleNodes = new Map([[token, proto]]);
    const multiNodes = new Map();

    expect(() => resolveTreeNode(proto, cache, singleNodes, multiNodes)).toThrow(
      InjectionError,
    );
  });

  it("should handle optional dependencies", () => {
    const depToken = new NodeToken<string>("dep");
    const token = new NodeToken<string>("test");
    const factory = () => {
      nodeInject(depToken, { optional: true });
      return "value";
    };
    const proto = new ProtoNodeSingle(token, factory);

    const cache = new Map();
    const singleNodes = new Map([[token, proto]]);
    const multiNodes = new Map();

    const node = resolveTreeNode(proto, cache, singleNodes, multiNodes);
    expect(node).toBeInstanceOf(TreeNodeSingle);
  });

  it("should detect circular dependencies", () => {
    const tokenA = new NodeToken<string>("A");
    const tokenB = new NodeToken<string>("B");

    const factoryA = () => {
      nodeInject(tokenB);
      return "A";
    };
    const factoryB = () => {
      nodeInject(tokenA);
      return "B";
    };

    const protoA = new ProtoNodeSingle(tokenA, factoryA);
    const protoB = new ProtoNodeSingle(tokenB, factoryB);

    const cache = new Map();
    const singleNodes = new Map<any, any>([
      [tokenA, protoA],
      [tokenB, protoB],
    ]);
    const multiNodes = new Map();

    expect(() => resolveTreeNode(protoA, cache, singleNodes, multiNodes)).toThrow(
      InjectionError,
    );
  });

  it("should resolve multi nodes", () => {
    const token = new MultiNodeToken<string>("multi");
    const proto = new ProtoNodeMulti(token);

    const depToken = new NodeToken<string>("dep");
    const depProto = new ProtoNodeSingle(depToken, () => "dep");
    proto.addProvider(depToken);

    const cache = new Map();
    const singleNodes = new Map<any, any>([[depToken, depProto]]);
    const multiNodes = new Map([[token, proto]]);

    const node = resolveTreeNode(proto, cache, singleNodes, multiNodes);

    expect(node).toBeInstanceOf(TreeNodeMulti);
    expect((node as TreeNodeMulti).proto).toBe(proto);
  });

  it("should resolve transparent nodes", () => {
    const token = new MultiNodeToken<string>("multi");
    const proto = new ProtoNodeMulti(token);

    const factory = () => "transparent";
    proto.addProvider(factory);

    const cache = new Map();
    const singleNodes = new Map();
    const multiNodes = new Map([[token, proto]]);

    const node = resolveTreeNode(proto, cache, singleNodes, multiNodes);

    expect(node).toBeInstanceOf(TreeNodeMulti);
  });

  it("should use upstream getter", () => {
    const token = new NodeToken<string>("test");
    const proto = new ProtoNodeSingle(token, () => {
      nodeInject(new NodeToken("upstream"));
      return "value";
    });

    const cache = new Map();
    const singleNodes = new Map([[token, proto]]);
    const multiNodes = new Map();

    const upstreamNode = new TreeNodeSingle(
      new ProtoNodeSingle(new NodeToken("upstream"), () => "upstream"),
    );
    const upstreamGetter = vi.fn().mockReturnValue(upstreamNode);

    const node = resolveTreeNode(proto, cache, singleNodes, multiNodes, upstreamGetter);

    expect(node).toBeInstanceOf(TreeNodeSingle);
    expect(upstreamGetter).toHaveBeenCalled();
  });

  it("should inject MultiNodeToken into ProtoNodeSingle", () => {
    const multiToken = new MultiNodeToken<string>("multi");
    const multiProto = new ProtoNodeMulti(multiToken);

    const token = new NodeToken<string>("test");
    const factory = () => {
      nodeInject(multiToken);
      return "value";
    };
    const proto = new ProtoNodeSingle(token, factory);

    const cache = new Map();
    const singleNodes = new Map([[token, proto]]);
    const multiNodes = new Map([[multiToken, multiProto]]);

    const node = resolveTreeNode(proto, cache, singleNodes, multiNodes);
    expect(node).toBeInstanceOf(TreeNodeSingle);
  });

  it("should handle ProtoNodeMulti with upstream TreeNodeMulti", () => {
    const token = new MultiNodeToken<string>("multi");
    const proto = new ProtoNodeMulti(token);

    const cache = new Map();
    const singleNodes = new Map();
    const multiNodes = new Map([[token, proto]]);

    const upstreamNode = new TreeNodeMulti(new ProtoNodeMulti(token));
    const upstreamGetter = vi.fn().mockReturnValue(upstreamNode);

    const node = resolveTreeNode(proto, cache, singleNodes, multiNodes, upstreamGetter);
    expect(node).toBeInstanceOf(TreeNodeMulti);
    expect(upstreamGetter).toHaveBeenCalledWith(token);
  });

  it("should create ProtoNodeSingle if missing from map when resolving MultiNode", () => {
    const token = new MultiNodeToken<string>("multi");
    const proto = new ProtoNodeMulti(token);

    const depToken = new NodeToken<string>("dep");
    proto.addProvider(depToken);

    const cache = new Map();
    const singleNodes = new Map();
    const multiNodes = new Map([[token, proto]]);

    const node = resolveTreeNode(proto, cache, singleNodes, multiNodes);

    expect(node).toBeInstanceOf(TreeNodeMulti);
    expect(singleNodes.has(depToken)).toBe(true);
  });

  it("should handle nested MultiNodeToken", () => {
    const parentToken = new MultiNodeToken<string>("parent");
    const parentProto = new ProtoNodeMulti(parentToken);

    const childToken = new MultiNodeToken<string>("child");
    parentProto.addProvider(childToken);

    const cache = new Map();
    const singleNodes = new Map();
    const multiNodes = new Map([[parentToken, parentProto]]);

    const node = resolveTreeNode(parentProto, cache, singleNodes, multiNodes);

    expect(node).toBeInstanceOf(TreeNodeMulti);
    expect(multiNodes.has(childToken)).toBe(true);
  });

  it("should use cached dependency", () => {
    const sharedToken = new NodeToken<string>("shared");
    const sharedProto = new ProtoNodeSingle(sharedToken, () => "shared");

    const tokenA = new NodeToken<string>("A");
    const factoryA = () => {
      nodeInject(sharedToken);
      return "A";
    };
    const protoA = new ProtoNodeSingle(tokenA, factoryA);

    const tokenB = new NodeToken<string>("B");
    const factoryB = () => {
      nodeInject(sharedToken);
      return "B";
    };
    const protoB = new ProtoNodeSingle(tokenB, factoryB);

    const rootToken = new NodeToken<string>("root");
    const rootFactory = () => {
      nodeInject(tokenA);
      nodeInject(tokenB);
      return "root";
    };
    const rootProto = new ProtoNodeSingle(rootToken, rootFactory);

    const cache = new Map();
    const singleNodes = new Map<any, any>([
      [rootToken, rootProto],
      [tokenA, protoA],
      [tokenB, protoB],
      [sharedToken, sharedProto],
    ]);
    const multiNodes = new Map();

    const node = resolveTreeNode(rootProto, cache, singleNodes, multiNodes);
    expect(node).toBeInstanceOf(TreeNodeSingle);
    expect(cache.has(sharedProto)).toBe(true);
  });

  it("should throw on unknown ProtoNode type", () => {
    const fakeProto = { token: new NodeToken("fake") } as any;
    expect(() => resolveTreeNode(fakeProto, new Map(), new Map(), new Map())).toThrow(
      "Unknown ProtoNode type",
    );
  });

  it("should not add dependency if upstream getter returns non-multi node for MultiNode", () => {
    const token = new MultiNodeToken<string>("multi");
    const proto = new ProtoNodeMulti(token);
    const upstreamNode = new TreeNodeSingle(new ProtoNodeSingle(new NodeToken("single")));
    const upstreamGetter = vi.fn().mockReturnValue(upstreamNode);

    const cache = new Map();
    const singleNodes = new Map();
    const multiNodes = new Map([[token, proto]]);

    const node = resolveTreeNode(proto, cache, singleNodes, multiNodes, upstreamGetter);

    expect(node).toBeInstanceOf(TreeNodeMulti);
    expect(upstreamGetter).toHaveBeenCalledWith(token);
  });

  it("should return cached node if already in cache", () => {
    const token = new NodeToken("test");
    const proto = new ProtoNodeSingle(token, () => "val");
    const cachedNode = new TreeNodeSingle(proto);
    const cache = new Map<any, any>([[proto, cachedNode]]);

    const result = resolveTreeNode(proto, cache, new Map(), new Map());
    expect(result).toBe(cachedNode);
  });
});
