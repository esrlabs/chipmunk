This guide covers the one-time setup required to install all the tools and dependencies you need to build and run Chipmunk.

## Prerequisites

### Installing Rust

To install Rust, follow the official instructions provided on the Rust programming language website. This ensures you are using the recommended method for your specific operating system.

You can find the installation guide at [Install Rust](https://www.rust-lang.org/tools/install)

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


### Installing the Development CLI

This project uses a custom tool, `cargo chipmunk`, to manage development tasks. To install it, navigate to the repository root and run:
```sh 
cargo install --path cli/development-cli
```

After installation, verify it was successful by checking the version:
```sh
cargo chipmunk --version
```

For a complete list of commands, please refer to the [dedicated CLI documentation](./dev-cli.md).

## Verify Your Setup

To confirm that the development environment and all dependencies are correctly installed, run the following command. It will check your setup and print a list of all required tools and their detected versions.

```bash
cargo chipmunk env list
```

If the command runs without errors and you see the list of versions, your setup is complete!

### Next Steps

To learn about the daily workflow for building, running, and testing the application, please proceed to the next guide: [Development Guide](./development-guide.md)

