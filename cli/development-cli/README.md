[![LICENSE](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE.txt)

# Chipmunk Development CLI Tool

This CLI Tool provides an easier way to manage various development tasks for Chipmunk.
Chipmunk consists of multiple modules with complex dependencies on each other, and this tool helps streamline the development process by coordinating these tasks seamlessly.
This tool acts as a cargo extension. Once installed, you can access it by running `cargo chipmunk <COMMAND> <ARGS>` from anywhere within the repository.

## Build/Installation

### Prerequisites

Before installing the Chipmunk CLI tool, ensure that Rust is installed on your system. If Rust is not yet installed, follow the official installation instructions for your platform:

- **Install Rust:** Visit [rustup.rs](https://rustup.rs/) and follow the instructions to install Rust.

### Install Chipmunk Development CLI

Navigate to the root directory of the Chipmunk repository in your terminal and run the following command to install the Chipmunk Development CLI tool:

```bash
cargo install --path cli/development-cli
```

This command installs this tool as a cargo extension, allowing you to use `cargo chipmunk <COMMAND> <ARGS>` to execute various development tasks for Chipmunk.


## Usage

This CLI tool provides multiple sub-commands for different tasks, with each sub-command offering various arguments.

### General Commands Overview

```bash
CLI Tool for chipmunk application development

Usage: cargo chipmunk <COMMAND>

Commands:
  environment       Provides commands for the needed tools for the development [aliases: env]
  print-dot         Prints an overview of targets dependencies in print-dot format for `Graphviz` [aliases: dot]
  configuration     Provides commands for the configuration of this tool on user level [aliases: config]
  lint              Runs linting & clippy for all or the specified targets
  build             Build all or the specified targets
  clean             Clean all or the specified targets
  test              Run tests for all or the specified targets
  run               Build and Run the application
  release           Builds Chipmunk and generates a release (defaults to Release mode)
  benchmark         Runs benchmarks for the given target, its input source and configuration [aliases: bench]
  reset-records     Resets the build states records what is used to check if there were any changes for each target [aliases: reset]
  shell-completion  Generate shell completion for the commands of this tool in the given shell, printing them to stdout [aliases: compl]
  help              Print this message or the help of the given subcommand(s)

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
          - core:         Represents the path `application/apps/indexer`
          - shared:       Represents the path `application/platform`
          - protocol:     Represents the path `application/apps/protocol`
          - binding:      Represents the path `application/apps/rustcore/rs-bindings`
          - wrapper:      Represents the path `application/apps/rustcore/ts-bindings`
          - wasm:         Represents the path `application/apps/rustcore/wasm-bindings`
          - client:       Represents the path `application/client`
          - updater:      Represents the path `application/apps/precompiled/updater`
          - app:          Represents the path `application/holder`
          - cli-dev:      Represents the path `cli/development-cli`
          - cli-chipmunk: Represents the path `cli/chipmunk-cli`

Options:
  -p, --production
          Build release version

  -f, --fail-fast
          Stops execution immediately if any job fails.

  -u, --ui-mode <UI_MODE>
          Specifies the UI options for displaying command logs and progress in the terminal

          Possible values:
          - bars:      Displays progress bars, showing the current line of the output of each command. [aliases: 'b']
          - report:    Displays progress bars and prints a summary of all command logs to stdout after all jobs have finished. [aliases: 'r']
          - print:     Outputs each job's result to stdout once the job finishes. No progress bars are displayed. [aliases: 'p']
          - immediate: Outputs logs immediately as they are produced, which may cause overlapping logs for parallel jobs. No progress bars are displayed. [aliases: 'i']

  -a, --additional-features <ADDITIONAL_FEATURES>
          Specifies additional features to be enabled in the build process

          Possible values:
          - custom-alloc: Activate `custom-alloc` feature in rs-binding to use custom memory allocator instead of the default one.

  -h, --help
          Print help (see a summary with '-h')
```

## User Configurations

Users can configure their preferences for the shell used to run process commands and the default UI mode. The configuration file should be located in the Chipmunk home directory, within the `build_cli` directory, named `config.toml`.

Configurations can be managed via the CLI using the `config` subcommands. These subcommands allow you to resolve the path to the configuration file and generate default configurations, with an option to write them directly to the file.

Below is an example of the configuration file with the available settings:

```toml
# Defines the shell to be used for executing process commands.
# Options:
#   - `sh` (Unix-based systems only)
#   - `cmd` (Windows only)
#   - `bash`
#   - `zsh`
#   - `fish`
#   - `nu-shell`
#   - `elvish`
#   - `power-shell`
# If not specified, the system will default to:
#   - The value of the `SHELL` environment variable on Unix-based systems.
#   - `cmd` on Windows.
shell = "sh"

# Defines the preferred UI mode.
# Options:
#   - `bars`: Displays progress bars, showing the current line of the output of each command.
#   - `report`: Displays progress bars and prints a summary of all command logs to stdout after all jobs have finished.
#   - `print`: Outputs each job's result to stdout once the job finishes. No progress bars are displayed.
#   - `immediate`: Outputs logs immediately as they are produced, which may cause overlapping logs for parallel jobs. No progress bars are displayed.
ui_mode = "bars"

# Specifies additional features to enable during the build process.
# Options:
#  - "custom-alloc": Activate `custom-alloc` feature in rs-binding to use custom memory allocator instead of the default one.
additional_features = []
```

## Benchmarks via Build CLI Tool

You can run benchmarks of the Rust Core part directly using the Build CLI tool. Some benchmarks require input sources and additional configurations, which should be provided via environment variables.

The CLI tool simplifies running these benchmarks from anywhere in the Chipmunk repository. You can provide the input sources and configurations as CLI arguments, and the tool will handle setting the environment variables for the benchmarks. For more details, use the help command: `cargo chipmunk bench --help`.

The registered benchmarks are loaded from `chipmunk/cli/development-cli/config/bench_core.toml`. To add a new benchmark, please include it in this configuration file.

## Shell Completion

The Chipmunk CLI tool supports shell completion for various shells. You can generate shell completions and print them to `stdout` using the following command:

```bash
cargo chipmunk shell-completion <SHELL>
```
Replace `<SHELL>` with the name of your shell (e.g., bash, zsh, fish, powershell).

To use shell completion, you can redirect the output of the completion command to a file and save the file to the appropriate shell completion directory.

After installing the completion script, restart your shell session or source the completion file to enable shell completion for the Chipmunk CLI tool.


### Example: Bash Shell
To enable bash shell completion, run the following command to generate the completion script and save it to a file:

```bash
cargo chipmunk shell-completion bash > chipmunk-completion.bash
```
Next, copy the chipmunk-completion.bash file to your bash completion directory (typically  ~/.bash_completion.d/ or /etc/bash_completion.d/).

## Changelogs:

Changelogs can be found [here](CHANGELOG.md)

## Contributing

Contributions in any part of Chipmunk are very welcome!

After making any changes to this build CLI tool, please run the integration tests to ensure that all the provided commands in this tool are still working as expected. Additionally, consider adding new tests when introducing new features and commands.

To run all the tests, execute the Python file `chipmunk/cli/development-cli/integration_tests/run_all.py` from within the `chipmunk/cli/development` directory. For example:

```bash
# Move to cli directory
cd cli
# Run python file
python ./integration_tests/run_all.py
```
Please be aware that these tests will run on your local copy of Chipmunk. This process will rebuild the project and run all linting and tests on the entire solution.

For more details, please see our [contribution guid](../../contribution.md)

