# Chipmunk CLI Context

## Overview

`crates/chipmunk-cli` is the terminal interface for connecting sources, parsing logs, and exporting output.
It orchestrates core runtime crates and owns CLI argument parsing and output formatting.

## Start Here

1. `crates/chipmunk-cli/Cargo.toml`
2. `crates/chipmunk-cli/src/main.rs`
3. `crates/chipmunk-cli/src/cli_args/`
4. `crates/chipmunk-cli/src/session/`
5. `crates/chipmunk-cli/src/session/format/`
6. `.ai/knowledge/crates/core/AGENTS.md`

## If You Need X, Go to Y

- Change command syntax/options: `crates/chipmunk-cli/src/cli_args/`.
- Change ingestion/parsing runtime behavior: `crates/chipmunk-cli/src/session/` and underlying core crates.
- Change output formatting: `crates/chipmunk-cli/src/session/format/`.
- Change parser-specific CLI behavior: `crates/chipmunk-cli/src/session/parser/`.
- Debug parser/source compatibility from CLI path: trace CLI args -> session wiring -> core source/parser setup.

## Cross-Module Dependency Map

- CLI orchestrates core capabilities for terminal use.
- Output format logic is local to `crates/chipmunk-cli`.
- Parsing, ingestion, and source behavior are rooted in `crates/core`.

## Landmarks and Hotspots

- Hierarchical `clap` command structure in `crates/chipmunk-cli/src/cli_args/`.
- Session flow that wires parser/source/output in `crates/chipmunk-cli/src/session/`.
- Binary and text output formatting under `crates/chipmunk-cli/src/session/format/`.
- Connection behavior in source-related paths.

## Validation

Run validation only when requested or needed to verify a change.
Use targeted Cargo commands from the repository root, for example:

- Check: `cargo check -p chipmunk-cli`
- Test: `cargo test -p chipmunk-cli`
- Lint: `cargo clippy -p chipmunk-cli`
- Install: `cargo install --path crates/chipmunk-cli`
