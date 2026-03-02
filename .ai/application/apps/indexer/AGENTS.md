# Indexer (Rust Core) Context

## Overview

Indexer is the Rust backend core for parsing, ingestion, indexing, search, merging, and plugin execution.

## Start Here (First Files to Open)

1. `application/apps/indexer/Cargo.toml`
2. `application/apps/indexer/processor/src/lib.rs`
3. `application/apps/indexer/processor/src/producer/`
4. `application/apps/indexer/processor/src/search/`
5. `application/apps/indexer/sources/src/`
6. `application/apps/indexer/parsers/src/`
7. `application/apps/indexer/session/src/`
8. `application/apps/indexer/plugins_host/src/`
9. `.ai/application/apps/indexer/stypes/AGENTS.md`
10. `application/apps/indexer/indexer_base/src/`

## Architecture & Crates (Condensed)

- `processor`: ingestion/search pipeline; `MessageProducer` coordinates `ByteSource` + `Parser`.
- `sources`: byte ingestion from File/TCP/UDP/Serial/Process/Pcap.
- `parsers`: DLT/SOME-IP/Text parsing.
- `indexer_base`: shared chunk/time/progress primitives.
- `session`: Rust API boundary consumed by Node bindings.
- `stypes`: Rust/TS shared type source (`ts-rs` generation).
- `plugins_host`: `wasmtime` runtime for parser/bytesource plugins.
- `merging`: multi-source chronological merge logic.

## If You Need X, Go to Y

- Add or modify ingestion sources: `application/apps/indexer/sources/src/` + `application/apps/indexer/processor/src/producer/`.
- Add or modify parser formats: `application/apps/indexer/parsers/src/` + `application/apps/indexer/processor/src/`.
- Change search/filter behavior: `application/apps/indexer/processor/src/search/`.
- Adjust random-access/file-windowing: `application/apps/indexer/processor/src/grabber/` + `application/apps/indexer/indexer_base/src/`.
- Change Node-facing Rust API: `application/apps/indexer/session/src/` then `application/apps/rustcore/rs-bindings`.
- Change plugin runtime/lifecycle: `application/apps/indexer/plugins_host/src/` + `plugins/`.
- Add shared Rust/TS type: `application/apps/indexer/stypes` -> `application/apps/protocol` -> `application/apps/rustcore/ts-bindings` -> `application/platform/types`.
- Investigate pipeline failures: start in `application/apps/indexer/processor/src/producer/`.

## Cross-Module Dependency Map

- Core path: `indexer` -> `application/apps/rustcore/rs-bindings` -> `application/apps/rustcore/ts-bindings` -> `application/holder` / `application/client`.
- Shared type path: `application/apps/indexer/stypes` -> `application/apps/protocol` -> `application/platform/types`.
- Plugin path: `plugins/` contracts/artifacts -> `application/apps/indexer/plugins_host`.

## Landmarks and Hotspots

- `MessageProducer` in `processor` (pipeline orchestration).
- `PluginsManager` and plugin host wrappers in `plugins_host`.
- `Session` APIs in `session` and FFI alignment with bindings.
- `spawn_blocking` boundaries in parse/search-heavy paths.
- `TimedLine` and chunk/progress types in `indexer_base`.
- High-context boundaries:
    - `session` -> `rs-bindings` -> `ts-bindings`
    - `stypes` -> `protocol` -> `platform/types`
    - `plugins_host` runtime contract alignment with `plugins/`

## Generated Artifacts and Source of Truth

- Shared Rust/TS messages:
    - Source: `application/apps/indexer/stypes/src/`
    - Generation: `application/apps/indexer/stypes/generate.sh`
    - Output: `application/apps/indexer/stypes/bindings/`
    - Consumer copy target: `application/platform/types/`

## Development & Tech Stack

- Target: `core`
- Build: `cargo build`
- Test: `cargo test`
- Lint: `cargo clippy`
- Async runtime: `tokio` (`spawn_blocking` for CPU-heavy work)
- Errors: `anyhow` + `thiserror`
- Safety: `undocumented_unsafe_blocks` denied

## Testing

- Snapshots: `insta` (set `CI=true` in CI runs)
- Fuzz/property testing: `proptest`
