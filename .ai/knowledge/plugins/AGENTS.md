# Plugins System Context

## Overview

The plugin system extends Chipmunk with sandboxed WASM parser and bytesource components.
The plugin API crate is part of the main Rust workspace, while plugin examples and templates under `plugins/` are intentionally outside the main workspace validation path.

## Start Here

1. `crates/plugins_api/Cargo.toml`
2. `crates/plugins_api/src/`
3. `crates/plugins_api/wit/v0.1.0/`
4. `plugins/examples/rust/`
5. `plugins/templates/rust/parser/`
6. `crates/core/plugins_host/src/`
7. `.ai/knowledge/crates/core/AGENTS.md`

## If You Need X, Go to Y

- Change plugin API traits, exports, or shared helpers: `crates/plugins_api/src/`.
- Change WIT contracts: `crates/plugins_api/wit/v0.1.0/`.
- Implement a Rust parser plugin: start from `plugins/templates/rust/parser/` or `plugins/examples/rust/` using `plugins_api` and `parser_export!`.
- Implement a Rust bytesource plugin: follow `plugins/examples/rust/file_source/` using `plugins_api` and `bytesource_export!`.
- Implement C/C++ plugin bindings: generate headers from `crates/plugins_api/wit/v0.1.0/` via `wit-bindgen`.
- Debug load/runtime issues: inspect plugin component artifacts plus host-side logic in `crates/core/plugins_host/src/`.
- Verify install/discovery behavior: plugin output layout under `~/.chipmunk/plugins/...`.
- Change plugin UI behavior: `crates/chipmunk-app/src/host/ui/plugin_manager/` and `crates/chipmunk-app/src/host/service/plugin/`.

## Cross-Module Dependency Map

- Contracts and export macros are authored in `crates/plugins_api`.
- Examples and templates live under `plugins/` and are built separately from the main workspace.
- Runtime loading/execution is handled by `crates/core/plugins_host` via `wasmtime`.
- Plugin outputs feed core ingestion/parsing pipelines.
- The native app owns plugin management UI and service coordination.

## Landmarks and Hotspots

- WIT interface definitions under `crates/plugins_api/wit/v0.1.0/` and generated bindings.
- Export macros: `parser_export!`, `bytesource_export!`.
- WASM Component Model and WASI boundaries.
- Memory ownership rules for incoming/outgoing buffers.
- Plugin cache, validation, and discovery in `crates/core/plugins_host/src/plugins_manager/`.

## Technology Stack

- Runtime: `wasmtime`
- Interface: WIT
- Model: WASM Component Model
- Resource access: WASI

## Build and Installation

- Build a Rust component from the plugin crate directory: `cargo component build -r`
- Install parser plugin: `~/.chipmunk/plugins/parsers/<plugin_name>/`
- Install bytesource plugin: `~/.chipmunk/plugins/bytesources/<plugin_name>/`

## Validation

Run validation only when requested or needed to verify a change.
Use targeted commands for the area changed:

- Main workspace plugin API: `cargo test -p plugins_api`
- Plugin host runtime: `cargo test -p plugins_host`
- Plugin examples/templates under `plugins/`: run commands from the specific plugin crate directory.
