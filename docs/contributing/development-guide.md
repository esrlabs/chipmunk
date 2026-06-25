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

For crates in the main workspace under `crates/`, declare dependency versions and internal crate paths only in the root `Cargo.toml` under `[workspace.dependencies]`.

In crate-local `Cargo.toml` files, reference dependencies with `workspace = true` and keep them in the matching group:

```toml
[dependencies]
# Internal crates
stypes.workspace = true

# External crates
serde.workspace = true
```

Keep the root workspace dependency list grouped by internal crates, external dependencies, and development dependencies.

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
