# Rust Rules

## Scope

Applies to all Rust code in this repository.
GUI code follows `.ai/rules/app-ui.md` in addition to this file.

## Design and Scope

- Prefer the smallest correct change that fully solves the problem. Between valid approaches, take the one with less incidental complexity.
- Keep behavior in the module or type that already owns the relevant state and responsibility.
- Fix, replace, or remove a problematic design instead of wrapping it in compatibility layers, adapters, flags, or one-off branches.

## Naming

- Name every item for its domain role: what a function does, what a type represents, what a value means — not for the call site that uses it, its storage type, or the implementation phase it belongs to.

## Correctness and Performance

- Keep async code non-blocking. Isolate blocking calls explicitly, for example with `spawn_blocking`.
- In compare, validate, reset, and sync logic, destructure structs and match enums exhaustively, without `..` rest patterns or catch-all arms, so that a new field or variant fails to compile and forces the code to be revisited.
- Do not derive `Copy` by default. Reserve it for small value types where implicit duplication is obviously cheap, and use `Clone` otherwise.

## Red Flag: User-Facing Text in Logic

Never implement or preserve application logic that matches, parses, or compares human-readable text: error messages, notification and toast copy, dialog copy, labels, or any other user-facing string. Carry that information in types instead.

## Modules and Visibility

- Split a file at a clear submodule boundary as it grows. Files beyond roughly 550 lines usually have one.
- Treat `pub(crate)`, `pub(super)`, and `pub(in ...)` as exceptions with a concrete reason, not as safer defaults. Prefer plain `pub`.
- Do not repeat scoped visibility on the inherent methods of a type that already defines the visibility boundary.
- Prefer `use` statements over fully qualified paths, and keep full paths only for disambiguation. Order imports: standard library, external crates, workspace crates, then `crate`, `self`, and `super`.

## Documentation and Comments

- Write `//!` module docs, and `///` docs for public types, public fields, and public functions.
- Keep `///` docs on the external contract and observable behavior. Explain implementation, control flow, and borrow reasoning in `//` comments inside the body.
- Comment non-obvious intent, invariants, edge cases, unsafe blocks, concurrency assumptions, and code shaped to avoid a specific bug or regression. Do not comment what the code already says.
- Document functions returning `bool` unless the name makes `true` and `false` unambiguous.
- No emojis in code or comments.

## Tests

- A test must protect a real behavior regression. If it does not, drop it and pick a higher-signal scenario.
- Do not add or keep low-signal tests: constructor storage checks, passthrough wrappers, shape-only assertions, or getter and setter coverage.
- Delete or update tests that survive only to preserve obsolete implementation details.
- Keep tests deterministic. Control clocks, randomness, and external effects.
- Do not change production code only for testability without asking first.
