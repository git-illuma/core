/**
 * @internal
 * Monotonic-ish timestamp in milliseconds, used only to measure durations.
 *
 * `performance` is a host global rather than an ECMAScript one: it did not
 * become global in Node.js until v16. Reaching for it unguarded would put the
 * library's floor above its own ES2020 syntax for no reason other than
 * diagnostics timing, so fall back to `Date.now()` where it is absent — coarser,
 * but only ever fed into a reported duration.
 *
 * Deliberately not re-exported from `./index`: this is not public API.
 */
export function now(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}
