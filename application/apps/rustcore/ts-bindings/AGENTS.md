# TypeScript Bindings Context

## Overview

`ts-bindings` is the high-level TypeScript API over the native Rust addon, used by Electron holder and Angular client.

## Start Here (First Files to Open)

1. `application/apps/rustcore/ts-bindings/src/api/`
2. `application/apps/rustcore/ts-bindings/src/api/executors/`
3. `application/apps/rustcore/ts-bindings/src/native/`
4. `application/apps/rustcore/ts-bindings/src/services/`
5. `application/apps/rustcore/ts-bindings/spec/`
6. `application/apps/rustcore/rs-bindings/AGENTS.md`
7. `application/apps/protocol/AGENTS.md`

## If You Need X, Go to Y

- Change session flow (`grab`, `search`, filters): `application/apps/rustcore/ts-bindings/src/api/` and related executors.
- Add or modify static utility jobs: `application/apps/rustcore/ts-bindings/src/services/` and provider/native wrappers.
- Adjust progress reporting behavior: `application/apps/rustcore/ts-bindings/src/api/` and `application/apps/rustcore/ts-bindings/src/services/` tracker-related flow.
- Debug binary protocol translation issues: `application/apps/rustcore/ts-bindings/src/native/` and `application/apps/rustcore/ts-bindings/spec/session.protocol.spec.ts`.
- Validate end-to-end behavior with native addon: `application/apps/rustcore/ts-bindings/spec/` tests using Electron runtime.

## Cross-Module Dependency Map

- Consumes native APIs from `rs-bindings`.
- Consumes protocol encoders/decoders from `application/apps/protocol`.
- Provides API used by `application/holder` and `application/client`.

## Landmarks and Hotspots

- `Session`, `SessionStream`, `SessionSearch` classes.
- `CancelablePromise` usage in long-running operations.
- Executor classes for operation-specific orchestration.
- Protocol and addon version drift is a high-context boundary.

## Development & Testing

- Target: `wrapper`
- Build: `cargo chipmunk build wrapper -u print`
- Test: `cargo chipmunk test wrapper -u print`
- Lint: `cargo chipmunk lint wrapper -u print`
- Benchmarks: `application/apps/rustcore/ts-bindings/spec/_session.benchmark.spec.ts`
- Test defaults: `application/apps/rustcore/ts-bindings/spec/defaults.json`
