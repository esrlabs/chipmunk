# Native GUI Application (Rust) Context

## Overview
This crate implements Chipmunk's native desktop GUI using Rust, `egui`, and `eframe`.
It provides the host/session UI model for log viewing, filters, charts, presets, and backend-driven updates on top of the indexer runtime.

## Start Here
1. `application/apps/indexer/gui/application/src/main.rs`
2. `application/apps/indexer/gui/application/src/host/`
3. `application/apps/indexer/gui/application/src/session/`
4. `application/apps/indexer/gui/application/src/session/ui/shared/`
5. `application/apps/indexer/gui/application/src/session/ui/side_panel/`
6. `application/apps/indexer/gui/application/src/session/ui/bottom_panel/`
7. `.ai/knowledge/application/apps/indexer/AGENTS.md`
8. `.ai/knowledge/application/apps/indexer/stypes/AGENTS.md`

## If You Need X, Go to Y
- Change host/session lifecycle or registries: `src/host/` and `src/host/ui/registry/`.
- Change session state or backend command coordination: `src/session/` and `src/session/ui/shared/`.
- Extend filters/charts/search behavior: `src/session/ui/shared/filters.rs`, `src/session/ui/shared/search.rs`, `src/session/ui/shared/search_values.rs`, `src/session/ui/side_panel/filters.rs`, `src/session/ui/bottom_panel/search/`, `src/session/ui/bottom_panel/chart/`, and `src/host/ui/registry/filters.rs`.
- Change log table rendering/highlighting: `src/session/ui/logs_table/` and `src/session/ui/common/logs_tables.rs`.
- Change observe/source setup flow: `src/session/ui/side_panel/observing/` and session setup under `src/host/ui/`.

## Current Ownership Model
- `FilterRegistry` owns global filter/search-value definitions and colors.
- `SessionShared` owns session-local apply/enable state and search/chart pipeline sync.
- `ChartUI` owns rendering caches only; it reads active state from shared session state.
- Backend/UI integration mainly crosses `tokio::sync::mpsc` command/message boundaries.

## Hotspots
- Session cleanup and registry usage tracking.
- Explicit UI-driven sync through `SessionShared::sync_search_pipelines`.
- Sidebar filter/chart management and search bar temp-search flow.
- Chart mapping/order behavior for histogram filters and search-value line series.
- Immediate-mode repaint behavior when backend events update UI state.

## Development
- Primary repo workflow: `cargo chipmunk build|test|lint ...`
- Crate-local fallback:
  - Build: `cargo build --manifest-path application/apps/indexer/Cargo.toml -p application`
  - Test: `cargo test --manifest-path application/apps/indexer/Cargo.toml -p application`
  - Lint: `cargo clippy --manifest-path application/apps/indexer/Cargo.toml -p application`
