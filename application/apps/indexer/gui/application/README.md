# Chipmunk 4 Alpha

Chipmunk 4 Alpha is the next generation of Chipmunk: a native Rust rewrite for high-volume logs, traces, and live streams.

## Table of Contents

- [What is different](#what-is-different)
- [Alpha status](#alpha-status)
- [Compatibility](#compatibility)
- [Features](#features)
    - [Sources](#sources)
    - [Parsers](#parsers)
    - [Search and filters](#search-and-filters)
    - [Charts](#charts)
    - [Sessions and analysis](#sessions-and-analysis)
    - [Presets](#presets)
    - [Plugins](#plugins)
- [Installation](#installation)
    - [Install nightly from source](#install-nightly-from-source)
- [CLI usage](#cli-usage)
- [Alpha roadmap](#alpha-roadmap)

## What is different

Chipmunk 4 keeps the same focus as Chipmunk today: fast analysis of large logs, traces, and live streams.

The difference is the application stack:

- Native Rust UI instead of Electron and Angular.
- Direct integration with Chipmunk's Rust indexing, parsing, streaming, and search engine.
- Fewer runtime layers between the UI and the data-processing core.
- Built for responsive workflows on large files and continuously updating sources.

## Alpha status

Chipmunk 4 is currently in alpha.

The core workflows needed for daily use are already available: opening data, configuring parsers, searching, filtering, charting, saving presets, and restoring recent work. During alpha, expect ongoing UI polish, packaging updates, and some secondary features to keep evolving.

Alpha builds are published as pre-releases. Look for versions such as `4.0.0-alpha.1` on the release page.

## Compatibility

Chipmunk 4 is designed to stay compatible with current Chipmunk workflows.

- Existing file, stream, search, filter, chart, and preset workflows are supported.
- Filters and presets are available in the native app.
- Preset import supports current and legacy Chipmunk preset exports.
- Supported files and streams use the same Rust parsing and indexing core.

## Features

### Sources

- Files and folders
- Multiple files, opened separately or concatenated
- Drag and drop for files and directories
- TCP and UDP streams
- UDP multicast configuration
- Serial ports
- Terminal/process output

### Parsers

- Plain Text
- DLT
- SomeIP
- Plugin parsers through WebAssembly components

### Search and filters

- Temporary search for quick inspection
- Saved filters
- Regex, match-case, and whole-word options
- Colored filter highlighting
- Search results table

### Charts

- Filter frequency charts
- Numeric charts from regex capture groups
- Live updates while data is still arriving

### Sessions and analysis

- Multi-tab sessions
- Recent sessions with restored filters, charts, and bookmarks
- Favorite folders
- Bookmarks
- Details panel
- Attachment list, preview, filtering, saving, and jump-to-row actions

### Presets

- Create presets from a session
- Edit and apply presets
- Import and export presets
- Import legacy Chipmunk preset exports

### Plugins

- Chipmunk supports parser plugins through WebAssembly components.
- The Plugins Manager lets you add, remove, and inspect plugins.
- Parser plugins can be used with all supported sources.

## Installation

Download binaries from the [Chipmunk releases page](https://github.com/esrlabs/chipmunk/releases).

During alpha, use pre-release builds and look for versions like `4.0.0-alpha.1`.

### Install nightly from source

From the repository root:

```sh
cargo install --path application/apps/indexer/gui/application
```

From this directory:

```sh
cargo install --path .
```

## CLI usage

After installing, the binary is named `chipmunk`.

```sh
chipmunk files path/to/log.txt path/to/other.log
```

```sh
chipmunk process "journalctl -f"
```

For available options:

```sh
chipmunk --help
```

## Alpha roadmap

- [x] Built-in sources and parsers
- [x] Multi-source sessions
- [x] Filters and charts
- [x] Filter and preset import/export
- [x] Recent session restore
- [x] Attachment support and preview
- [ ] Log import/export
- [x] Plugin support
- [x] Command palette and keyboard shortcuts
