import { describe, expect, it, vi } from "vitest";
import { makeInjectable } from "../api/decorator";
import { nodeInject } from "../api/injection";
import { NodeToken } from "../api/token";
import { NodeContainer } from "../container/container";
import { LifecycleRef } from "../container/lifecycle";
import { Illuma } from "../global/global";

/**
 * Discovering a factory's dependencies means running it, and a dry run executes
 * the body for real. Whatever it sets up outside the container — a subscription
 * to a module-scoped source, a timer, a listener — outlives the throwaway
 * instance, so `beforeDestroy` has to be honoured during the scan as well.
 * It used to resolve to the shape-shifter, which swallowed the registration and
 * left correct code leaking one setup per provider, permanently.
 */
describe("teardown registered while a factory is being scanned", () => {
  it("runs for every construction, including the scan's own", () => {
    let constructed = 0;
    let torn = 0;

    class _Subscriber {
      private readonly _lifecycle = nodeInject(LifecycleRef);

      constructor() {
        constructed++;
        this._lifecycle.beforeDestroy(() => {
          torn++;
        });
      }
    }
    const Subscriber = makeInjectable(_Subscriber);

    const container = new NodeContainer({ instant: false });
    container.provide([Subscriber]);
    container.bootstrap();
    container.get(Subscriber);

    expect(constructed).toBeGreaterThan(1);
    expect(torn).toBe(constructed - 1);

    container.destroy();
    expect(torn).toBe(constructed);
  });

  it("does not wait for the container to be built, let alone destroyed", () => {
    let torn = 0;

    class _Eager {
      private readonly _lifecycle = nodeInject(LifecycleRef);

      constructor() {
        this._lifecycle.beforeDestroy(() => {
          torn++;
        });
      }
    }
    const Eager = makeInjectable(_Eager);

    const container = new NodeContainer({ instant: false });
    container.provide([Eager]);

    // `provide` is what scans, so the scan's own setup is already undone here.
    expect(torn).toBe(1);

    container.destroy();
  });

  it("survives a teardown hook that throws, and says so", () => {
    const error = vi.fn();
    Illuma.setLogger({ log: vi.fn(), warn: vi.fn(), error });

    const TOKEN = new NodeToken<string>("scan-teardown-throws");

    const container = new NodeContainer({ instant: false });
    expect(() =>
      container.provide([
        {
          provide: TOKEN,
          factory: () => {
            nodeInject(LifecycleRef).beforeDestroy(() => {
              throw new Error("teardown boom");
            });
            return "value";
          },
        },
      ]),
    ).not.toThrow();

    container.bootstrap();
    expect(container.get(TOKEN)).toBe("value");

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("teardown hook registered during a dependency scan"),
      expect.any(Error),
    );

    // The real instance registered the same throwing hook, and a container's
    // destroy surfaces it rather than swallowing it. Only the scan's copy is
    // logged, because a scan must never break `provide`.
    expect(() => container.destroy()).toThrow(/teardown boom/);
    Illuma.setLogger(null);
  });

  it("leaves every other token a shape-shifter during the scan", () => {
    const OTHER = new NodeToken<{ ping: () => string }>("scan-other");
    let sawLifecycle: unknown = null;

    class _Reader {
      constructor() {
        sawLifecycle = nodeInject(LifecycleRef);
        // A shape-shifter answers anything without throwing, which is what lets
        // the dry run reach the end of a constructor it cannot really satisfy.
        nodeInject(OTHER).ping();
      }
    }
    const Reader = makeInjectable(_Reader);

    const container = new NodeContainer({ instant: false });
    expect(() => container.provide([Reader])).not.toThrow();
    expect(typeof (sawLifecycle as { beforeDestroy: unknown }).beforeDestroy).toBe(
      "function",
    );

    container.destroy();
  });
});
