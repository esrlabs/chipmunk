# Chipmunk Plugins Overview

This document provides a high-level overview of the plugin system in Chipmunk. Chipmunk's flexible architecture allows users to extend its capabilities by integrating custom functionalities through plugins.

---

> [!IMPORTANT]
> For comprehensive documentation on developing Chipmunk plugins, including detailed guides on architecture, specific plugin types, configuration, benchmarking, and more, please visit the official documentation site: [Chipmunk Plugins Development Guide](https://esrlabs.github.io/chipmunk/plugins/development-guide/)

---

## What are Chipmunk Plugins?

Chipmunk plugins are external modules that enhance the application's ability to process and ingest data. They allow for the integration of new data protocols, formats, and sources that are not natively supported by Chipmunk. Plugins are built as WebAssembly (Wasm) components, leveraging the [WASM Interface Format (WIT)](https://component-model.bytecodealliance.org/design/wit.html) to define their interfaces.

## Key Technologies

Chipmunk's plugin system is built upon modern, secure, and performant technologies:

* **WebAssembly (Wasm):** Provides a safe, sandboxed execution environment with near-native performance.
* **WebAssembly Component Model:** Defines a standard for creating interoperable Wasm modules with rich, type-safe APIs, enabling language-agnostic plugin development.
* **WASI:** Offers a standardized interface for Wasm modules to interact securely with host system resources.

## Benefits of the Plugin System

* **Extensibility:** Easily add support for new data formats and sources.
* **Performance:** Plugins run with performance comparable to native components.
* **Security & Isolation:** Plugins are sandboxed by default, enhancing application stability and security.
* **Language Agnostic:** Developers can write plugins in any language that compiles to Wasm and supports the Component Model.

---

## Getting Started & Resources

To help you begin developing your own Chipmunk plugins, we provide comprehensive resources:

* **Detailed Development Guide:** For in-depth instructions, prerequisites, architecture details, and more, refer to the [Chipmunk Plugins Development Guide](https://esrlabs.github.io/chipmunk/plugins/development-guide/).
* **Plugin Examples:** Explore various plugin implementations in the [Chipmunk Plugins Examples directory](https://github.com/esrlabs/chipmunk/tree/master/plugins/examples).
* **Plugin Templates:** Use these templates as a starting point for your new plugin projects: [Chipmunk Plugins Templates directory](https://github.com/esrlabs/chipmunk/tree/master/plugins/templates).

---

## Developing Plugins with Rust

Rust developers can use the dedicated [`plugins-api`](https://github.com/esrlabs/chipmunk/tree/master/plugins/plugins_api) crate to simplify plugin development, handling WIT interactions, type generation, and export macros. Detailed prerequisites, building instructions with `cargo component`, and integration steps are available in the [full documentation](https://esrlabs.github.io/chipmunk/plugins/development-guide/).
