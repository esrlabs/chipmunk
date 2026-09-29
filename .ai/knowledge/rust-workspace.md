# Rust Workspace Context

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

## Utility Crates

Small, self-contained crates under `crates/`. Read the crate source directly; they need no separate context file.

- `bufread`: buffered reader that refills while unread data is still buffered.
- `dir_checksum`: recursive directory checksums honoring `gitignore` rules.
- `file_tools`: file content classification, such as the UTF-8 text check.
- `shell_tools`: discovery of installed shell profiles on the current platform.
