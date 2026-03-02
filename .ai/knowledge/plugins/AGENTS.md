# Plugins System Context

## Overview
The plugin system extends Chipmunk with sandboxed WASM parser and bytesource components.

## Start Here (First Files to Open)

1. `plugins/plugins_api/Cargo.toml` (core plugin API crate)
2. `plugins/plugins_api/src/` (parser/bytesource traits, export macros, shared helpers)
3. `plugins/plugins_api/wit/v0.1.0/` (WIT contracts and worlds)
4. `plugins/examples/rust/` and `plugins/templates/rust/parser/` (reference and starter implementations)
4. `application/apps/indexer/plugins_host/src/`
5. `.ai/knowledge/application/apps/indexer/AGENTS.md`

## If You Need X, Go to Y

- Implement a Rust parser plugin: crate based on `plugins/templates/rust/parser/` or `plugins/examples/rust/` using `plugins_api` + `parser_export!`.
- Implement a Rust bytesource plugin: follow `plugins/examples/rust/file_source/` using `plugins_api` + `bytesource_export!`.
- Implement C/C++ plugin bindings: generate headers from `plugins/plugins_api/wit/v0.1.0/` via `wit-bindgen`.
- Debug load/runtime issues: plugin component artifacts plus host-side logic in `application/apps/indexer/plugins_host/`.
- Verify install/discovery behavior: plugin output layout under `~/.chipmunk/plugins/...`.

## Cross-Module Dependency Map

- Contracts/components are authored in `plugins`.
- Runtime loading/execution is handled by `application/apps/indexer/plugins_host` via `wasmtime`.
- Plugin outputs feed indexer ingestion/parsing pipelines.

## Landmarks and Hotspots

- WIT interface definitions under `plugins/plugins_api/wit/v0.1.0/` and generated bindings.
- Export macros: `parser_export!`, `bytesource_export!`.
- WASM component model and WASI boundaries.
- Memory ownership rules (incoming/outgoing buffers) are critical hotspots.

## Technology Stack

- Runtime: `wasmtime`
- Interface: WIT
- Model: WASM Component Model
- Resource access: WASI

## Build and Installation

- Build (Rust component): `cargo component build -r`
- Install parser plugin: `~/.chipmunk/plugins/parsers/<plugin_name>/`
- Install bytesource plugin: `~/.chipmunk/plugins/bytesources/<plugin_name>/`
