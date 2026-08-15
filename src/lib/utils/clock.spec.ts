import { afterEach, describe, expect, it, vi } from "vitest";
import { NodeContainer } from "../container/container";
import { now } from "./clock";

describe("now()", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("reports a time", () => {
    expect(typeof now()).toBe("number");
    expect(now()).toBeGreaterThan(0);
  });

  it("falls back to Date.now() on an engine without `performance`", async () => {
    vi.stubGlobal("performance", undefined);
    vi.resetModules();

    const { now: fresh } = await import("./clock");

    expect(typeof fresh()).toBe("number");
    expect(fresh()).toBeGreaterThan(0);
  });

  it("lets a container bootstrap without the `performance` global", async () => {
    vi.stubGlobal("performance", undefined);
    vi.resetModules();

    const { NodeContainer: Fresh } = await import("../container/container");

    const container = new Fresh({ measurePerformance: true });
    expect(() => container.bootstrap()).not.toThrow();
    expect(container.bootstrapped).toBe(true);
  });

  it("still uses `performance` when the engine provides it", () => {
    const spy = vi.fn(() => 123.5);
    vi.stubGlobal("performance", { now: spy });

    const container = new NodeContainer();
    container.bootstrap();

    expect(spy).toHaveBeenCalled();
  });
});
