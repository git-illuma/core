import { getInjectableToken, isInjectable } from "../api/decorator";
import type { NodeBase } from "../api/token";
import { MultiNodeToken, NodeToken } from "../api/token";
import { InjectionError } from "../errors";
import type { ProtoNode } from "./proto";
import {
  isNotTransparentProto,
  ProtoNodeMulti,
  ProtoNodeSingle,
  ProtoNodeTransparent,
} from "./proto";
import type { TreeNode } from "./tree-node";
import { TreeNodeMulti, TreeNodeSingle, TreeNodeTransparent } from "./tree-node";
import type { Token } from "./types";

export type UpstreamGetter = <T>(token: Token<T>) => TreeNode<T> | null;
interface StackFrame {
  readonly proto: ProtoNode;
  readonly node: TreeNode;
  processed: boolean;
}

function createTreeNode(p: ProtoNode): TreeNode {
  if (p instanceof ProtoNodeSingle) return new TreeNodeSingle(p);
  if (p instanceof ProtoNodeMulti) return new TreeNodeMulti(p);
  if (p instanceof ProtoNodeTransparent) return new TreeNodeTransparent(p);
  throw new Error("Unknown ProtoNode type");
}

export function resolveTreeNode<T>(
  rootProto: ProtoNode<T>,
  cache: Map<ProtoNode, TreeNode>,
  singleNodes: Map<NodeToken<any>, ProtoNodeSingle>,
  multiNodes: Map<MultiNodeToken<any>, ProtoNodeMulti>,
  upstreamGetter?: UpstreamGetter,
): TreeNode<T> {
  const inCache = cache.get(rootProto);
  if (inCache) return inCache;

  const rootNode = createTreeNode(rootProto);

  const stack: StackFrame[] = [{ proto: rootProto, node: rootNode, processed: false }];
  const visiting = new Set<ProtoNode>();

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    const { proto, node } = frame;

    if (frame.processed) {
      stack.pop();
      visiting.delete(proto);
      cache.set(proto, node);
      continue;
    }

    if (visiting.has(proto) && isNotTransparentProto(proto)) {
      const path = stack.map((f) => f.proto).filter((p) => isNotTransparentProto(p));
      const index = path.indexOf(proto);
      const cycle = path.slice(index);
      const cycleTokens = cycle.map((p) => p.token);
      throw InjectionError.circularDependency(proto.token, cycleTokens);
    }

    visiting.add(proto);
    frame.processed = true;

    const deps: (ProtoNode | TreeNode)[] = [];

    function addDependency(token: Token<any>, optional = false) {
      if (token instanceof NodeToken) {
        const p = singleNodes.get(token);
        if (p) {
          deps.push(p);
          return;
        }
      } else if (token instanceof MultiNodeToken) {
        const p = multiNodes.get(token);
        if (p) {
          deps.push(p);
          return;
        }
      }

      const upstream = upstreamGetter?.(token);
      if (upstream) {
        deps.push(upstream);
        return;
      }

      if (!optional) {
        if (token instanceof MultiNodeToken) return;
        if (isInjectable(token)) {
          const nodeToken = getInjectableToken(token);
          throw InjectionError.notFound(nodeToken);
        }

        throw InjectionError.notFound(token as NodeBase<any>);
      }
    }

    if (proto instanceof ProtoNodeSingle || proto instanceof ProtoNodeTransparent) {
      for (const injection of proto.injections) {
        addDependency(injection.token, injection.optional);
      }
    }

    if (proto instanceof ProtoNodeMulti) {
      const parentNodes = upstreamGetter?.(proto.token);
      if (parentNodes instanceof TreeNodeMulti) {
        node.addDependency(parentNodes);
      }

      for (const single of proto.singleNodes) {
        let p = singleNodes.get(single);
        if (!p) {
          p = new ProtoNodeSingle(single);
          singleNodes.set(single, p);
        }

        deps.push(p);
      }

      for (const multi of proto.multiNodes) {
        let p = multiNodes.get(multi);
        if (!p) {
          p = new ProtoNodeMulti(multi);
          multiNodes.set(multi, p);
        }
        deps.push(p);
      }

      for (const transparent of proto.transparentNodes) {
        deps.push(transparent);
      }
    }

    for (const dep of deps) {
      if (
        dep instanceof TreeNodeSingle ||
        dep instanceof TreeNodeMulti ||
        dep instanceof TreeNodeTransparent
      ) {
        node.addDependency(dep);
        continue;
      }

      const depProto = dep as ProtoNode;

      const cached = cache.get(depProto);
      if (cached) {
        node.addDependency(cached);
        continue;
      }

      if (visiting.has(depProto) && isNotTransparentProto(depProto)) {
        const path = stack.map((f) => f.proto).filter((p) => isNotTransparentProto(p));
        const index = path.indexOf(depProto);
        const cycle = [...path.slice(index), depProto];
        const cycleTokens = cycle.map((p) => p.token);

        throw InjectionError.circularDependency(depProto.token, cycleTokens);
      }

      const childNode = createTreeNode(depProto);
      node.addDependency(childNode);
      stack.push({ proto: depProto, node: childNode, processed: false });
    }
  }

  return rootNode;
}
