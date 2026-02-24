# Electron Holder Context

## Overview

`holder` is the Electron desktop host process. It owns lifecycle, windowing, and IPC bridging between UI and Rust-backed services.

## Start Here (First Files to Open)

1. `application/holder/package.json`
2. `application/holder/src/controller/`
3. `application/holder/src/service/bridge/`
4. `application/holder/src/service/electron/`
5. `application/platform/AGENTS.md`
6. `application/apps/rustcore/ts-bindings/AGENTS.md`

## If You Need X, Go to Y

- Change startup/shutdown/update behavior: lifecycle/controller flow in `application/holder/src/controller/` and `application/holder/src/register/`.
- Change IPC forwarding between client and backend: bridge/service flow in `application/holder/src/service/bridge/` plus `application/platform/ipc/` contracts.
- Change native menus/dialog/window behavior: Electron integration code in `application/holder/src/service/electron/`.
- Trace backend call flow: holder IPC handlers -> `application/apps/rustcore/ts-bindings` APIs -> Rust boundary.

## Cross-Module Dependency Map

- Consumes `application/apps/rustcore/ts-bindings` for Rust-backed operations.
- Shares IPC contract/types with `application/platform`.
- Hosts and serves Angular client runtime.

## Landmarks and Hotspots

- Electron lifecycle hooks.
- IPC channel registration/forwarding.
- Window state/menu/dialog integration.
- IPC contract drift between holder/client/platform is the main hotspot.

## Development

- Target: `app`
- Build: `cargo chipmunk build app -u print`
- Lint: `cargo chipmunk lint app -u print`
