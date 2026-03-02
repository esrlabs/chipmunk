# Development CLI (`cargo chipmunk`) Context

## Overview
`development-cli` is the developer task orchestrator for build/test/lint/release workflows across this repo.

## Start Here (First Files to Open)

1. `cli/development-cli/Cargo.toml`
2. `cli/development-cli/src/main.rs`
3. `cli/development-cli/src/jobs_runner/`
4. `cli/development-cli/src/target/`
5. `cli/development-cli/src/dev_environment/`
6. `cli/development-cli/src/release/`
7. `cli/development-cli/src/benchmark/`

## If You Need X, Go to Y

- Change dependency resolution or job scheduling: `cli/development-cli/src/jobs_runner/`.
- Change target definitions (build/test/lint commands): `cli/development-cli/src/target/`.
- Change smart rebuild/cache behavior: checksum and job-state logic in `cli/development-cli/src/build_state_records.rs`, `cli/development-cli/src/jobs_runner/`, and `cli/development-cli/dir_checksum/`.
- Change output modes/progress UI/logging behavior: output handling in `cli/development-cli/src/tracker.rs`, `cli/development-cli/src/jobs_runner/`, and target execution flow.
- Change tool/version validation: `cli/development-cli/src/dev_environment/`.
- Investigate command orchestration regressions: trace `cli/development-cli/src/main.rs` -> target resolution -> jobs runner -> command output.

## Cross-Module Dependency Map

- Drives tasks for all major targets (`core`, `client`, `app`, `shared`, `binding`, `wrapper`, CLI targets).
- Encodes project-wide target dependency graph and execution policy.

## Landmarks and Hotspots

- Target graph and concurrency logic in `cli/development-cli/src/jobs_runner/`.
- Incremental rebuild state handling (`.build_last_state`) in `cli/development-cli/src/build_state_records.rs`.
- Output mode behavior (`bars`, `report`, `print`, `immediate`) in `cli/development-cli/src/tracker.rs`.

## Development

- Target: `cli-dev`
- Build: `cargo build`
- Test: `cargo test`
- Lint: `cargo clippy`
- Install: `cargo install --path cli/development-cli`
- Integration tests: `python cli/development-cli/integration_tests/run_all.py`
