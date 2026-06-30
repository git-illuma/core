/**
 * @internal
 * An object that can morph into any shape.
 * Used as a placeholder in injections.
 */
// @ts-nocheck
export const SHAPE_SHIFTER = new Proxy(() => {}, {
  get: (_target, prop) => {
    if (prop === Symbol.toPrimitive) return () => "";
    return SHAPE_SHIFTER;
  },
  apply: () => SHAPE_SHIFTER,
});
