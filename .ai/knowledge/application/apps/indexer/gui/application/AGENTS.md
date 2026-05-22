# Native GUI Application (Rust) Context

## Overview

This crate implements Chipmunk's native desktop GUI using Rust, `egui`, and `eframe`.
It is the primary desktop application surface and integrates directly with the indexer Rust runtime.

## Start Here

1. `application/apps/indexer/gui/application/src/host/ui/`
2. `application/apps/indexer/gui/application/src/session/ui/`
3. `application/apps/indexer/gui/application/src/host/service/`
4. `application/apps/indexer/gui/application/src/session/service/`
5. `application/apps/indexer/gui/application/src/host/ui/state/`
6. `.ai/knowledge/application/apps/indexer/AGENTS.md`
7. `.ai/knowledge/application/apps/indexer/stypes/AGENTS.md`

## If You Need X, Start Here

- App frame loop, tabs, top-level UI state: `src/host/ui/`
- Host async commands, startup, opening sources: `src/host/service/`
- One live session UI: `src/session/ui/`
- Session backend coordination: `src/session/service/`
- Global filters, search values, presets: `src/host/ui/registry/`
- Session-local filters, search, search values: `src/session/ui/shared/searching/`
- Main logs table: `src/session/ui/logs_table/`
- Shared table behavior: `src/session/ui/common/log_table/`
- Side panel session tools: `src/session/ui/side_panel/`
- Bottom panel search/chart/details/presets: `src/session/ui/bottom_panel/`
- Session setup/source/parser forms: `src/host/ui/session_setup/`
- Plugin management and plugin-backed setup: `src/host/service/plugin/`, `src/host/ui/plugin_manager/`
- Export workflows: `src/session/ui/shared/export/`, `src/session/service/export.rs`
- Recent sessions, favorite folders, and service-backed storage: `src/host/ui/storage/`, `src/host/service/storage/`
- Lightweight host UI preferences: `src/host/ui/persist.rs`, `src/host/ui/state/preferences.rs`

## Ownership Model

- UI state structs are the source of truth for native application/UI state.
- Services do not own canonical app/UI state; they only run backend work and copied request data.
- `Host` is the `eframe::App` and owns top-level rendering, message polling, tabs, storage, notifications, and global UI actions.
- `HostState` owns active tabs, open sessions, setup tabs, preferences, shortcuts, app info, top-level modals, plugin UI state, and `HostRegistry`.
- `HostRegistry` owns global filter/search-value definitions and presets.
- `HostStorage` owns UI-facing service-backed storage domains: recent sessions and file explorer/favorite folders.
- `persist` owns only lightweight host UI preferences saved through `eframe` storage.
- `PluginService` owns `PluginsManager`; UI code consumes published `PluginsState` and must not load or mutate plugin runtime state directly.
- `Session` owns one live session UI shell and its component UIs.
- `SessionShared` owns canonical per-session state: applied filters, temp search, search/chart operation state, log selection, bookmarks, observe state, attachments, exports, signals, and view state.
- Component UIs should keep only local render/edit/cache state unless they already own a specific domain.
- Backend/UI integration crosses `HostCommand`/`HostMessage` and `SessionCommand`/`SessionMessage`.

## Coding Guidelines

- Treat egui render paths as hot loops. Do not do expensive parsing, filtering, sorting, validation, formatting, filesystem work, plugin loading, or backend coordination directly in render code. Cache derived data and invalidate it through explicit state changes or revision counters.
- Prefer direct mutable state access when ownership allows it. Pass `&mut` state into helper/render functions when the borrow checker allows it, and avoid inventing enum action outputs that bubble upward only to work around avoidable ownership structure.
- Keep component UI state narrow. Component structs may own edit drafts, focus flags, scroll/prefetch state, throttles, pending dialogs, and render caches; do not duplicate canonical host/session state there.
- Keep file dialogs, confirmations, and modal state in the existing `UiActions`, `HostModalState`, or workflow state that owns the operation.
- Throttle repeated interactive backend requests. Use existing throttle/retry/send helpers for high-frequency UI interactions.
- Reuse local shared utilities. Before adding helpers or shared types, look for existing code under `src/common/`, `src/host/common/`, `src/session/ui/common/`, and nearby `shared/` modules.

## Change Entry Points

- For filter/search/chart behavior, start from `SessionShared` and `src/session/ui/shared/searching/`.
- For global filter or preset definitions, start from `HostRegistry`.
- For plugin behavior, keep runtime work in `src/host/service/plugin/` and host UI state in `HostState.plugins`.
- For export behavior, start from `src/session/ui/shared/export/` and `src/session/service/export.rs`.
- For recent-session persistence, keep changes flowing through `SessionShared` revision tracking, `RecentSessionRuntime`, and `src/host/ui/storage/recent/`.
- For favorite folders/file explorer persistence, start from `src/host/ui/storage/`, `src/host/ui/home/`, and `src/host/service/storage/`.
- For table selection/bookmarks, keep semantic state in `LogsState`; table modules should own table-local scroll/prefetch state.

## Validation

Run from the repository root:

- Build: `cargo build --manifest-path application/apps/indexer/Cargo.toml -p application`
- Test: `cargo test --manifest-path application/apps/indexer/Cargo.toml -p application`
- Lint: `cargo clippy --manifest-path application/apps/indexer/Cargo.toml -p application`
