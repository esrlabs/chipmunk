# Chipmunk CLI Context

## Overview

`crates/cli` is the terminal interface for connecting sources, parsing logs, and exporting output.
It orchestrates core runtime crates and owns CLI argument parsing and output formatting.

## Start Here

1. `crates/cli/Cargo.toml`
2. `crates/cli/src/main.rs`
3. `crates/cli/src/cli_args/`
4. `crates/cli/src/session/`
5. `crates/cli/src/session/format/`
6. `.ai/knowledge/crates/core/AGENTS.md`

## If You Need X, Go to Y

- Change command syntax/options: `crates/cli/src/cli_args/`.
- Change ingestion/parsing runtime behavior: `crates/cli/src/session/` and underlying core crates.
- Change output formatting: `crates/cli/src/session/format/`.
- Change preset document loading: `crates/cli/src/preset/`; its fixtures live in `development/resources/presets/` and are shared with the GUI importer tests.
- Change preset filtering of written records: `crates/cli/src/session/format/text.rs`, which drops messages rejected by the preset filter.
- Change output writing, flushing or message counters: `crates/cli/src/session/writer.rs`.
- Change parser-specific CLI behavior: `crates/cli/src/session/parser/`.
- Debug parser/source compatibility from CLI path: trace CLI args -> session wiring -> core source/parser setup.

## Cross-Module Dependency Map

- CLI orchestrates core capabilities for terminal use.
- Output format logic is local to `crates/cli`.
- Parsing, ingestion, and source behavior are rooted in `crates/core`.

## Landmarks and Hotspots

- Hierarchical `clap` command structure in `crates/cli/src/cli_args/`.
- Session flow that wires parser/source/output in `crates/cli/src/session/`.
- Binary and text output formatting under `crates/cli/src/session/format/`.
- `MessageWriter` in `crates/cli/src/session/writer.rs` owns the output file and the written/filtered-out counters used for progress and summary.
- Connection behavior in source-related paths.

## Validation

Run validation only when requested or needed to verify a change.
Use targeted Cargo commands from the repository root, for example:

- Check: `cargo check -p cli`
- Test: `cargo test -p cli`
- Lint: `cargo clippy -p cli`
- Install: `cargo install --path crates/cli`
