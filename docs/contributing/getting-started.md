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

## Repository Context

`.ai/` holds the shared context of this repository, written for developers and agents alike: orientation on the modules in `knowledge/`, the code rules every change and review follows in `rules/`, and recurring maintenance processes in `workflows/`.

Start at [`.ai/INDEX.md`](https://github.com/esrlabs/chipmunk/blob/master/.ai/INDEX.md), which links to the rest. Agents reach the same content through `AGENTS.md` in the repository root.

## Next Steps

Continue with [Repository Structure](./repository-structure.md) to understand the main project areas, then read the [Development Guide](./development-guide.md) for the common workflow.
