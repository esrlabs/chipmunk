# Native GUI Architecture

## Overview

`crates/app` runs as a single process: the UI thread runs one `eframe::App`, and all async work runs on one tokio runtime on one spawned thread. There is no separate backend process; the core crates are linked directly.

Read this file before adding a feature, crossing the UI/service boundary, or reviewing a design.
Binding code rules live in `.ai/rules/app-ui.md`.

## Frame Loop

The workspace patches `eframe`/`egui` to a fork that splits `App::logic` from `App::ui`:

- `logic` drains the host message and notification channels, polls the pending storage save, then pumps the messages of **every** session tab.
- `ui` renders **only** the active tab.

Background sessions stay alive in state but are never drawn. Message handling belongs in `logic` or `Session::handle_messages`; putting it in render code starves every inactive session.

## Host and Sessions

`Host` is the `eframe::App` and owns tabs, top-level state, storage, notifications, and global actions. `HostTabs` owns the tab vector: Home is index 0 and cannot be closed, and the session count is unbounded.

A session is a pair joined by its own channel pair: `Session` (UI) and `SessionService`, which wraps one `session_core::Session`.

- **Create:** `HostCommand::StartSession` → `HostService::start_session` → `SessionService::spawn` → `HostMessage::SessionCreated` → `Host` builds the `Session` and `HostTabs` adds it, replacing the originating setup tab in place when there is one.
- **Tab close:** registry cleanup, remove the tab, fire-and-forget `CloseSession`.
- **App exit:** close every receiver, send `CloseSession` with an ack channel, wait on all acks under one shared deadline, flush storage, then `HostCommand::OnShutdown`.

## Communication

Four async channels:

- `HostCommand` — UI to host service.
- `HostMessage` — host service to UI.
- `AppNotification` — service to UI, shown as banners and kept in notification history.
- `HostAsyncEvent` — internal to the service layer: results of background work the host command loop itself must act on. Never reaches the UI.

Per session, `SessionCommand` and `SessionMessage` mirror the first two.

Services never send on a raw sender. Every UI-bound send goes through `ServiceSenders`, which requests a repaint on success; a raw send arrives but may not be drawn until an unrelated event wakes the UI.

The one exception to async messaging is a `std::sync::mpsc::Sender` embedded in a command, used where the caller must block for the answer: the blocking line grabs and the shutdown acknowledgement.

## Service Layer

`HostService::run` is the only host command loop, selecting over incoming commands and `HostAsyncEvent`. Startup is a blocking handshake: `HostService::spawn` returns `HostServiceInit` over a sync channel, so the first frame already has recent sessions, app settings, and presets. Heavier domains load lazily afterwards.

Sub-services come in two shapes. Work whose result the host loop must act on is a struct initialized with the `HostAsyncEvent` sender (`StorageService`, `PluginService`). Work that only updates the UI is free functions taking `ServiceSenders` by value (`update`). `session/service/export.rs` and `tracker.rs` are not services; they are `impl SessionService` files.

A service may own backend runtime state — `PluginsManager`, `session_core::Session`, the instance temp directory, the operation tracker — but never state the UI renders from. It publishes snapshots instead.

## One Round Trip

Applying a search filter, end to end:

1. The search bar calls `SessionShared::sync_search`.
2. Shared state resolves the session's filter ids against the host `FilterRegistry`, drops the in-flight operation, recompiles the filters, mints a new operation id, and returns `DropSearch` + `ApplySearchFilter`.
3. The widget dispatches each through `UiActions`.
4. `SessionService::handle_command` calls into `session_core`.
5. Core callbacks are translated into `SessionMessage`s.
6. The next `logic` applies them to `shared.search`; the next `ui` renders counts and pulls row text.

## State Ownership

- **UI-canonical:** `HostState`, `HostTabs`, `HostStorage`, and one `SessionShared` per session. These are the source of truth.
- **Backend-canonical, mirrored in the UI:** log content, search results, bookmarks, attachments. Bookmarks are the clearest case: a toggle sends a command and only the resulting message mutates state. Never write these optimistically. This category exists because the current core owns that state, not by design; the intended direction is UI-canonical, so do not grow it.
- **Derived caches:** compiled filters, table row caches, the published plugin snapshot. Invalidate on explicit state changes, never by recomputing in render.

Persistence uses two separate stores: `host/ui/persist.rs` writes lightweight host preferences through eframe storage; everything heavier goes `HostStorage` → `HostCommand::SaveStorage` → the storage worker, driven by per-domain dirty flags.

## Boundary to the Workspace

`crates/stypes` holds the cross-crate contracts, `crates/core` is the engine, and `crates/app` owns presentation plus the *editable* config model (`ParserConfig`, `ByteSourceConfig`, `StreamConfig`). Those configs convert to `stypes` at a single point, `HostService::start_session`.

Worth knowing: the config and storage types live under `host/ui/`, and the service layer imports them. `ui` is not a leaf layer — it is also the shared data-model module.

Plugins follow the ownership rule strictly. `PluginsManager` exists only inside `PluginService`; the UI consumes cloned `PluginsState` snapshots and mutates through commands only. Plugin render metadata crosses as a `LogSchemaSpec`, resolved once by the host service and frozen into the session's `LogSchema` at creation, so an open session's columns cannot change when plugins reload.

## Extension Points

Ordered touch sequences:

- **Parser:** `host/common/parsers.rs` (names and compatibility) → `host/ui/session_setup/state/parsers/` (`ParserConfig`) → side and main config forms → `HostService` conversion to `ParserType` and `LogSchemaSpec` → a new `session/ui/definitions/schema/` implementation.
- **Source/transport:** `host/common/sources.rs` → parser compatibility → `session_setup/state/sources/` (`StreamConfig`) → main config form → `HostService` conversion to `ObserveOrigin`.
- **Session operation:** `session/command.rs` → `session/message.rs` → `SessionService::handle_command` → `Session::handle_messages` → the sending widget.
- **Host command:** `host/command.rs` → `HostService::handle_command` → optional `host/message.rs` → `Host::handle_message` → the sender.
- **Shortcut:** no central enum; add a named field to `AppShortcuts` or `SessionShortcuts` and handle it. Deferred work needs a `ShortcutAction` variant.
- **Palette command:** `CommandAction` variant → `scope()` → `execute_action` → the `COMMANDS` slice.
- **Bottom tab:** `bottom_panel/tab_types.rs` → `render_content`, the tabs array, `bottom_tab_from_index`, and a field on `BottomPanelUI`.
- **Storage domain:** `host/ui/storage/types.rs` → `HostStorage` collection and dirty tracking → `host/service/storage/` with a disk-IO submodule.

## Traps

These compile and fail at runtime or silently:

- Mutating `SessionShared` public fields directly skips `bump_recent_revision`: the change renders but never persists into the recent session. Use the wrapper methods.
- `shared.signals` is a render-frame queue. Emitting a signal from message handling or restore leaks it into the next frame; `debug_assert!`s guard this. Outside render use `sync_search_outcome`, not `sync_search`.
- Compiled filter order must match the order sent in `ApplySearchFilter`, or match highlight colors land on the wrong filter.
- A bottom tab added without extending `bottom_tab_from_index` panics at runtime instead of failing to compile.
- A storage domain missing from dirty collection never persists; one missing from the failure re-mark never retries.
- A palette command left out of the `COMMANDS` slice, or a shortcut left out of the definitions, is unreachable.
