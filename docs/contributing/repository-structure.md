# Repository Structure

The main Rust workspace lives under `crates/`. These are the most important areas for contributors:

* `crates/app`: the native desktop application.
* `crates/cli`: the standalone Chipmunk CLI.
* `crates/core/*`: core log processing crates, including sources, parsers, sessions, indexing/search, merging, protocol tools, and the plugin host.
* `crates/plugins_api`: APIs used by Chipmunk plugins.
* `crates/stypes`: shared data types used across the application, core crates, CLI, and plugin-facing code.
* `crates/bufread`, `crates/dir_checksum`, `crates/file-tools`, `crates/shell-tools`: utility crates used by the workspace.

Plugin templates and examples live under `plugins/`. They are useful when creating or testing plugin integrations, but they are separate from the normal application development flow.
