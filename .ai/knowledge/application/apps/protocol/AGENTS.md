# Protocol WASM Context

## Overview

`protocol` is the WASM encode/decode bridge around shared `stypes`, used by Node/Electron/TypeScript layers.

## Start Here (First Files to Open)

1. `application/apps/protocol/Cargo.toml`
2. `application/apps/protocol/src/lib.rs`
3. `application/apps/protocol/src/generate.rs`
4. `application/apps/protocol/src/err.rs`
5. `application/apps/protocol/test.sh`
6. `.ai/knowledge/application/apps/indexer/stypes/AGENTS.md`
7. `application/apps/rustcore/ts-bindings/spec/session.protocol.spec.ts`

## If You Need X, Go to Y

- Expose a new shared message type: `application/apps/protocol/src/lib.rs` macro invocations.
- Change encode/decode wrapper generation: `application/apps/protocol/src/generate.rs` (`gen_encode_decode_fns!`).
- Investigate WASM boundary errors: `application/apps/protocol/src/err.rs` and caller expectations in `application/apps/rustcore/ts-bindings`.
- Validate protocol compatibility: run `cargo chipmunk test protocol -u print` and inspect TS protocol specs.

## Cross-Module Dependency Map

- Upstream schema source: `application/apps/indexer/stypes`.
- Protocol output consumed by `application/apps/rustcore/ts-bindings`.
- Indirectly feeds `application/holder` and `application/client` through TS bindings.

## Landmarks and Hotspots

- `gen_encode_decode_fns!` macro wiring in `application/apps/protocol/src/lib.rs`.
- `serde-wasm-bindgen` conversion boundaries.
- Type additions are high-context because they require synchronized updates across `stypes`, protocol, and TS tests.

## Quick Commands

- Build: `cargo chipmunk build protocol -u print`
- Test: `cargo chipmunk test protocol -u print`
- Lint: `cargo chipmunk lint protocol -u print`

## Additional Notes (Not Default Workflow)

- `application/apps/protocol/test.sh` can run property-test-heavy paths and may take significantly longer than typical target tests.
