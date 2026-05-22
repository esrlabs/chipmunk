# Chipmunk Plugins API Crate

This crate simplifies the development of plugins for [Chipmunk](https://github.com/esrlabs/chipmunk) in Rust.

Chipmunk supports plugins using [WebAssembly (Wasm)](https://webassembly.org/) and the [WebAssembly Component Model](https://component-model.bytecodealliance.org/). It exposes its public API via the [WASM Interface Format (WIT)](https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md), enabling developers to write plugins in any language that supports Wasm and the Component Model.

---

> [!IMPORTANT]
> For the most comprehensive documentation on this API crate, including types, traits, and detailed explanations:
>
> 1.  **Published Documentation:** Visit the official Chipmunk documentation site: [Chipmunk Plugins API Crate Docs](https://esrlabs.github.io/chipmunk/plugins/plugins-api/).
> 2.  **Local Documentation:** Generate it directly from the source code by running `cargo doc --open` from within this crate's directory.

---

## What This Crate Provides

This crate provides utilities to streamline plugin development in Rust by:

- Generating Rust types for `WIT` definitions.
- Defining traits that plugins must implement based on their type.
- Providing helper functions for logging and configuration extraction to reduce boilerplate.
- Offering export macros to generate the necessary bindings for your structs to function as Chipmunk plugins.

---

## Examples and Templates

To help you get started with developing plugins using this API crate, we provide a collection of examples and ready-to-use templates:

* **Plugin Examples:** Explore various plugin implementations in the [Chipmunk Plugins Examples directory](https://github.com/esrlabs/chipmunk/tree/master/plugins/examples).
* **Plugin Templates:** Use these templates as a starting point for your new plugin projects: [Chipmunk Plugins Templates directory](https://github.com/esrlabs/chipmunk/tree/master/plugins/templates).
