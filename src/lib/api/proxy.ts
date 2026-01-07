/**
 * @internal
 * An object that can morph into any shape.
 * Used as a placeholder in injections.
 */
// @ts-ignore
export const SHAPE_SHIFTER = new Proxy(() => {}, {
  get: () => SHAPE_SHIFTER,
  apply: () => SHAPE_SHIFTER,
});
