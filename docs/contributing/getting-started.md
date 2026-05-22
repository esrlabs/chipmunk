# Getting Started

This guide covers the one-time setup required to build and run Chipmunk locally.

## Prerequisites

### Installing Rust

Install Rust using the official instructions for your operating system:

[Install Rust](https://www.rust-lang.org/tools/install)

### Installing just

Chipmunk uses [`just`](https://github.com/casey/just) to run common development tasks from the repository root. Install it using one of the methods listed in the project README:

[Install just](https://github.com/casey/just)

## Verify Your Setup

From the repository root, list the available development recipes:

```sh
just --list
```

If the command prints the available recipes, your basic setup is ready.

## Next Steps

Continue with [Repository Structure](./repository-structure.md) to understand the main project areas, then read the [Development Guide](./development-guide.md) for the common workflow.
