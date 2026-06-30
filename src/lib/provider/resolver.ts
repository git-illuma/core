import { getInjectableToken, isInjectable } from "../api/decorator";
import type { NodeBase } from "../api/token";
import { MultiNodeToken, NodeToken } from "../api/token";
import type { iNodeInjectorOptions } from "../api/types";
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

function resolveDependency(
  token: Token<any>,
  options: iNodeInjectorOptions | undefined,
  singleNodes: Map<NodeToken<any>, ProtoNodeSingle>,
  multiNodes: Map<MultiNodeToken<any>, ProtoNodeMulti>,
  upstreamGetter?: UpstreamGetter,
): ProtoNode | TreeNode | null {
  const skipSelf = options ? options.skipSelf : false;
  const self = options ? options.self : false;
  const optional = options ? options.optional : false;

  if (!skipSelf) {
    if (token instanceof NodeToken) {
      const p = singleNodes.get(token);
      if (p) return p;
    } else if (token instanceof MultiNodeToken) {
      const p = multiNodes.get(token);
      if (p) return p;
    }
  }

  if (!self) {
    const upstream = upstreamGetter?.(token);
    if (upstream) return upstream;
  }

  if (!skipSelf && token instanceof NodeToken && token.opts?.singleton) {
    const singletonProto = new ProtoNodeSingle(token, token.opts.factory);
    singleNodes.set(token, singletonProto);
    return singletonProto;
  }

  if (!optional) {
    if (token instanceof MultiNodeToken) return null;
    if (isInjectable(token)) {
      const nodeToken = getInjectableToken(token);
      throw InjectionError.notFound(nodeToken);
    }

    throw InjectionError.notFound(token as NodeBase<any>);
  }

  return null;
}

/** @internal */
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
  // Register every node in the dedup cache at creation time so a proto that is
  // queued (pushed but not yet processed) is reused instead of re-created.
  cache.set(rootProto, rootNode);

  const stack: StackFrame[] = [{ proto: rootProto, node: rootNode, processed: false }];
  const visiting = new Set<ProtoNode>();

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    const { proto, node } = frame;

    if (frame.processed) {
      stack.pop();
      visiting.delete(proto);
      continue;
    }

    if (visiting.has(proto) && isNotTransparentProto(proto)) {
      throwCircularDependencyCycle(stack, proto);
    }

    visiting.add(proto);
    frame.processed = true;

    const deps: { dep: ProtoNode | TreeNode; skipSelf: boolean }[] = [];

    if (proto instanceof ProtoNodeSingle || proto instanceof ProtoNodeTransparent) {
      for (const injection of proto.injections) {
        const resolvedDep = resolveDependency(
          injection.token,
          injection,
          singleNodes,
          multiNodes,
          upstreamGetter,
        );

        // Carry the injection's skipSelf so the wired node lands in the right
        // scope: plain and skipSelf injections of one token resolve to different nodes.
        if (resolvedDep) deps.push({ dep: resolvedDep, skipSelf: !!injection.skipSelf });
      }
    }

    if (proto instanceof ProtoNodeMulti) {
      const parentNodes = upstreamGetter?.(proto.token);
      if (parentNodes instanceof TreeNodeMulti && node instanceof TreeNodeMulti) {
        // Record the ancestor's members as the inherited tail (excluded by self:true).
        node.setInherited(parentNodes);
      }

      // Iterate in declaration order so multi members keep their registration
      // order regardless of provider kind (token/alias vs factory/value/class).
      for (const provider of proto.orderedProviders) {
        if (provider instanceof NodeToken) {
          let p = singleNodes.get(provider);
          if (!p) {
            if (provider.opts?.singleton) {
              const rootSingleton = upstreamGetter?.(provider);
              if (rootSingleton) {
                deps.push({ dep: rootSingleton, skipSelf: false });
                continue;
              }
            }

            p = new ProtoNodeSingle(provider);
            singleNodes.set(provider, p);
          }

          deps.push({ dep: p, skipSelf: false });
        } else if (provider instanceof MultiNodeToken) {
          let p = multiNodes.get(provider);
          if (!p) {
            p = new ProtoNodeMulti(provider);
            multiNodes.set(provider, p);
          }
          deps.push({ dep: p, skipSelf: false });
        } else {
          // ProtoNodeTransparent (factory / value / useClass member)
          deps.push({ dep: provider, skipSelf: false });
        }
      }
    }

    for (const { dep, skipSelf } of deps) {
      if (
        dep instanceof TreeNodeSingle ||
        dep instanceof TreeNodeMulti ||
        dep instanceof TreeNodeTransparent
      ) {
        wireDependency(node, dep, skipSelf);
        continue;
      }

      const depProto = dep as ProtoNode;

      // Cycle detection must run BEFORE the dedup lookup: in-progress ancestors
      // on the active DFS path are now present in `cache`, so reusing them first
      // would silently wire a cycle instead of reporting it.
      if (visiting.has(depProto) && isNotTransparentProto(depProto)) {
        throwCircularDependencyCycle(stack, depProto, true);
      }

      const cached = cache.get(depProto);
      if (cached) {
        // A proto-resolved dependency is always plain scope: skipSelf injections
        // resolve to an upstream TreeNode, handled by the branch above.
        wireDependency(node, cached, false);
        continue;
      }

      const childNode = createTreeNode(depProto);
      cache.set(depProto, childNode);
      wireDependency(node, childNode, false);
      stack.push({ proto: depProto, node: childNode, processed: false });
    }
  }

  return rootNode;
}

function createTreeNode(p: ProtoNode): TreeNode {
  if (p instanceof ProtoNodeSingle) return new TreeNodeSingle(p);
  if (p instanceof ProtoNodeMulti) return new TreeNodeMulti(p);
  if (p instanceof ProtoNodeTransparent) return new TreeNodeTransparent(p);
  throw InjectionError.unknownProtoNode();
}

/**
 * Wires `dep` onto `node`, passing the injection scope where it matters. Multi
 * nodes aggregate positionally (no per-token scope); single/transparent nodes
 * slot deps by (token, scope) and take the skipSelf flag.
 */
function wireDependency(node: TreeNode, dep: TreeNode, skipSelf: boolean): void {
  if (node instanceof TreeNodeMulti) node.addDependency(dep);
  else node.addDependency(dep, skipSelf);
}

function throwCircularDependencyCycle(
  stack: StackFrame[],
  depProto: ProtoNodeSingle<any> | ProtoNodeMulti<any>,
  includeCurrent = false,
): never {
  const path = stack.map((f) => f.proto).filter((p) => isNotTransparentProto(p));
  const index = path.indexOf(depProto);
  const cycle = includeCurrent ? [...path.slice(index), depProto] : path.slice(index);
  const cycleTokens = cycle.map((p) => p.token);
  throw InjectionError.circularDependency(depProto.token, cycleTokens);
}
