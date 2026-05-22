# Chipmunk

Chipmunk is a native Rust desktop application for high-volume logs, traces, and live streams.

The UI is built with egui and integrates directly with Chipmunk's Rust indexing, parsing, streaming, and search engine. The application is designed for responsive workflows on large files and continuously updating sources.

<p align="center">
  <img width="49%" alt="light-theme" src="https://github.com/user-attachments/assets/b830cb50-68c2-4289-933d-2d2d5710babf" />
  <img width="49%" alt="dark-theme" src="https://github.com/user-attachments/assets/b2ef0735-76e9-4085-8182-fdce8a4f9250" />
</p>

## Table of Contents

- [Overview](#overview)
- [Features](#features)
    - [Sources](#sources)
    - [Parsers](#parsers)
    - [Search and filters](#search-and-filters)
    - [Charts](#charts)
    - [Sessions and analysis](#sessions-and-analysis)
    - [Presets](#presets)
    - [Plugins](#plugins)
- [Installation](#installation)
    - [Install from source](#install-from-source)
- [CLI usage](#cli-usage)

## Overview

Chipmunk focuses on fast analysis of large logs, traces, and live streams. It provides a native desktop interface over Chipmunk's Rust data-processing core, with fewer runtime layers between the UI and indexing, parsing, streaming, and search.

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

### Install from source

From the repository root:

```sh
cargo install --path crates/chipmunk-app
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
