# Indexer Rust Core Context

## Overview

Indexer is the Rust backend core for parsing, ingestion, indexing, search, merging, and plugin execution.
The native GUI uses this workspace directly through Rust crates, not through the legacy Node/TS binding path.

## Start Here

1. `application/apps/indexer/Cargo.toml`
2. `application/apps/indexer/session/src/`
3. `application/apps/indexer/processor/src/`
4. `application/apps/indexer/stypes/src/`

## Crate Map

- `session`: Rust API boundary used by the native GUI and legacy bindings.
- `processor`: ingestion/search pipeline; `MessageProducer` coordinates `ByteSource` + `Parser`.
- `sources`: byte ingestion from File/TCP/UDP/Serial/Process/Pcap.
- `parsers`: DLT/SOME-IP/Text parsing.
- `indexer_base`: shared chunk/time/progress primitives.
- `stypes`: shared type source; see `.ai/knowledge/application/apps/indexer/stypes/AGENTS.md` before changing it.
- `plugins_host`: runtime support for loading and executing plugins.
- `merging`: multi-source chronological merge logic.

## If You Need X, Go to Y

- Change native GUI/backend coordination: `application/apps/indexer/session/src/`.
- Add or modify ingestion sources: `application/apps/indexer/sources/src/` and `application/apps/indexer/processor/src/producer/`.
- Add or modify parser formats: `application/apps/indexer/parsers/src/` and `application/apps/indexer/processor/src/`.
- Change search/filter behavior: `application/apps/indexer/processor/src/search/`.
- Adjust random-access/file-windowing: `application/apps/indexer/processor/src/grabber/` and `application/apps/indexer/indexer_base/src/`.
- Change plugin runtime/lifecycle: `application/apps/indexer/plugins_host/src/`.
- Change plugin contracts or package artifacts: `.ai/knowledge/plugins/AGENTS.md`.
- Add or change shared data types: `.ai/knowledge/application/apps/indexer/stypes/AGENTS.md`.
- Investigate pipeline failures: start in `application/apps/indexer/processor/src/producer/`.

## Native GUI Integration

The native GUI crate lives at `application/apps/indexer/gui/application` and depends directly on `session`, `processor`, and `stypes`.
Prefer this Rust-to-Rust flow over the legacy Node/TS binding flow.

## Landmarks and Hotspots

- `MessageProducer` in `processor` for pipeline orchestration.
- `Session` APIs in `session` for frontend/backend coordination.
- `spawn_blocking` boundaries in parse/search-heavy paths.
- `TimedLine` and chunk/progress types in `indexer_base`.
- `PluginsManager` and plugin host wrappers in `plugins_host`.

## Legacy Reference

The old desktop stack consumed this core through `session` -> `rs-bindings` -> `ts-bindings` -> Electron/Angular.
Use those context files only when explicitly comparing behavior or migrating old semantics.

## Validation

Run commands from the repository root:

- Build a crate: `cargo build --manifest-path application/apps/indexer/Cargo.toml -p <crate>`
- Test a crate: `cargo test --manifest-path application/apps/indexer/Cargo.toml -p <crate>`
- Lint a crate: `cargo clippy --manifest-path application/apps/indexer/Cargo.toml -p <crate>`

Testing notes:

- Snapshots use `insta`; set `CI=true` in CI-style runs.
- Property/fuzz-style tests use `proptest`.
