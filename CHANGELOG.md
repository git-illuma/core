# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- `iNodeTokenBaseOptions.global` — opt-in token-instance deduplication by name via
  a `globalThis` registry (mirrors the existing token-class dedup). Identically-named
  global tokens constructed in separately-bundled modules resolve to the same instance,
  so the container (which keys providers by reference) treats them as one. Enables a
  dynamically-imported plugin to bind a host's seam tokens without sharing a bundle.

### Changed

- The three remaining raw `throw new Error` sites now throw a typed `InjectionError`
  carrying a stable code, matching the rest of the library: a global-token kind conflict
  (`i600`), a middleware calling `next()` more than once (`i700`), and the internal
  unknown-`ProtoNode` invariant (`i800`). Messages are unchanged apart from the `[iNNN]`
  prefix, and callers can now branch on `error.code` for these cases.

### Fixed

- Tree-node resolution no longer leaves a node stranded as "in progress" when a factory
  or dependency throws. A failed resolution now resets its guard on every exit path, so a
  retried `get()` (lazy `instant: false` mode) or another consumer of a shared dependency
  re-runs the factory instead of reporting a bogus circular-dependency (`i401`) error.
  `MultiNodeToken` resolution also resets its members per attempt so a retry cannot
  accumulate duplicates.

### Documentation

- Completed the error reference (`TROUBLESHOOTING.md`): documented `i202`, `i304`, `i305`,
  and the new `i600`/`i700`/`i800` codes across the quick-reference table, table of contents,
  and detail sections; documented the `singleton` and `global` token options in `TOKENS.md`
  and `API.md`.
- Corrected stale examples: plugin imports now use the `@illuma/core/plugins` subpath
  (`Illuma`, `iMiddleware`, the diagnostics types, `iContextScanner`); fixed the `nodeInject`
  signature and `@NodeInjectable()` usage in `TECHNICAL_OVERVIEW.md`, the `iSpectator<T>`
  name and a malformed provider array in `TESTKIT.md`, and a request-scoped `injectGroupAsync`
  example in `ASYNC_INJECTION.md`.

### Fixed

- Tree-node resolution no longer leaves a node stranded as "in progress" when a factory
  or dependency throws. A failed resolution now resets its guard on every exit path, so a
  retried `get()` (lazy `instant: false` mode) or another consumer of a shared dependency
  re-runs the factory instead of reporting a bogus circular-dependency (`i401`) error.
  `MultiNodeToken` resolution also resets its members per attempt so a retry cannot
  accumulate duplicates.

## 2.3.0 - 2026-05-28

## 2.2.0 - 2026-05-10

## 2.1.3 - 2026-04-26

## 2.0.1 - 2026-03-29

## 2.0.0 - 2026-03-28

## 1.6.0 - 2026-02-01

## 1.5.2 - 2026-01-31

## 1.5.1 - 2026-01-11

## 1.5.0 - 2026-01-10

## 1.4.0 - 2026-01-10

## 1.3.1 - 2026-01-10

## 1.3.0 - 2026-01-10

## 1.2.1 - 2026-01-10

## 1.2.0 - 2026-01-10

## 1.1.0 - 2026-01-07
