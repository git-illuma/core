import { vi } from "vitest";
import { MultiNodeToken, NodeToken, nodeInject } from "../api";
import { InjectionError } from "../errors";
import {
  isNotTransparentProto,
  ProtoNodeMulti,
  ProtoNodeSingle,
  ProtoNodeTransparent,
} from "./proto";
import {
  TreeNodeMulti,
  TreeNodeSingle,
  TreeNodeTransparent,
  TreeRootNode,
} from "./tree-node";

describe("ProtoNodeSingle", () => {
  it("should create with token and factory", () => {
    const token = new NodeToken<string>("test");
    const factory = () => "value";
    const proto = new ProtoNodeSingle(token, factory);

    expect(proto.token).toBe(token);
    expect(proto.factory).toBe(factory);
  });

  it("should set factory when not already set", () => {
    const token = new NodeToken<string>("test");
    const proto = new ProtoNodeSingle(token);
    const factory = () => "value";

    proto.setFactory(factory);
    expect(proto.factory).toBe(factory);
  });

  it("should scan injections when setting factory", () => {
    const token = new NodeToken<string>("test");
    const proto = new ProtoNodeSingle(token);
    const depToken = new NodeToken<string>("dep");
    const factory = () => {
      nodeInject(depToken);
      return "value";
    };

    proto.setFactory(factory);
    expect(proto.injections.size).toBe(1);
  });

  it("should throw when setting factory twice", () => {
    const token = new NodeToken<string>("test");
    const proto = new ProtoNodeSingle(token, () => "first");

    expect(() => proto.setFactory(() => "second")).toThrow(InjectionError);
  });
});

describe("ProtoNodeTransparent", () => {
  it("should create with parent and factory", () => {
    const token = new NodeToken<string>("test");
    const parent = new ProtoNodeSingle(token);
    const factory = () => "value";
    const proto = new ProtoNodeTransparent(parent, factory);

    expect(proto.parent).toBe(parent);
    expect(proto.factory).toBe(factory);
  });
});

describe("ProtoNodeMulti", () => {
  it("should add different provider types", () => {
    const token = new MultiNodeToken<string>("multi");
    const proto = new ProtoNodeMulti(token);
    const singleToken = new NodeToken<string>("single");
    const multiToken = new MultiNodeToken<string>("another");

    proto.addProvider(singleToken);
    proto.addProvider(multiToken);
    proto.addProvider(() => "value");

    expect(proto.singleNodes.has(singleToken)).toBe(true);
    expect(proto.multiNodes.has(multiToken)).toBe(true);
    expect(proto.transparentNodes.size).toBe(1);
  });
});

describe("TreeRootNode", () => {
  describe("tree instantiation", () => {
    it("should add and instantiate dependencies", () => {
      const root = new TreeRootNode();
      const token = new NodeToken<string>("test");
      const proto = new ProtoNodeSingle(token, () => "value");
      const node = new TreeNodeSingle(proto);

      root.addDependency(node);
      root.build();

      expect(root.find(token)).toBe(node);
    });

    it("should handle shared dependencies", () => {
      const root = new TreeRootNode();
      const sharedToken = new NodeToken<string>("shared");
      const sharedProto = new ProtoNodeSingle(sharedToken, () => "shared-value");
      const sharedNode = new TreeNodeSingle(sharedProto);

      const node1Token = new NodeToken<string>("node1");
      const node1Proto = new ProtoNodeSingle(node1Token, () => "value1");
      const node1 = new TreeNodeSingle(node1Proto);
      node1.addDependency(sharedNode);

      const node2Token = new NodeToken<string>("node2");
      const node2Proto = new ProtoNodeSingle(node2Token, () => "value2");
      const node2 = new TreeNodeSingle(node2Proto);
      node2.addDependency(sharedNode);

      root.addDependency(node1);
      root.addDependency(node2);
      root.build();

      expect(root.find(sharedToken)).toBe(sharedNode);
    });

    it("should return null when token not found", () => {
      const root = new TreeRootNode();
      expect(root.find(new NodeToken<string>("test"))).toBeNull();
    });
  });

  describe("deferred instantiation", () => {
    function createSingleNode<T>(
      token: NodeToken<T>,
      factory: () => T,
    ): TreeNodeSingle<T> {
      const proto = new ProtoNodeSingle(token, factory);
      return new TreeNodeSingle(proto);
    }

    it("should defer instantiation until find is called", () => {
      const root = new TreeRootNode(false);

      const token = new NodeToken<string>("test");
      const factorySpy = vi.fn(() => "value");

      const node = createSingleNode(token, factorySpy);

      root.addDependency(node);

      // Dry run to obtain dependencies
      expect(factorySpy).toHaveBeenCalledTimes(1);

      root.build();

      expect(factorySpy).toHaveBeenCalledTimes(1); // <- not called yet

      const foundNode = root.find(token);

      expect(foundNode?.instance).toBe("value");
      expect(foundNode).toBe(node);
      expect(factorySpy).toHaveBeenCalledTimes(2);
    });

    it("should defer instantiation of shared dependencies", () => {
      const root = new TreeRootNode(false);

      const sharedToken = new NodeToken<string>("shared");
      const node1Token = new NodeToken<string>("node1");
      const node2Token = new NodeToken<string>("node2");

      const sharedFactorySpy = vi.fn(() => "shared-value");
      const node1Factory = () => nodeInject(sharedToken).slice(0, 6);
      const node2Factory = () => nodeInject(sharedToken).slice(7);

      const sharedNode = createSingleNode(sharedToken, sharedFactorySpy);

      const node1 = createSingleNode(node1Token, node1Factory);
      node1.addDependency(sharedNode);

      const node2 = createSingleNode(node2Token, node2Factory);
      node2.addDependency(sharedNode);

      root.addDependency(node1);
      root.addDependency(node2);

      root.build();
      expect(sharedFactorySpy).toHaveBeenCalledTimes(1);

      const foundNode1 = root.find(node1Token);
      expect(sharedFactorySpy).toHaveBeenCalledTimes(2);
      expect(foundNode1?.instance).toBe("shared");

      const foundNode2 = root.find(node2Token);
      expect(sharedFactorySpy).toHaveBeenCalledTimes(2);
      expect(foundNode2?.instance).toBe("value");
    });

    it("should work when retrieving from the middle of the tree", () => {
      const root = new TreeRootNode(false);

      const deepToken = new NodeToken<string>("shared");
      const token1 = new NodeToken<string>("node1");
      const token2 = new NodeToken<string>("node2");

      const deepFactorySpy = vi.fn(() => "shared-value");
      const node1FactorySpy = vi.fn(() => nodeInject(deepToken).slice(0, 6));
      const node2FactorySpy = vi.fn(() => nodeInject(token1).slice(3));

      const deepNode = createSingleNode(deepToken, deepFactorySpy);
      expect(deepFactorySpy).toHaveBeenCalledTimes(1);

      const node1 = createSingleNode(token1, node1FactorySpy);
      expect(node1FactorySpy).toHaveBeenCalledTimes(1);
      node1.addDependency(deepNode);

      const node2 = createSingleNode(token2, node2FactorySpy);
      expect(node2FactorySpy).toHaveBeenCalledTimes(1);
      node2.addDependency(node1);

      root.addDependency(node2);
      root.build();

      const foundNode1 = root.find(token1);
      expect(deepFactorySpy).toHaveBeenCalledTimes(2); // <- actual call
      expect(node1FactorySpy).toHaveBeenCalledTimes(2); // <- actual call
      expect(node2FactorySpy).toHaveBeenCalledTimes(1); // <- never called yet
      expect(foundNode1?.instance).toBe("shared");

      const foundNode2 = root.find(token2);
      expect(deepFactorySpy).toHaveBeenCalledTimes(2); // <- never called again
      expect(node1FactorySpy).toHaveBeenCalledTimes(2); // <- never called again
      expect(node2FactorySpy).toHaveBeenCalledTimes(2); // <- actual call
      expect(foundNode2?.instance).toBe("red");
    });
  });
});

describe("TreeNodeSingle", () => {
  it("should instantiate with factory from proto", () => {
    const token = new NodeToken<string>("test");
    const proto = new ProtoNodeSingle(token, () => "value");
    const node = new TreeNodeSingle(proto);

    node.instantiate();
    expect(node.instance).toBe("value");
  });

  it("should instantiate with factory from token options", () => {
    const token = new NodeToken<string>("test", { factory: () => "value" });
    const proto = new ProtoNodeSingle(token);
    const node = new TreeNodeSingle(proto);

    node.instantiate();
    expect(node.instance).toBe("value");
  });

  it("should throw when no factory available", () => {
    const token = new NodeToken<string>("test");
    const proto = new ProtoNodeSingle(token);
    const node = new TreeNodeSingle(proto);

    expect(() => node.instantiate()).toThrow(InjectionError);
  });

  it("should inject dependencies", () => {
    const depToken = new NodeToken<string>("dep");
    const depProto = new ProtoNodeSingle(depToken, () => "dep-value");
    const depNode = new TreeNodeSingle(depProto);

    const token = new NodeToken<string>("test");
    const proto = new ProtoNodeSingle(token, () => {
      const dep = nodeInject(depToken);
      return `test-${dep}`;
    });
    const node = new TreeNodeSingle(proto);

    node.addDependency(depNode);
    node.instantiate();

    expect(node.instance).toBe("test-dep-value");
  });

  it("should throw when dependency is untracked", () => {
    const depToken = new NodeToken<string>("dep");
    const token = new NodeToken<string>("test");
    const proto = new ProtoNodeSingle(token, () => {
      nodeInject(depToken);
      return "value";
    });
    const node = new TreeNodeSingle(proto);

    expect(() => node.instantiate()).toThrow(InjectionError);
  });

  it("should handle optional dependencies", () => {
    const depToken = new NodeToken<string>("dep");
    const token = new NodeToken<string>("test");
    const proto = new ProtoNodeSingle(token, () => {
      const dep = nodeInject(depToken, { optional: true });
      return dep ? dep : "value";
    });
    const node = new TreeNodeSingle(proto);

    node.instantiate();
    expect(node.instance).toBe("value");
  });

  it("should throw when accessing instance before instantiation", () => {
    const token = new NodeToken<string>("test");
    const proto = new ProtoNodeSingle(token, () => "value");
    const node = new TreeNodeSingle(proto);

    expect(() => node.instance).toThrow(InjectionError);
  });
});

describe("TreeNodeTransparent", () => {
  it("should instantiate with factory", () => {
    const token = new NodeToken<string>("test");
    const parent = new ProtoNodeSingle(token);
    const proto = new ProtoNodeTransparent(parent, () => "transparent-value");
    const node = new TreeNodeTransparent(proto);

    node.instantiate();
    expect(node.instance).toBe("transparent-value");
  });

  it("should inject dependencies", () => {
    const depToken = new NodeToken<string>("dep");
    const depProto = new ProtoNodeSingle(depToken, () => "dep-value");
    const depNode = new TreeNodeSingle(depProto);

    const token = new NodeToken<string>("test");
    const parent = new ProtoNodeSingle(token);
    const proto = new ProtoNodeTransparent(parent, () => {
      const dep = nodeInject(depToken);
      return `transparent-${dep}`;
    });
    const node = new TreeNodeTransparent(proto);

    node.addDependency(depNode);
    node.instantiate();

    expect(node.instance).toBe("transparent-dep-value");
  });

  it("should throw when dependency is untracked", () => {
    const depToken = new NodeToken<string>("dep");
    const token = new NodeToken<string>("test");
    const parent = new ProtoNodeSingle(token);
    const factory = () => {
      nodeInject(depToken);
      return "value";
    };
    const proto = new ProtoNodeTransparent(parent, factory);
    const node = new TreeNodeTransparent(proto);

    expect(() => node.instantiate()).toThrow(InjectionError);
  });

  it("should handle optional dependencies", () => {
    const depToken = new NodeToken<string>("dep");
    const token = new NodeToken<string>("test");
    const parent = new ProtoNodeSingle(token);
    const proto = new ProtoNodeTransparent(parent, () => {
      const dep = nodeInject(depToken, { optional: true });
      return dep ? dep : "value";
    });
    const node = new TreeNodeTransparent(proto);

    node.instantiate();
    expect(node.instance).toBe("value");
  });

  it("should throw when accessing instance before instantiation", () => {
    const token = new NodeToken<string>("test");
    const parent = new ProtoNodeSingle(token);
    const proto = new ProtoNodeTransparent(parent, () => "value");
    const node = new TreeNodeTransparent(proto);

    expect(() => node.instance).toThrow(InjectionError);
  });
});

describe("TreeNodeMulti", () => {
  it("should collect instances from different node types", () => {
    const token = new MultiNodeToken<string>("multi");
    const proto = new ProtoNodeMulti(token);
    const node = new TreeNodeMulti(proto);

    const singleToken = new NodeToken<string>("single");
    const singleProto = new ProtoNodeSingle(singleToken, () => "single-value");
    const singleNode = new TreeNodeSingle(singleProto);

    const parent = new ProtoNodeSingle(new NodeToken<string>("parent"));
    const transProto = new ProtoNodeTransparent(parent, () => "transparent-value");
    const transNode = new TreeNodeTransparent(transProto);

    const subMultiToken = new MultiNodeToken<string>("sub-multi");
    const subMultiProto = new ProtoNodeMulti(subMultiToken);
    const subMultiNode = new TreeNodeMulti(subMultiProto);
    const subToken = new NodeToken<string>("sub");
    const subProto = new ProtoNodeSingle(subToken, () => "sub-value");
    const subNode = new TreeNodeSingle(subProto);
    subMultiNode.addDependency(subNode);
    subMultiNode.instantiate();

    node.addDependency(singleNode, transNode, subMultiNode);
    node.instantiate();

    expect(node.instance).toEqual(["single-value", "transparent-value", "sub-value"]);
  });
});

describe("toString methods", () => {
  it("TreeRootNode toString", () => {
    const node = new TreeRootNode();
    expect(node.toString()).toBe("TreeRootNode");
  });

  it("TreeNodeSingle toString", () => {
    const token = new NodeToken("test");
    const proto = new ProtoNodeSingle(token);
    const node = new TreeNodeSingle(proto);
    expect(node.toString()).toBe(`TreeNodeSingle<${token.toString()}>`);
  });

  it("TreeNodeTransparent toString", () => {
    const token = new NodeToken("test");
    const parent = new ProtoNodeSingle(token);
    const factory = function testFactory() {};
    const proto = new ProtoNodeTransparent(parent, factory);
    const node = new TreeNodeTransparent(proto);
    expect(node.toString()).toBe(`TreeNodeTransparent<${token.toString()}>`);
  });

  it("TreeNodeMulti toString", () => {
    const token = new MultiNodeToken("test");
    const proto = new ProtoNodeMulti(token);
    const node = new TreeNodeMulti(proto);
    expect(node.toString()).toBe(`TreeNodeMulti<${token.toString()}>`);
  });

  it("ProtoNodeSingle toString", () => {
    const token = new NodeToken("test");
    const proto = new ProtoNodeSingle(token);
    expect(proto.toString()).toBe(`ProtoNodeSingle<${token.toString()}>`);
  });

  it("ProtoNodeTransparent toString", () => {
    const token = new NodeToken("test");
    const parent = new ProtoNodeSingle(token);
    const factory = function testFactory() {};
    const proto = new ProtoNodeTransparent(parent, factory);
    expect(proto.toString()).toBe("ProtoNodeTransparent<testFactory>");
  });

  it("ProtoNodeTransparent toString with anonymous factory", () => {
    const token = new NodeToken("test");
    const parent = new ProtoNodeSingle(token);
    const proto = new ProtoNodeTransparent(parent, () => {});
    expect(proto.toString()).toBe("ProtoNodeTransparent<anonymous>");
  });

  it("ProtoNodeMulti toString", () => {
    const token = new MultiNodeToken("test");
    const proto = new ProtoNodeMulti(token);
    expect(proto.toString()).toBe(`ProtoNodeMulti<${token.toString()}>`);
  });
});

describe("ProtoNode helpers", () => {
  it("should check if factory exists", () => {
    const token = new NodeToken("test");
    const proto = new ProtoNodeSingle(token);
    expect(proto.hasFactory()).toBe(false);
    proto.setFactory(() => "value");
    expect(proto.hasFactory()).toBe(true);
  });

  it("should check if proto is not transparent", () => {
    const token = new NodeToken("test");
    const single = new ProtoNodeSingle(token);
    const multi = new MultiNodeToken("multi");
    const multiProto = new ProtoNodeMulti(multi);
    const transparent = new ProtoNodeTransparent(single, () => "value");

    expect(isNotTransparentProto(single)).toBe(true);
    expect(isNotTransparentProto(multiProto)).toBe(true);
    expect(isNotTransparentProto(transparent)).toBe(false);
  });
});

describe("Extra Coverage", () => {
  it("should inject transparent node instance when requesting parent token", () => {
    const parentToken = new NodeToken<string>("parent");
    const parentProto = new ProtoNodeSingle(parentToken);
    const transparentProto = new ProtoNodeTransparent(parentProto, () => "transparent");
    const transparentNode = new TreeNodeTransparent(transparentProto);

    const consumerToken = new NodeToken<string>("consumer");
    const consumerProto = new ProtoNodeSingle(consumerToken, () => {
      return nodeInject(parentToken);
    });
    const consumerNode = new TreeNodeSingle(consumerProto);

    // Manually link dependency
    consumerNode.addDependency(transparentNode);

    // Instantiate transparent node first
    transparentNode.instantiate();

    consumerNode.instantiate();
    expect(consumerNode.instance).toBe("transparent");
  });

  it("should throw untracked error if injection is hidden during scan", () => {
    const token = new NodeToken("test");
    const depToken = new NodeToken("dep");

    let showDep = false;
    const factory = () => {
      if (showDep) {
        nodeInject(depToken);
      }
      return "value";
    };

    const proto = new ProtoNodeSingle(token, factory);
    // Scan happens in constructor. showDep is false. depToken NOT detected.

    const node = new TreeNodeSingle(proto);

    showDep = true;
    // Instantiate calls factory. showDep is true. nodeInject called.
    // Should throw untracked.

    expect(() => node.instantiate()).toThrow(InjectionError.untracked(depToken, token));
  });

  it("should expose dependencies", () => {
    const root = new TreeRootNode();
    const token = new NodeToken("test");
    const proto = new ProtoNodeSingle(token, () => "val");
    const node = new TreeNodeSingle(proto);
    root.addDependency(node);
    expect(root.dependencies.has(node)).toBe(true);
  });

  it("should handle transparent node in TreeRootNode", () => {
    const root = new TreeRootNode();
    const parentToken = new NodeToken("parent");
    const parentProto = new ProtoNodeSingle(parentToken);
    const transProto = new ProtoNodeTransparent(parentProto, () => "trans");
    const transNode = new TreeNodeTransparent(transProto);

    root.addDependency(transNode);
    root.build();

    expect(transNode.instance).toBe("trans");
  });
});
