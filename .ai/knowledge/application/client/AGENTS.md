# Angular Client Context

## Overview

The Angular client is the primary UI for viewing logs, managing filters, and visualizing data.

## Start Here (First Files to Open)

1. `application/client/angular.json`
2. `application/client/src/app/`
3. `application/client/src/app/service/`
4. `application/client/src/app/ui/`
5. `application/client/src/app/ui/styles/`
6. `.ai/knowledge/application/platform/AGENTS.md`
7. `.ai/knowledge/application/apps/rustcore/ts-bindings/AGENTS.md`

## If You Need X, Go to Y

- Change screen-level behavior: UI features in `application/client/src/app/ui/`.
- Change shared UI state or backend calls: `application/client/src/app/service/`.
- Update app-wide styling rules: `application/client/src/app/ui/styles/` and component styles.
- Trace backend data into UI: follow `ts-bindings` calls through services and component subscriptions.

## Cross-Module Dependency Map

- Consumes APIs through `application/apps/rustcore/ts-bindings`.
- Exchanges contracts with Electron via `application/platform/ipc/` and shared `application/platform/types/`.
- Runs inside Electron holder in desktop distribution.

## Landmarks and Hotspots

- Observable-based service/component interactions.
- Filter/search and chart rendering flows are high-context UI surfaces.
- IPC contract drift with `platform` or `holder` is a common integration hotspot.

## Tech Stack & Conventions

- Target: `client`
- Build: `cargo chipmunk build client -u print`
- Test: `cargo chipmunk test client -u print`
- Lint: `cargo chipmunk lint client -u print`
- Framework: Angular 19
- Styling: Vanilla CSS (preferred)
- Naming: `camelCase` for vars/functions, `PascalCase` for classes/interfaces
