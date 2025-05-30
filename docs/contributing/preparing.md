### Installing Rust
The recommended way to install Rust is by using **rustup**, the official Rust version manager. Run the following command in your terminal:

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

This command downloads and runs the `rustup` installer. After installation, you can verify the installed Rust version by running:

```sh
rustc --version
```

which should print the Rust version on terminal.

### Installing NodeJS

We recommend using NVM (Node Version Manager) to install and manage Node.js versions. Please follow the [NVM installation guide](https://github.com/nvm-sh/nvm) first.

Once NVM is installed and configured, you can install the latest Long Term Support (LTS) version of Node.js by running:

```sh
nvm install --lts
```
Verify that Node.js is installed correctly by running:

```sh
node -v
```

This will print the installed Node.js version in your terminal.

### Installing Yarn

Chipmunk uses [Yarn](https://yarnpkg.com/) for managing frontend dependencies. While the project specifies a particular Yarn version via Corepack, our current setup still checks for a global Yarn installation.

First, install Yarn globally using `npm`:

```sh
npm install -g yarn
```

Additionally, this project enforces a required Yarn version specified in its `package.json` file to ensure consistent dependency management across all development environments. To automatically use this project-defined version, you need to enable **Corepack**:

```sh
corepack enable
```

Enabling Corepack ensures that when you run `yarn` commands within the Chipmunk project directory, NodeJS will automatically use the version specified by the project, even if a different version is installed globally.

### Installing Project Dependencies

This project relies on external dependencies for both the Rust backend and the Electron/Node.js frontend. To install all necessary project dependencies and tools, run the following script from the repository root:

```sh
sh developing/scripts/install.sh
```

This script will handle installing dependencies required for building and running Chipmunk.

### Installing Chipmunk Development CLI Tool

A custom Command Line Interface (CLI) tool has been implemented to provide an easier way to manage various development tasks specific to Chipmunk.

For installation steps and detailed documentation regarding the Chipmunk Development CLI tool, please refer to its dedicated README file: [Chipmunk Development CLI Tool Documentation](cli/development-cli/README.md).


## Build

Chipmunk consists of a Rust backend for log processing, an Electron/Angular frontend application, and smaller libraries facilitating communication between them. Development tasks across these different components are managed using the [Chipmunk Development CLI Tool](cli/development-cli/README.md).

This tool simplifies common operations such as building, linting, and running various parts of Chipmunk. It automatically handles project dependencies and tracks changes in source files, ensuring that only necessary components are rebuilt.
For comprehensive details on all available commands and functionalities, please consult the documentation for the development CLI tool.

### Building the Application

Use the development CLI tool to build the Chipmunk application:

```sh
# For development build
cargo chipmunk build app

# For production build
cargo chipmunk build app -p
```
These commands automatically determine and build only the components that have changed since the last build, optimizing build times.

### Running the Application

You can similarly use the run command to start the Chipmunk application:

```sh
# Run in development
cargo chipmunk run

# Run in production
cargo chipmunk run -p
```
The run command automatically performs any necessary builds of modified components before launching the application interface, Yay!

### Development CLI Help

To explore the full range of commands and options available with the `cargo chipmunk` development tool, use the `--help` flag:

To list all top-level commands:
```sh
cargo chipmunk --help
```

To view options for a specific command (for example, the `build` command):
```sh
cargo chipmunk build --help
```

## Creating your first PR

Before submitting a Pull Request (PR), please run the linters and tests using the development CLI tool. This helps ensure your changes follow the project's coding style and pass basic automated checks.

To check for formatting issues, code smells, or potential errors, run the linters:

Run linters for the entire project:
```sh
cargo chipmunk lint
```

To run linting for the backend only you can use

```sh
cargo chipmunk lint core binding
```

To run linting for the frontend only you can use

```sh
cargo chipmunk lint shared wrapper client app
```

Ensure your changes are covered by appropriate test cases. Run all test cases to verify that everything is working as expected:

```sh
cargo chipmunk test
```

## Reporting Issues

Your contributions through bug reports and suggestions are greatly appreciated!

If you discover any bugs, have suggestions for improvements, or identify potential issues within Chipmunk, please report them by opening a new issue on the project's GitHub repository. When reporting bugs, providing a clear description and steps to reproduce the issue is very helpful.
