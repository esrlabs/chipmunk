<!--TODO AAZ: Update links once merged into master by removing `plugins_support`-->
# Chipmunk Plugins API Crate

This crate simplifies the development of plugins for [Chipmunk](https://github.com/esrlabs/chipmunk) in Rust.  

Chipmunk supports plugins using [WebAssembly (Wasm)](https://webassembly.org/) and the [WebAssembly Component Model](https://component-model.bytecodealliance.org/). It exposes its public API via the [WASM Interface Format (WIT)](https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md), enabling developers to write plugins in any language that supports Wasm and the Component Model.

For a detailed guide on developing plugins, refer to the [Plugins Development Guide](https://github.com/esrlabs/chipmunk/blob/plugins_support/plugins/README.md).

## What This Crate Provides

This crate provides utilities to streamline plugin development in Rust by:

- Generating Rust types for `WIT` definitions.
- Defining traits that plugins must implement based on their type.
- Providing helper functions for logging and configuration extraction to reduce boilerplate.
- Offering export macros to generate the necessary bindings for your structs to function as Chipmunk plugins.

## Plugin Types:

Each plugin type is associated with a feature in this crate. A feature must be enabled when adding this crate as a dependency, or the build will fail.

### Parser Plugins:
* To develop a parser plugin, enable the `parser` feature in `Cargo.toml`.
* Implement `Parser` trait on your struct to define a parser plugin.
* Use `parser_export!()` macro with your struct to generate the necessary bindings for integration with Chipmunk.
* Please refer to the [examples](https://github.com/esrlabs/chipmunk/blob/plugins_support/plugins/examples) and [parser template](https://github.com/esrlabs/chipmunk/blob/plugins_support/plugins/templates/parser_template) provided in Chipmunk repo to get started.


### Byte-Source Plugins:

> **NOTE:** Byte-Source plugins are not yet supported in Chipmunk. 

* To develop a byte-source plugin, enable the `bytesource` feature in `Cargo.toml`.
* Implement `ByteSource` trait on your struct to define a byte-source plugin.
* Use `bytesource_export!()` macro with your struct to generate the necessary bindings for integration with Chipmunk.
<!--TODO: Update here once template for byte-source is done. -->
* Please refer to the [examples](https://github.com/esrlabs/chipmunk/blob/plugins_support/plugins/examples) provided in Chipmunk repo to get started.
