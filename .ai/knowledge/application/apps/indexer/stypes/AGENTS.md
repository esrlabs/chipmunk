# Shared Types (stypes) Context

## Overview

`stypes` is the source of truth for shared data structures used by the Rust core and native GUI.
It also contains legacy TypeScript export support for old Electron/Node surfaces.

## Start Here

1. `application/apps/indexer/stypes/Cargo.toml`
2. `application/apps/indexer/stypes/src/`

## Native Rust Use

- Consumed directly by `application/apps/indexer` crates.
- Consumed directly by the native GUI through Rust dependencies.
- Treat type changes as cross-crate API changes even when they do not affect generated TypeScript.

## If You Need X, Go to Y

- Add or modify a shared type: `application/apps/indexer/stypes/src/`.
- Change serialization behavior: serde/bincode implementations and derives in `application/apps/indexer/stypes/src/`.
- Add robustness coverage for new types: `proptest` tests near the relevant type or module.
- Change TypeScript export shape: legacy `TS` derives/attributes in `application/apps/indexer/stypes/src/`.
- Regenerate legacy TS bindings: `application/apps/indexer/stypes/generate.sh`.

## Legacy TS Export

Use only when explicitly changing TypeScript compatibility or old Electron/Node contracts.

- Source: `application/apps/indexer/stypes/src/`
- Generation script: `application/apps/indexer/stypes/generate.sh`
- Generated output: `application/apps/indexer/stypes/bindings/`
- Protocol bridge: `.ai/knowledge/application/apps/protocol/AGENTS.md`
- Platform copy target: `application/platform/types/`

## Feature Notes

- `rustcore`: enables dependencies used by Rust core/native GUI integration.
- `nodejs`: legacy Node binding support.
- `test_and_gen`: generation/test support.

## Tech Stack

- `serde` and `bincode` for Rust serialization.
- `proptest` for property-based robustness.
- `ts-rs` for legacy TypeScript generation.
