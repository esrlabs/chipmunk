# Shared Types Context

## Overview

`crates/stypes` is the source of truth for Rust data structures shared by the native app, core runtime crates, CLI, and plugin-facing flows.
Treat changes here as cross-crate API changes.

## Start Here

1. `crates/stypes/Cargo.toml`
2. `crates/stypes/src/lib.rs`
3. `crates/stypes/src/command/`
4. `crates/stypes/src/callback/`
5. `crates/stypes/src/plugins/`
6. `crates/stypes/src/error/`

## If You Need X, Go to Y

- Add or modify command/config types: `crates/stypes/src/command/`.
- Add or modify callback/result payloads: `crates/stypes/src/callback/`.
- Change progress reporting types: `crates/stypes/src/progress/`.
- Change plugin-facing metadata/config/result types: `crates/stypes/src/plugins/`.
- Change observe/session source types: `crates/stypes/src/observe/`.
- Change attachment types: `crates/stypes/src/attachment/`.
- Change operation identifiers or operation payloads: `crates/stypes/src/operations/`.
- Change shared error types or formatting: `crates/stypes/src/error/`.
- Change folder/profile utility command types: `crates/stypes/src/command/folders/`, `crates/stypes/src/command/profiles/`.

## Coding Guidelines

- Keep shared types focused on domain contracts, not UI-specific state.
- Preserve serialization behavior deliberately; `serde` shape changes can affect persisted data and cross-crate messages.
- Prefer adding domain-specific types over passing loosely structured strings or maps across crate boundaries.
- Keep conversion and extension helpers near the type they belong to.
- Update call sites in `crates/app`, `crates/core`, and `crates/cli` when changing public types.

## Technology Stack

- `serde` for Rust serialization.
- `uuid`, `dlt-core`, `walkdir`, and core Rust types for shared data models.

## Validation

Run validation only when requested or needed to verify a change.
Use targeted Cargo commands from the repository root, for example:

- Check: `cargo check -p stypes`
- Test dependents when public contracts change, usually the directly affected `app`, `session`, `processor`, or `cli` crate.
