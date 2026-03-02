# Shared Platform Context

## Overview

`platform` contains shared TypeScript contracts and utilities used by holder/client and bridge layers.

## Start Here (First Files to Open)

1. `application/platform/ipc/`
2. `application/platform/types/`
3. `application/platform/env/`
4. `application/platform/log/`
5. `.ai/application/client/AGENTS.md`
6. `.ai/application/holder/AGENTS.md`

## If You Need X, Go to Y

- Change IPC message contracts: `application/platform/ipc/`.
- Change shared domain interfaces/enums: `application/platform/types/`.
- Change runtime environment detection/config: `application/platform/env/`.
- Change shared frontend logging utilities: `application/platform/log/`.
- Trace cross-app type issues: start in `application/platform/types/`, then check `application/apps/indexer/stypes` and protocol/bindings if data originates in Rust.

## Cross-Module Dependency Map

- Consumed by both `application/client` and `application/holder`.
- Some `application/platform/types/` entries are generated downstream from `application/apps/indexer/stypes`.
- IPC contracts here define holder <-> client communication boundaries.

## Landmarks and Hotspots

- IPC contract definitions and channel naming.
- Shared type evolution affecting multiple targets.
- Generated-vs-manual type changes in `application/platform/types/` are a high-context hotspot.

## Development

- Target: `shared`
- Build: `cargo chipmunk build shared -u print`
- Lint: `cargo chipmunk lint shared -u print`
- Note: platform changes can affect multiple targets.
