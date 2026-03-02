# Shared Types (stypes) Context

## Overview

`stypes` is the source of truth for data structures shared between Rust core and TypeScript surfaces.

## Start Here (First Files to Open)

1. `application/apps/indexer/stypes/Cargo.toml`
2. `application/apps/indexer/stypes/src/`
3. `application/apps/indexer/stypes/generate.sh`
4. `application/apps/indexer/stypes/bindings/`
5. `application/apps/protocol/src/lib.rs`
6. `application/apps/rustcore/ts-bindings/spec/session.protocol.spec.ts`
7. `application/platform/types/`

## If You Need X, Go to Y

- Add or modify a shared type: `application/apps/indexer/stypes/src/`.
- Control TS export shape: Rust derives/attributes (`TS`, `#[ts(export)]`) in `application/apps/indexer/stypes/src/`.
- Regenerate TS bindings: `./generate.sh` in `stypes`.
- Validate encode/decode compatibility: `application/apps/protocol` and `application/apps/rustcore/ts-bindings` protocol specs.
- Update consumed TS contracts: `application/platform/types/`.

## Cross-Module Dependency Map

- Source of truth: `application/apps/indexer/stypes/src/`.
- Consumed directly by Rust indexer crates.
- Exported to TS via generated bindings and via `application/apps/protocol`.
- Downstream consumers include `application/apps/rustcore/ts-bindings`, `application/holder`, `application/client`, and shared `application/platform/types`.

## Landmarks and Hotspots

- `TS` derivations and serde traits on core structs/enums.
- `proptest` coverage for new types and serialization edges.
- Type changes with optional/enum evolution are high-context because they affect protocol and frontend contracts.

## Generated Artifacts and Source of Truth

- Source: `application/apps/indexer/stypes/src/`
- Generation: `application/apps/indexer/stypes/generate.sh`
- Generated output: `application/apps/indexer/stypes/bindings/`
- Consumer copy target: `application/platform/types/`

## Tech Stack

- `ts-rs` for TypeScript derivation.
- `proptest` for property-based robustness.
- `serde` for JSON/Bincode serialization.
