import type { InjectionNode } from "../../context/node";

/**
 * An extension that can scan a factory function for dependency injections.
 * Should return all detected injection nodes within the factory.
 *
 * It's run after default injection scanning and is meant to detect additional
 * injection patterns (e.g., custom decorators or metadata).
 */
export interface iContextScanner {
  /**
   * Scans the provided factory function for dependency injections.
   *
   * @param factory - The factory function to scan
   * @returns A set of detected injection nodes
   */
  scan(factory: any): Set<InjectionNode<any>>;
}
