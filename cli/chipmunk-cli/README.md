[![LICENSE](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE.txt)
[![](https://github.com/esrlabs/chipmunk/actions/workflows/lint_master.yml/badge.svg)](https://github.com/esrlabs/chipmunk/actions/workflows/lint_master.yml)

# Chipmunk CLI Tool

Chipmunk CLI is a command-line tool designed to connect to multiple data sources, process incoming data, and write the output to a file in both binary and text formats. It supports:

* Connecting to TCP, UDP sockets, and files as input sources.
* Parsing data using various formats.
* Writing processed data to binary and text output formats.
* Reconnecting to TCP servers when configured.
* Providing status updates while running.

---

> [!IMPORTANT]
> For comprehensive documentation, including detailed installation steps, full command references, usage examples, and configuration options, please visit the official documentation site: [Chipmunk CLI Tool Documentation](https://esrlabs.github.io/chipmunk/cli/)

---

## Build and Installation

### Prerequisites

Ensure that **Rust** is installed on your system. If not, follow the official installation instructions at [rustup.rs](https://rustup.rs/).

### Install Chipmunk CLI

Navigate to the root directory of the Chipmunk repository in your terminal and run:

`cargo install --path cli/chipmunk-cli`

This command installs the `chipmunk-cli` tool, allowing you to execute parsing tasks using various parsers and input sources.

## Usage Overview

The Chipmunk CLI tool provides commands to connect to diverse input sources, parse data using supported formats, and specify output configurations (e.g., output path, format, column separators).

For a complete list of commands, their arguments, and detailed usage instructions and examples, please refer to the [full documentation](https://esrlabs.github.io/chipmunk/cli/).

## Changelogs

Changelogs can be found [here](CHANGELOG.md).

## Contributing

Contributions to the Chipmunk CLI tool are very welcome!

Please see our [main contribution guide](https://esrlabs.github.io/chipmunk/contributing/welcome/) for details on how to contribute to the Chipmunk project.
