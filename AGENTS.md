# Chipmunk Project Index

## Overview
Chipmunk is a high-performance log analysis tool. This file is a repo navigation hub; local `AGENTS.md` files contain module-specific context.

## Start Here (Repo Orientation)

1. `AGENTS.md` (this file)
2. `cli/development-cli/AGENTS.md` (`cargo chipmunk` task orchestration)
3. `application/apps/indexer/AGENTS.md` (Rust core)
4. `application/platform/AGENTS.md` (shared TS contracts)
5. `application/holder/AGENTS.md` (desktop host flow)
6. `application/client/AGENTS.md` (desktop application client)

## Architecture & Directory Map

- `application/`: Core application logic.
  - [`application/apps/indexer/`](./application/apps/indexer/AGENTS.md): Rust backend core (parsing, search, ingestion).
  - [`application/apps/protocol/`](./application/apps/protocol/AGENTS.md): WASM encoding/decoding for shared types.
  - `application/apps/rustcore/`: Rust/TypeScript bridge layers.
    - [`application/apps/rustcore/rs-bindings/`](./application/apps/rustcore/rs-bindings/AGENTS.md): Native Node addon boundary.
    - [`application/apps/rustcore/ts-bindings/`](./application/apps/rustcore/ts-bindings/AGENTS.md): TS wrapper API over native bindings.
    - [`application/apps/rustcore/wasm-bindings/`](./application/apps/rustcore/wasm-bindings/AGENTS.md): Frontend-focused WASM utilities.
  - [`application/client/`](./application/client/AGENTS.md): Angular UI.
  - [`application/holder/`](./application/holder/AGENTS.md): Electron host process.
  - [`application/platform/`](./application/platform/AGENTS.md): Shared IPC/types/logging/env.
- `cli/`: Command-line tools.
  - [`cli/chipmunk-cli/`](./cli/chipmunk-cli/AGENTS.md): User-facing parser/export CLI.
  - [`cli/development-cli/`](./cli/development-cli/AGENTS.md): `cargo chipmunk` developer orchestrator.
- [`plugins/`](./plugins/AGENTS.md): WASM plugin contracts and runtime-facing model.
- `docs/`: Architecture guides and contributor docs.

## If You Need X, Go to Y

- Build/test/lint any major target: `cli/development-cli` via `cargo chipmunk`.
- Core parsing/search/ingestion behavior: `application/apps/indexer`.
- Shared Rust <-> TypeScript message contract: `application/apps/indexer/stypes`.
- Message encoding/decoding bridge: `application/apps/protocol`.
- Native FFI boundary to Node/Electron: `application/apps/rustcore/rs-bindings`.
- Promise-based TS API used by app/client: `application/apps/rustcore/ts-bindings`.
- Browser-side WASM utilities (fuzzy/ANSI/filter validation): `application/apps/rustcore/wasm-bindings`.
- Electron lifecycle and IPC forwarding: `application/holder`.
- Angular views/services: `application/client`.
- Shared TS IPC/types/env/logging: `application/platform`.
- Extensible parser/bytesource components: `plugins/`.

## Cross-Module Dependency Map

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

## Landmarks and Hotspots

- `MessageProducer` and search/grabber paths in `application/apps/indexer` are performance-sensitive.
- `application/apps/indexer/stypes` changes can cascade into protocol, bindings, and platform types.
- FFI boundary (`application/apps/indexer/session` -> `application/apps/rustcore/rs-bindings` -> `application/apps/rustcore/ts-bindings`) is high-context and regression-prone.
- Plugin runtime and contracts (`plugins/` + `application/apps/indexer/plugins_host`) need contract/runtime alignment.
