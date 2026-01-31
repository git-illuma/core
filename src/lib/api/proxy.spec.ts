import { describe, expect, it } from "vitest";
import { SHAPE_SHIFTER } from "./proxy";

describe("proxy", () => {
  it("should support infinite chaining", () => {
    expect((SHAPE_SHIFTER as any).foo().bar().hello.baz().world).toBe(SHAPE_SHIFTER);
  });
});
