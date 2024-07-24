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
CLI Tool for chipmunk application development

Usage: cargo chipmunk <COMMAND>

Commands:
  environment     Provides commands for the needed tools for the development [aliases: env]
  print-dot       Prints an overview of targets dependencies in print-dot format for `Graphviz` [aliases: dot]
  lint            Runs linting & clippy for all or the specified targets
  build           Build all or the specified targets
  clean           Clean all or the specified targets
  test            Run tests for all or the specified targets
  run             Build and Run the application
  reset-checksum  Resets the checksums records what is used to check if there were any code changes for each target [aliases: reset]
  shell-completion  Generate shell completion for the commands of this tool in the given shell, printing them to stdout [aliases: compl]
  help            Print this message or the help of the given subcommand(s)

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

## Shell Completion

The Chipmunk CLI tool supports shell completion for various shells. You can generate shell completions and print them to `stdout` using the following command:

```bash
cargo chipmunk shell-completion <SHELL>
```
Replace <SHELL> with the name of your shell (e.g., bash, zsh, fish, powershell).

To use shell completion, you can redirect the output of the completion command to a file and save the file to the appropriate shell completion directory.

After installing the completion script, restart your shell session or source the completion file to enable shell completion for the Chipmunk CLI tool.


### Example: Bash Shell
To enable bash shell completion, run the following command to generate the completion script and save it to a file:

```bash
cargo chipmunk shell-completion bash > chipmunk-completion.bash
```
Next, copy the chipmunk-completion.bash file to your bash completion directory (typically  ~/.bash_completion.d/ or /etc/bash_completion.d/).


## Contributing

Contributions in any part of Chipmunk are very welcome!

After making any changes to this build CLI tool, please run the integration tests to ensure that all the provided commands in this tool are still working as expected. Additionally, consider adding new tests when introducing new features and commands.

To run all the tests, execute the Python file `chipmunk/cli/integration_tests/run_all.py` from within the `chipmunk/cli` directory. For example:

```bash
# Move to cli directory
cd cli
# Run python file
python ./integration_tests/run_all.py
```
Please be aware that these tests will run on your local copy of Chipmunk. This process will rebuild the project and run all linting and tests on the entire solution.

For more details, please see our [contribution guid](../contribution.md)

