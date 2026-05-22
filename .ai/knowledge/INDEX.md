# Chipmunk Knowledge Index

## Overview

Repository AI context lives under `.ai/knowledge/`.
Use this file only to choose the next context file to read.

## Start Here

1. `.ai/knowledge/application/apps/indexer/gui/application/AGENTS.md`
2. `.ai/knowledge/application/apps/indexer/AGENTS.md`
3. `.ai/knowledge/application/apps/indexer/stypes/AGENTS.md`

## Primary Application Context

- Native GUI: `.ai/knowledge/application/apps/indexer/gui/application/AGENTS.md`
  - Use for egui/eframe desktop UI, host/session UI, filters, charts, logs, and search.
- Rust core: `.ai/knowledge/application/apps/indexer/AGENTS.md`
  - Use for ingestion, parsing, indexing, search, plugins host, and backend session behavior.
- Shared types: `.ai/knowledge/application/apps/indexer/stypes/AGENTS.md`
  - Use for shared Rust/TS type definitions and protocol-facing data models.

## Legacy Reference Context

Load only when explicitly needed for comparison, migration, or historical behavior.

- Electron host: `.ai/knowledge/application/holder/AGENTS.md`
- Angular client: `.ai/knowledge/application/client/AGENTS.md`
- Shared TS platform: `.ai/knowledge/application/platform/AGENTS.md`
- Protocol bridge: `.ai/knowledge/application/apps/protocol/AGENTS.md`
- Native Node binding: `.ai/knowledge/application/apps/rustcore/rs-bindings/AGENTS.md`
- TS wrapper: `.ai/knowledge/application/apps/rustcore/ts-bindings/AGENTS.md`
- WASM bindings: `.ai/knowledge/application/apps/rustcore/wasm-bindings/AGENTS.md`
- Legacy repo orchestration: `.ai/knowledge/cli/development-cli/AGENTS.md`

## Peripheral Context

Side code outside the desktop application path. Load only when the task explicitly targets that package.

- CLI parser/export: `.ai/knowledge/cli/chipmunk-cli/AGENTS.md`
- Plugins: `.ai/knowledge/plugins/AGENTS.md`
