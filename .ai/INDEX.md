# Chipmunk Agent Context Index

## Overview

This is the canonical entrypoint for repository AI/agent context.
All module context lives under `.ai/` with a layout that mirrors the repo tree.

## Start Here

1. `.ai/INDEX.md` (this file)
2. `.ai/cli/development-cli/AGENTS.md` (`cargo chipmunk` orchestration)
3. `.ai/application/apps/indexer/AGENTS.md` (Rust core)
4. `.ai/application/platform/AGENTS.md` (shared TS contracts)
5. `.ai/application/holder/AGENTS.md` (desktop host flow)
6. `.ai/application/client/AGENTS.md` (desktop application client)

## Canonical Mapping

| Repo Path | Context File | Primary Responsibility | Depends On |
| :--- | :--- | :--- | :--- |
| `application/apps/indexer` | `.ai/application/apps/indexer/AGENTS.md` | Rust backend parsing/ingestion/search core | `.ai/application/apps/indexer/stypes/AGENTS.md` |
| `application/apps/indexer/stypes` | `.ai/application/apps/indexer/stypes/AGENTS.md` | Rust/TS shared type source of truth | `.ai/application/apps/protocol/AGENTS.md`, `.ai/application/platform/AGENTS.md` |
| `application/apps/protocol` | `.ai/application/apps/protocol/AGENTS.md` | WASM encode/decode bridge around `stypes` | `.ai/application/apps/indexer/stypes/AGENTS.md` |
| `application/apps/rustcore/rs-bindings` | `.ai/application/apps/rustcore/rs-bindings/AGENTS.md` | Native Node addon boundary over Rust `session` | `.ai/application/apps/indexer/AGENTS.md` |
| `application/apps/rustcore/ts-bindings` | `.ai/application/apps/rustcore/ts-bindings/AGENTS.md` | High-level TS API over native addon/protocol | `.ai/application/apps/rustcore/rs-bindings/AGENTS.md`, `.ai/application/apps/protocol/AGENTS.md` |
| `application/apps/rustcore/wasm-bindings` | `.ai/application/apps/rustcore/wasm-bindings/AGENTS.md` | Browser-focused WASM utilities | `.ai/application/client/AGENTS.md` |
| `application/platform` | `.ai/application/platform/AGENTS.md` | Shared IPC/types/env/logging for holder/client | `.ai/application/client/AGENTS.md`, `.ai/application/holder/AGENTS.md` |
| `application/holder` | `.ai/application/holder/AGENTS.md` | Electron host lifecycle/windowing/IPC bridge | `.ai/application/platform/AGENTS.md`, `.ai/application/apps/rustcore/ts-bindings/AGENTS.md` |
| `application/client` | `.ai/application/client/AGENTS.md` | Angular UI and feature surfaces | `.ai/application/platform/AGENTS.md`, `.ai/application/apps/rustcore/ts-bindings/AGENTS.md` |
| `cli/chipmunk-cli` | `.ai/cli/chipmunk-cli/AGENTS.md` | User-facing parser/export CLI | `.ai/application/apps/indexer/AGENTS.md` |
| `cli/development-cli` | `.ai/cli/development-cli/AGENTS.md` | Build/test/lint task orchestrator for all targets | all major target contexts |
| `plugins` | `.ai/plugins/AGENTS.md` | WASM plugin contracts and artifacts | `.ai/application/apps/indexer/AGENTS.md` |

## Cross-Module Dependency Paths

- Data path: `application/apps/indexer` -> `application/apps/rustcore/rs-bindings` -> `application/apps/rustcore/ts-bindings` -> `application/holder` and `application/client`.
- Shared type path: `application/apps/indexer/stypes` -> `application/apps/protocol` -> `application/apps/rustcore/ts-bindings` and `application/platform/types`.
- Plugin path: `plugins/` contracts/components -> `application/apps/indexer/plugins_host` runtime execution.
- Orchestration path: `cli/development-cli` drives builds/tests/lints across all targets.

## Development Workflow

Primary entry point:

- Build: `cargo chipmunk build [TARGET] -u print`
- Test: `cargo chipmunk test [TARGET] -u print`
- Lint: `cargo chipmunk lint [TARGET] -u print`

| Component | Target | Path |
| :--- | :--- | :--- |
| Rust Core | `core` | `application/apps/indexer` |
| Angular UI | `client` | `application/client` |
| Electron App | `app` | `application/holder` |
| Shared TS | `shared` | `application/platform` |
| Rust FFI | `binding` | `application/apps/rustcore/rs-bindings` |
| TS Bridge | `wrapper` | `application/apps/rustcore/ts-bindings` |
