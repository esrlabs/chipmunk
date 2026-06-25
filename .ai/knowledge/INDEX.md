# Chipmunk Knowledge Index

## Overview

Repository AI context lives under `.ai/knowledge/`.
Use this file to choose the next context file to read. Do not load every context file by default.

## Repository Guardrails

- Main code lives in the root Rust workspace under `crates/`.
- `plugins/` is intentionally outside the main workspace validation path.
- The root `justfile` is the developer entrypoint, but do not run `just` recipes unless the user explicitly asks for them.
- Run build, test, lint, or validation commands only when the user requests validation or when needed to verify a change.

## Primary Context

- Native GUI: `.ai/knowledge/crates/app/AGENTS.md`
  - Use for egui/eframe desktop UI, host/session UI, filters, charts, logs, search, plugin UI, app state, and app services.
- Rust core: `.ai/knowledge/crates/core/AGENTS.md`
  - Use for ingestion, parsing, indexing, search, session behavior, plugin host runtime, sources, and exports.
- Shared types: `.ai/knowledge/crates/stypes/AGENTS.md`
  - Use for Rust data types shared across app, core, CLI, and plugin-facing flows.

## Targeted Context

Load only when the task explicitly targets that area.

- Rust workspace and dependencies: `.ai/knowledge/rust-workspace.md`
  - Use when editing `Cargo.toml`, adding dependencies, or changing workspace configuration.
- CLI parser/export: `.ai/knowledge/crates/cli/AGENTS.md`
- Plugins: `.ai/knowledge/plugins/AGENTS.md`
