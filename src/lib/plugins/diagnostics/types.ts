import type { TreeNode } from "../../provider/tree-node";

export interface iDiagnosticsReport {
  readonly totalNodes: number;
  readonly unusedNodes: TreeNode<unknown>[];
  readonly bootstrapDuration: number;
}

/**
 * A diagnostics module for analyzing and reporting on the state of the dependency injection container.
 * It's called after the container bootstrap to provide insights and diagnostics.
 */
export interface iDiagnosticsModule {
  readonly onReport: (report: iDiagnosticsReport) => void;
}
