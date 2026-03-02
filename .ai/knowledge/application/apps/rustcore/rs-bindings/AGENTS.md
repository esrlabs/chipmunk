# Rust Bindings (FFI) Context

## Overview

`rs-bindings` is the native Node addon boundary between Rust core (`application/apps/indexer/session`) and Node/Electron.

## Start Here (First Files to Open)

1. `application/apps/rustcore/rs-bindings/Cargo.toml`
2. `application/apps/rustcore/rs-bindings/src/lib.rs`
3. `application/apps/rustcore/rs-bindings/src/js/session/`
4. `application/apps/rustcore/rs-bindings/src/js/jobs/`
5. `application/apps/rustcore/rs-bindings/src/js/converting/`
6. `application/apps/indexer/session/src/`
7. `application/apps/rustcore/ts-bindings/src/`

## If You Need X, Go to Y

- Add or modify session-facing operation: `application/apps/rustcore/rs-bindings/src/js/session/` plus matching `application/apps/indexer/session` API.
- Add static job without active session: `application/apps/rustcore/rs-bindings/src/js/jobs/` (`UnboundJobs` path).
- Debug Node-side lifecycle or callback bridging: `RustSession` flow in `application/apps/rustcore/rs-bindings/src/js/session/`.
- Investigate Rust type translation to JS payloads: conversion paths in `application/apps/rustcore/rs-bindings/src/js/converting/`.

## Cross-Module Dependency Map

- Upstream Rust API comes from `application/apps/indexer/session`.
- Exposes native addon consumed by `application/apps/rustcore/ts-bindings`.
- Downstream UI surfaces are `application/holder` and `application/client` through TS wrappers.

## Landmarks and Hotspots

- `RustSession` lifecycle methods.
- `UnboundJobs` APIs.
- Runtime/thread boundaries (Tokio runtime interaction with Node threads).
- Memory allocator configuration (`tikv-jemallocator`/`mimalloc`) is high-context and global-impact.

## Development

- Target: `binding`
- Build: `cargo chipmunk build binding -u print`
- Lint: `cargo clippy`
