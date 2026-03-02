# Chipmunk CLI Context

## Overview
`chipmunk-cli` is the user-facing CLI for connecting sources, parsing logs, and exporting output.

## Start Here (First Files to Open)

1. `cli/chipmunk-cli/Cargo.toml`
2. `cli/chipmunk-cli/src/main.rs`
3. `cli/chipmunk-cli/src/cli_args/`
4. `cli/chipmunk-cli/src/session/`
5. `cli/chipmunk-cli/src/session/format/`
6. `.ai/application/apps/indexer/AGENTS.md`

## If You Need X, Go to Y

- Change command syntax/options: `cli/chipmunk-cli/src/cli_args/`.
- Change ingestion/parsing runtime behavior: `cli/chipmunk-cli/src/session/` and underlying indexer interactions.
- Change output formatting: `cli/chipmunk-cli/src/session/format/`.
- Debug parser/source compatibility from CLI path: trace CLI args -> session wiring -> indexer source/parser.

## Cross-Module Dependency Map

- CLI orchestrates indexer capabilities for terminal use.
- Output format logic is local, while parsing/ingestion logic is rooted in core indexer crates.

## Landmarks and Hotspots

- Hierarchical `clap` command structure in `cli/chipmunk-cli/src/cli_args/`.
- Session flow that wires parser/source/output.
- Connection resilience behavior (reconnect/keepalive) in source-related paths.

## Development

- Target: `cli-chipmunk`
- Build: `cargo build`
- Test: `cargo test`
- Lint: `cargo clippy`
- Install: `cargo install --path cli/chipmunk-cli`

## Usage Example

```bash
chipmunk-cli -o logs.dlt -f binary dlt -f file1.xml tcp 127.0.0.1:7777 -m 1000
```
