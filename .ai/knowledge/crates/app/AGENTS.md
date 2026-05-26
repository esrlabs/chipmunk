# Native GUI Application Context

## Overview

`crates/app` implements Chipmunk's native desktop GUI using Rust, `egui`, and `eframe`.
It owns the desktop application shell and integrates directly with the core runtime crates.

## Start Here

1. `crates/app/src/host/ui/`
2. `crates/app/src/session/ui/`
3. `crates/app/src/host/service/`
4. `crates/app/src/session/service/`
5. `crates/app/src/host/ui/state/`
6. `.ai/knowledge/crates/core/AGENTS.md`
7. `.ai/knowledge/crates/stypes/AGENTS.md`

## If You Need X, Start Here

- App frame loop, tabs, top-level UI state: `crates/app/src/host/ui/`
- Host async commands, startup, opening sources: `crates/app/src/host/service/`
- One live session UI: `crates/app/src/session/ui/`
- Session backend coordination: `crates/app/src/session/service/`
- Global filters, search values, presets: `crates/app/src/host/ui/registry/`
- Session-local filters, search, search values: `crates/app/src/session/ui/shared/searching/`
- Main logs table: `crates/app/src/session/ui/logs_table/`
- Shared table behavior: `crates/app/src/session/ui/common/log_table/`
- Side panel session tools: `crates/app/src/session/ui/side_panel/`
- Bottom panel search/chart/details/presets: `crates/app/src/session/ui/bottom_panel/`
- Session setup/source/parser forms: `crates/app/src/host/ui/session_setup/`
- Multi-file setup: `crates/app/src/host/ui/multi_setup/`
- Plugin management and plugin-backed setup: `crates/app/src/host/service/plugin/`, `crates/app/src/host/ui/plugin_manager/`
- Export workflows: `crates/app/src/session/ui/shared/export/`, `crates/app/src/session/service/export.rs`
- Recent sessions, favorite folders, and service-backed storage: `crates/app/src/host/ui/storage/`, `crates/app/src/host/service/storage/`
- Lightweight host UI preferences: `crates/app/src/host/ui/persist.rs`, `crates/app/src/host/ui/state/preferences.rs`
- Command palette and shortcuts: `crates/app/src/host/ui/command_palette/`, `crates/app/src/host/ui/shortcuts/`

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
- Reuse local shared utilities. Before adding helpers or shared types, look for existing code under `crates/app/src/common/`, `crates/app/src/host/common/`, `crates/app/src/session/ui/common/`, and nearby `shared/` modules.

## Change Entry Points

- For filter/search/chart behavior, start from `SessionShared` and `crates/app/src/session/ui/shared/searching/`.
- For global filter or preset definitions, start from `HostRegistry`.
- For plugin behavior, keep runtime work in `crates/app/src/host/service/plugin/` and host UI state in `HostState.plugins`.
- For export behavior, start from `crates/app/src/session/ui/shared/export/` and `crates/app/src/session/service/export.rs`.
- For recent-session persistence, keep changes flowing through `SessionShared` revision tracking, `RecentSessionRuntime`, and `crates/app/src/host/ui/storage/recent/`.
- For favorite folders/file explorer persistence, start from `crates/app/src/host/ui/storage/`, `crates/app/src/host/ui/home/`, and `crates/app/src/host/service/storage/`.
- For table selection/bookmarks, keep semantic state in `LogsState`; table modules should own table-local scroll/prefetch state.

## Validation

Run validation only when requested or needed to verify a change.
Use targeted Cargo commands from the repository root, for example:

- Check: `cargo check -p app`
- Test: `cargo test -p app`
- Lint: `cargo clippy -p app`
