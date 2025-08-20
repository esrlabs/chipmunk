## Development Workflow

Chipmunk consists of a Rust backend for log processing, an Electron/Angular frontend application, and smaller libraries facilitating communication between them. Development tasks across these different components are managed using the [Chipmunk Development CLI Tool](./dev-cli.md).

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
The run command automatically performs any necessary builds of modified components before launching the application interface.

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

## Code Quality Checks

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
