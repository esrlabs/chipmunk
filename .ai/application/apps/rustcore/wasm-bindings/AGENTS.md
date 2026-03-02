# WASM Bindings Context

## Overview

`wasm-bindings` provides browser-facing Rust WASM utilities for fuzzy matching, ANSI rendering, and filter validation.

## Start Here (First Files to Open)

1. `application/apps/rustcore/wasm-bindings/Cargo.toml`
2. `application/apps/rustcore/wasm-bindings/src/lib.rs`
3. `application/apps/rustcore/wasm-bindings/src/`
4. `application/apps/rustcore/wasm-bindings/spec/`
5. `application/apps/rustcore/wasm-bindings/pkg/`
6. `application/apps/rustcore/wasm-bindings/package.json`
7. `.ai/application/client/AGENTS.md`

## If You Need X, Go to Y

- Tune fuzzy matching output/scoring: matcher code in `application/apps/rustcore/wasm-bindings/src/`.
- Change ANSI conversion or stripping behavior: ANSI conversion code in `application/apps/rustcore/wasm-bindings/src/`.
- Update regex/filter validation messages: filter validation code in `application/apps/rustcore/wasm-bindings/src/`.
- Validate browser compatibility regressions: WASM-facing specs in `application/apps/rustcore/wasm-bindings/spec/`.

## Cross-Module Dependency Map

- Built as a WASM package consumed by `application/client`.
- Interacts with frontend behavior, not the Node native addon path.

## Landmarks and Hotspots

- `matcher` integration with `skim` scoring.
- `ansi` HTML conversion rules and escaping.
- `filter` regex validation and error messaging.
- Browser runtime compatibility (Karma/ChromeHeadless) is the critical hotspot.

## Quick Commands

- Build: `cargo chipmunk build wasm -u print`
- Test: `cargo chipmunk test wasm -u print`
- Lint: `cargo chipmunk lint wasm -u print`
