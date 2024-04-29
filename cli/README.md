[![LICENSE](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE.txt)

# Chipmunk Development CLI Tool

This CLI Tool provides an easier way to manage various development tasks for Chipmunk.
Chipmunk consists of multiple modules with complex dependencies on each other, and this tool helps streamline the development process by coordinating these tasks seamlessly.
This tool acts as a cargo extension. Once installed, you can access it by running `cargo chipmunk <COMMAND> <ARGS>` from anywhere within the repository.

## Build/Installation

### Prerequisites

Before installing the Chipmunk CLI tool, ensure that Rust is installed on your system. If Rust is not yet installed, follow the official installation instructions for your platform:

- **Install Rust:** Visit [rustup.rs](https://rustup.rs/) and follow the instructions to install Rust.

### Install Chipmunk CLI

Navigate to the root directory of the Chipmunk repository in your terminal and run the following command to install the Chipmunk CLI tool:

```bash
cargo install --path cli
```

This command installs this tool as a cargo extension, allowing you to use `cargo chipmunk <COMMAND> <ARGS>` to execute various development tasks for Chipmunk.


## Usage

This CLI tool provides multiple sub-commands for different tasks, with each sub-command offering various arguments.

### General Commands Overview

```bash
Tool for chipmunk application development

Usage: cargo chipmunk <COMMAND>

Commands:
  environment  Provides commands for the needed tools for the development [aliases: env]
  print-dot    Prints an overview of targets dependencies in print-dot format for `Graphviz` [aliases: dot]
  lint         Runs linting & clippy
  build        Build
  clean        Clean
  test         Run tests
  run          Build and Run the application
  help         Print this message or the help of the given subcommand(s)

Options:
  -h, --help     Print help
  -V, --version  Print version
```

### Build Command 

```bash
Usage: cargo chipmunk build [OPTIONS] [TARGET]...

Arguments:
  [TARGET]...
          Target to build, by default whole application will be built

          Possible values:
          - core:    Represents the path `application/apps/indexer`
          - binding: Represents the path `application/apps/rustcore/rs-bindings`
          - wrapper: Represents the path `application/apps/rustcore/ts-bindings`
          - client:  Represents the path `application/client`
          - shared:  Represents the path `application/platform`
          - app:     Represents the path `application/holder`
          - cli:     Represents the path `cli`
          - wasm:    Represents the path `application/apps/rustcore/wasm-bindings`
          - updater: Represents the path `application/apps/precompiled/updater

Options:
  -p, --production
          Build release version

  -r, --report [<FILE-PATH>]
          Write report from command logs to the given file or to stdout if no file is defined

  -h, --help
          Print help (see a summary with '-h')
```

## Contributing
See our [contribution](contribution.md) guide for details
