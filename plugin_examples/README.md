<!-- TODO: Provide links here once solution is finalized and crate `plugins-api` is published -->

# Chipmunk Plugins Development Guide

This guide provides an overview of how to develop plugins for Chipmunk applications. Chipmunk leverages WebAssembly (WASM) and the Component Model to enable a flexible plugin architecture. Whether you’re using Rust or another language that can compile to WASM, this document will help you get started.

---

## Table of Contents

- [Overview](#overview)
- [Plugin Architecture](#plugin-architecture)
- [Developing Plugins with Rust](#developing-plugins-with-rust)
  - [Prerequisites](#prerequisites)
  - [Building and Integrating Plugins](#building-and-integrating-plugins)
- [Plugin Configuration](#plugin-configuration)
- [Plugin Types](#plugin-types)
  - [Parser Plugins](#parser-plugins)
  - [Byte-Source Plugins](#byte-source-plugins)
- [Developing Plugins in Other Languages](#developing-plugins-in-other-languages)
- [Useful Tools](#useful-tools)
- [Additional Resources](#additional-resources)

---

## Overview

Chipmunk supports plugins built as WebAssembly components. The plugins system uses [WIT](https://component-model.bytecodealliance.org/design/wit.html) files to define plugin types and the API, allowing developers to write plugins in any language that supports the WASM component model.

---

## Plugin Architecture

- **WASM & Component Model:** Chipmunk plugins are compiled to WASM and follow the component model.  
- **WIT Files:** These files define the plugin API and types, ensuring consistent contracts between plugins and the host application.  
- **Language Flexibility:** Although Rust is fully supported (with the provided [`plugins-api`](#???)), you can develop plugins in any language that compiles to WASM and adheres to the component model.

---

## Developing Plugins with Rust

For Rust developers, we provide a dedicated crate ([`plugins-api`](#)) that abstracts the details of working directly with WIT files. This crate generates Rust types from WIT, converts WIT contracts into traits and functions, also providing macros to export your Rust types back to WIT, alongside with multiple helpful function.

### Prerequisites

#### WASM & WASI Targets

Ensure that your Rust development environment is set up with the required targets:

- **Targets Needed:**
  - `wasm32-unknown-unknown`
  - `wasm32-wasip1`

You can check the installed targets with:

```sh
rustup target list --installed
```

To add the necessary targets, run:

```sh
# Add the wasm32-wasi target:
rustup target add wasm32-wasi 

# Add the wasm32-unknown-unknown target:
rustup target add wasm32-unknown-unknown
```

#### Cargo Component

[cargo component](https://github.com/bytecodealliance/cargo-component) is a Cargo subcommand that simplifies creating WebAssembly components with Rust. This tool is required for compiling the example plugins and is highly recommended when developing new plugins.

#### Wasm-tools (Optional)

[wasm-tools](https://github.com/bytecodealliance/wasm-tools) provide additional CLI and Rust libraries for low-level manipulation of WASM modules. While not required, these tools can be helpful for inspecting, merging, and manipulating WASM modules.

### Building and Integrating Plugins

To build a plugin:

- **Development Build:**  
  ```sh
  cargo component build
  ```
- **Release Build:**  
  ```sh
  cargo component build -r
  ```

The build process will generate a WASM file named after your plugin. To integrate this plugin with Chipmunk:

1. **Create the Plugin Directory:**  
   Create a directory within the appropriate plugin type folder (for example, `<HOME>/.chipmunk/plugins/parser/` for parser plugins or `<HOME>/.chipmunk/plugins/bytesource/` for byte-source plugins) using the plugin name.

2. **Copy Artifacts:**  
   Place the compiled WASM file in the directory. You may also include an optional TOML file containing plugin metadata (such as the plugin name and description).

---

## Plugin Configuration

Plugins can define their own configuration schemas. These schemas are presented to users so they can provide the necessary settings. The configuration is then delivered back to the plugin during the session initialization phase. For details on schema definitions, refer to:
- The [WIT definitions](#???).
- The [`plugins-api`](#???) crate documentation.
- The provided examples.

---

## Plugin Types

Chipmunk currently supports two main types of plugins:

### Parser Plugins

**Purpose:**  
Parser plugins receive an array of bytes, attempt to parse them, and return the parsed items. They can also define configuration schemas and specify rendering options if needed.

**Development in Rust:**  
- Implement a struct that adheres to the `Parser` trait defined in the [`plugins-api`](#???) crate.
- Use the `parser_export!()` macro to export your parser struct.

The [`plugins-api`](#???) crate also offers helper functions for logging and configuration management.

**Integration:**  
- Create a directory at `<HOME>/.chipmunk/plugins/parser/<plugin-name>/`.
- Copy the compiled WASM file (and optionally a metadata TOML file) into this directory.

For reference, see the `string_parser` and `dlt_parser` examples.

### Byte-Source Plugins

**Purpose:**  
Byte-source plugins deliver arrays of bytes of a specified length during each load call. These bytes are then processed by a selected parser. Like parser plugins, they can define configuration schemas that are provided during session initialization.

**Development in Rust:**  
- Implement a struct that adheres to the `ByteSource` trait defined in the [`plugins-api`](#???) crate.
- Use the `bytesource_export!()` macro to export your byte-source struct.

The [`plugins-api`](#???) crate again provides helper functions for logging and configuration management.

**Integration:**  
- Create a directory at `<HOME>/.chipmunk/plugins/bytesource/<plugin-name>/`.
- Copy the compiled WASM file (and optionally a metadata TOML file) into this directory.

For further details, refer to the `file_source` example.

---

## Developing Plugins in Other Languages

Plugins can also be developed in any language that supports compiling to WASM with the component model. The API and plugin types are defined via the WIT files. Consult your language’s tooling or community resources for guidance on integrating with the WASM component model.

### Useful Tools

#### Wit-bindgen

[wit-bindgen](https://github.com/bytecodealliance/wit-bindgen) is a bindings generator for WIT and the WASM Component Model. It supports multiple languages, including Rust, C/C++, C#, and Java, and can help generate the necessary bindings from your WIT files.

---

## Additional Resources

- **WIT Specifications:** [WIT on GitHub](https://component-model.bytecodealliance.org/design/wit.html)
- **Cargo Component:** [cargo component GitHub Repository](https://github.com/bytecodealliance/cargo-component)
- **Wasm-tools:** [Wasm-tools GitHub Repository](https://github.com/bytecodealliance/wasm-tools)
- **Plugins API Crate Documentation:** [Plugins API](#???)
