# Chipmunk Knowledge Index

## Overview

This is the canonical mapping for repository module context.
All module context files live under `.ai/knowledge/` with a layout mirroring repository paths.

## Start Here

1. `.ai/knowledge/INDEX.md` (this file)
2. `.ai/knowledge/cli/development-cli/AGENTS.md` (`cargo chipmunk` orchestration)
3. `.ai/knowledge/application/apps/indexer/AGENTS.md` (Rust core)
4. `.ai/knowledge/application/apps/indexer/gui/application/AGENTS.md` (native Rust GUI)
5. `.ai/knowledge/application/platform/AGENTS.md` (shared TS contracts)
6. `.ai/knowledge/application/holder/AGENTS.md` (desktop host flow)
7. `.ai/knowledge/application/client/AGENTS.md` (desktop application client)

## Canonical Mapping

| Repo Path | Context File | Primary Responsibility | Depends On |
| :--- | :--- | :--- | :--- |
| `application/apps/indexer` | `.ai/knowledge/application/apps/indexer/AGENTS.md` | Rust backend parsing/ingestion/search core | `.ai/knowledge/application/apps/indexer/stypes/AGENTS.md` |
| `application/apps/indexer/stypes` | `.ai/knowledge/application/apps/indexer/stypes/AGENTS.md` | Rust/TS shared type source of truth | `.ai/knowledge/application/apps/protocol/AGENTS.md`, `.ai/knowledge/application/platform/AGENTS.md` |
| `application/apps/indexer/gui/application` | `.ai/knowledge/application/apps/indexer/gui/application/AGENTS.md` | Native Rust GUI host/session UI for logs, filters, and search | `.ai/knowledge/application/apps/indexer/AGENTS.md`, `.ai/knowledge/application/apps/indexer/stypes/AGENTS.md` |
| `application/apps/protocol` | `.ai/knowledge/application/apps/protocol/AGENTS.md` | WASM encode/decode bridge around `stypes` | `.ai/knowledge/application/apps/indexer/stypes/AGENTS.md` |
| `application/apps/rustcore/rs-bindings` | `.ai/knowledge/application/apps/rustcore/rs-bindings/AGENTS.md` | Native Node addon boundary over Rust `session` | `.ai/knowledge/application/apps/indexer/AGENTS.md` |
| `application/apps/rustcore/ts-bindings` | `.ai/knowledge/application/apps/rustcore/ts-bindings/AGENTS.md` | High-level TS API over native addon/protocol | `.ai/knowledge/application/apps/rustcore/rs-bindings/AGENTS.md`, `.ai/knowledge/application/apps/protocol/AGENTS.md` |
| `application/apps/rustcore/wasm-bindings` | `.ai/knowledge/application/apps/rustcore/wasm-bindings/AGENTS.md` | Browser-focused WASM utilities | `.ai/knowledge/application/client/AGENTS.md` |
| `application/platform` | `.ai/knowledge/application/platform/AGENTS.md` | Shared IPC/types/env/logging for holder/client | `.ai/knowledge/application/client/AGENTS.md`, `.ai/knowledge/application/holder/AGENTS.md` |
| `application/holder` | `.ai/knowledge/application/holder/AGENTS.md` | Electron host lifecycle/windowing/IPC bridge | `.ai/knowledge/application/platform/AGENTS.md`, `.ai/knowledge/application/apps/rustcore/ts-bindings/AGENTS.md` |
| `application/client` | `.ai/knowledge/application/client/AGENTS.md` | Angular UI and feature surfaces | `.ai/knowledge/application/platform/AGENTS.md`, `.ai/knowledge/application/apps/rustcore/ts-bindings/AGENTS.md` |
| `cli/chipmunk-cli` | `.ai/knowledge/cli/chipmunk-cli/AGENTS.md` | User-facing parser/export CLI | `.ai/knowledge/application/apps/indexer/AGENTS.md` |
| `cli/development-cli` | `.ai/knowledge/cli/development-cli/AGENTS.md` | Build/test/lint task orchestrator for all targets | all major target contexts |
| `plugins` | `.ai/knowledge/plugins/AGENTS.md` | WASM plugin contracts and artifacts | `.ai/knowledge/application/apps/indexer/AGENTS.md` |

## Cross-Module Dependency Paths

- Data path: `application/apps/indexer` -> `application/apps/rustcore/rs-bindings` -> `application/apps/rustcore/ts-bindings` -> `application/holder` and `application/client`.
- Native GUI path: `application/apps/indexer` + `application/apps/indexer/stypes` -> `application/apps/indexer/gui/application`.
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
