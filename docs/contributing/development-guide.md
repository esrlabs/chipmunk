# Development Guide

Use `just` from the repository root for common development tasks. To see all available recipes, run:

```sh
just --list
```

## Running the Application

Start the native application with:

```sh
just run
```

You can pass additional Cargo or application arguments after the recipe:

```sh
just run -r -- path/to/file
```

## Dependency Management

Dependency versions and workspace configuration follow the rules in [`.ai/knowledge/rust-workspace.md`](https://github.com/esrlabs/chipmunk/blob/master/.ai/knowledge/rust-workspace.md), which is the single source of truth for them.

## Code Rules

Changes and reviews follow the rules in [`.ai/rules/INDEX.md`](https://github.com/esrlabs/chipmunk/blob/master/.ai/rules/INDEX.md): `rust.md` for all Rust code, plus `app-ui.md` for the GUI crate.

## Formatting and Checks

Check Rust formatting without changing files:

```sh
just fmt-check
```

Format the Rust workspace:

```sh
just fmt
```

Compile all workspace targets without producing final binaries:

```sh
just check
```

Run Clippy for the workspace:

```sh
just clippy
```

Run workspace tests:

```sh
just test
```

Before submitting a pull request, run the full local validation recipe:

```sh
just validate
```

## Reporting Issues

Bug reports and suggestions are welcome. When opening an issue, include a clear description, the expected behavior, the actual behavior, and steps to reproduce when possible.
