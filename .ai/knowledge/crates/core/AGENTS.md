# Core Runtime Context

## Overview

The core crates under `crates/core/` implement parsing, ingestion, indexing, search, merging, exports, source handling, and plugin execution.
The native app and CLI depend on these crates directly through Rust APIs.

## Start Here

1. `crates/core/session/src/`
2. `crates/core/processor/src/`
3. `crates/core/sources/src/`
4. `crates/core/parsers/src/`
5. `crates/stypes/src/`

## Crate Map

- `session`: API boundary for live sessions, operations, observing, search, exports, attachments, and unbound utility commands.
- `processor`: ingestion/search pipeline; `MessageProducer` coordinates `ByteSource` and `Parser` implementations.
- `sources`: byte ingestion from files, TCP, UDP, serial, processes, and pcap inputs.
- `parsers`: DLT, SOME/IP, text, and plugin parser integration.
- `indexer_base`: shared chunk, time, progress, and indexing primitives.
- `plugins_host`: runtime support for loading and executing WASM plugins.
- `merging`: multi-source chronological merge logic.
- `dlt_tools`: DLT-specific utility operations.
- `someip_tools`: SOME/IP-specific parsing helpers.
- `text_grep`: text search helpers used by processor search paths.

## If You Need X, Go to Y

- Change app/backend coordination: `crates/core/session/src/`.
- Add or modify session operations: `crates/core/session/src/handlers/`, `crates/core/session/src/unbound/commands/`, and `crates/stypes/src/operations/`.
- Add or modify ingestion sources: `crates/core/sources/src/` and `crates/core/processor/src/producer/`.
- Add or modify parser formats: `crates/core/parsers/src/` and `crates/core/processor/src/`.
- Change search/filter behavior: `crates/core/processor/src/search/` and `crates/core/session/src/state/searchers/`.
- Change search value extraction/chart values: `crates/core/session/src/state/values/` and `crates/core/processor/src/search/`.
- Adjust random-access/file-windowing: `crates/core/processor/src/grabber/` and `crates/core/indexer_base/src/`.
- Change observing/tailing behavior: `crates/core/session/src/handlers/observe.rs`, `crates/core/session/src/handlers/observing/`, and `crates/core/session/src/tail/`.
- Change plugin runtime/lifecycle: `crates/core/plugins_host/src/`.
- Change plugin contracts or package artifacts: `.ai/knowledge/plugins/AGENTS.md`.
- Add or change shared data types: `.ai/knowledge/crates/stypes/AGENTS.md`.
- Investigate pipeline failures: start in `crates/core/processor/src/producer/`.

## Cross-Crate Flow

- App/CLI request setup produces source and parser configuration from `stypes` types.
- `session` owns operation state and coordinates processor work for live sessions.
- `processor` reads bytes from `sources`, parses them with `parsers` or plugin-backed parsers, indexes chunks, and serves search/grab/export paths.
- `plugins_host` loads plugin components and adapts them into parser/source flows.
- `stypes` carries shared command, callback, progress, plugin, observe, and error types across crate boundaries.

## Landmarks and Hotspots

- `MessageProducer` in `crates/core/processor/src/producer/` for pipeline orchestration.
- `Session` APIs in `crates/core/session/src/session.rs` for frontend/backend coordination.
- Operation handlers in `crates/core/session/src/handlers/`.
- State controllers under `crates/core/session/src/state/`.
- `TimedLine` and chunk/progress types in `crates/core/indexer_base/src/`.
- `PluginsManager` and plugin host wrappers in `crates/core/plugins_host/src/`.
- Pcap handling under `crates/core/sources/src/binary/pcap/`.

## Testing Notes

- Snapshot tests live under `crates/core/session/tests/snapshot_tests/` and use `insta`.
- Property-style tests use `proptest`.
- Processor benchmarks and mocks live under `crates/core/processor/benches/`.

## Validation

Run validation only when requested or needed to verify a change.
Use targeted Cargo commands from the repository root, for example:

- Check one crate: `cargo check -p <crate>`
- Test one crate: `cargo test -p <crate>`
- Lint one crate: `cargo clippy -p <crate>`
