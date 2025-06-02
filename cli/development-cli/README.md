[![LICENSE](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE.txt)

# Chipmunk Development CLI Tool

This CLI Tool provides an easier way to manage various development tasks for Chipmunk.
Chipmunk consists of multiple modules with complex dependencies on each other, and this tool helps streamline the development process by coordinating these tasks seamlessly.
This tool acts as a cargo extension. Once installed, you can access it by running `cargo chipmunk <COMMAND> <ARGS>` from anywhere within the repository.

---

> [!IMPORTANT]
> For comprehensive documentation, including detailed installation steps, full command references, usage examples, and configuration options, please visit the official documentation site: [Chipmunk Development CLI Tool Documentation]({URL_TO_PUBLISHED_CLI_DOCS})

---

## Getting Started

### Installation

Ensure you have **Rust** installed on your system (visit [rustup.rs](https://rustup.rs/) for instructions).

To install the Chipmunk Development CLI tool, navigate to the root of the Chipmunk repository in your terminal and run:

`cargo install --path cli/development-cli`

Once installed, you can access it by running `cargo chipmunk <COMMAND> <ARGS>`.

## Usage Overview

This CLI tool provides commands to manage the Chipmunk application's development cycle, including environment checks, building, testing, linting, running the application, and generating releases. It also offers features for managing user-level configurations and running project benchmarks.

For a complete list of commands, their arguments, and detailed usage instructions, please refer to the [full documentation](https://esrlabs.github.io/chipmunk/contributing/dev-cli/).

## Changelogs

Changelogs can be found [here](CHANGELOG.md).

## Contributing

Contributions to the Chipmunk Development CLI tool are very welcome!

After making any changes, please ensure that all commands in this tool are still working as expected by running its integration tests. Additionally, consider adding new tests when introducing new features.

For more details on contributing to Chipmunk, including how to run tests for this CLI tool, please see our main [contribution guide](https://esrlabs.github.io/chipmunk/contributing/welcome/).
