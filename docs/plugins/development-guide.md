# Chipmunk Plugins Development Guide

This guide provides an overview of how to develop plugins for Chipmunk applications. Chipmunk leverages WebAssembly (WASM) and the Component Model to enable a flexible plugin architecture. Whether you’re using Rust or another language that can compile to WASM, this document will help you get started.

---

## Overview

Chipmunk supports plugins built as WebAssembly components. The plugins system uses [WASM Interface Format (WIT)](https://component-model.bytecodealliance.org/design/wit.html) files to define plugin types and the API, allowing developers to write plugins in any language that supports the WASM component model.

---

## Plugin Architecture

- **WASM & Component Model:** Chipmunk plugins are compiled to WASM and follow the component model.  
- **WIT Files:** These files define the plugin API and types, ensuring consistent contracts between plugins and the host application.  
- **Language Flexibility:** Although Rust is fully supported (with the provided [`plugins-api`](./plugins-api.md)), you can develop plugins in any language that compiles to WASM and adheres to the component model.

---

## Developing Plugins with Rust

For Rust developers, we provide a dedicated crate [`plugins-api`](./plugins-api.md) that abstracts the details of working directly with WIT files. This crate generates Rust types from WIT, converts WIT contracts into traits and functions, also providing macros to export your Rust types back to WIT, alongside with multiple helpful function.

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

After developing your plugin, the next step is to build it into a WebAssembly component and integrate it with Chipmunk.

To build your plugin:

- **Development Build:**  
  ```sh
  cargo component build
  ```
- **Release Build:**  
  ```sh
  cargo component build -r
  ```

The build process will generate a `.wasm` file named after your plugin.

To integrate this compiled plugin with Chipmunk, you have two primary methods:

1.  **Manual Integration:**
    * **Create the Plugin Directory:** Create a dedicated directory for your plugin within the appropriate plugin type directory (for example, `<HOME>/.chipmunk/plugins/parsers/` for parser plugins or `<HOME>/.chipmunk/plugins/bytesources/` for byte-source plugins) using the plugin name.
    * **Copy Artifacts:** Place the compiled `.wasm` file inside this newly created plugin directory. Optionally, you can include a TOML file (e.g., `plugin_name.toml`) to provide metadata such as the plugin’s name and description. Ensure that both the `.wasm` binary and the optional `.toml` metadata file (if present) share the same base name as the plugin directory.
    * Additionally, you can include a `README.md` file inside the plugin directory. If present, this file will be rendered directly in the Chipmunk UI, allowing you to provide documentation or usage instructions for your plugin.

2.  **Using the Chipmunk UI:**
    * Within the Chipmunk application, navigate to the `Plugins Manager` view.
    * Click the "Add" button. This will open a dialog where you can select the plugin's root directory. The name of this selected directory should be the plugin's name, and it should contain your compiled `.wasm` file (named to match the directory) and any optional `.toml` metadata file (also named to match) or `README.md`. Chipmunk will then automatically copy and register the plugin.

---

## Developing Plugins with C/C++

Please refer to [C/C++ Plugins Development](./cpp.md) for detailed info developing plugins in C/C++.

---

## Plugin Configuration

Plugins can define their own configuration schemas. These schemas are presented to users so they can provide the necessary settings. The configuration is then delivered back to the plugin during the session initialization phase. For details on schema definitions, refer to:
- The [WIT definitions](https://github.com/esrlabs/chipmunk/tree/master/plugins/plugins_api/wit).
- The [`plugins-api`](https://github.com/esrlabs/chipmunk/tree/master/plugins/plugins_api/) crate documentation.
- The provided examples.

---

## Plugin Types

Chipmunk currently supports two main types of plugins:

### Parser Plugins

#### Purpose:
Parser plugins receive an array of bytes, attempt to parse them, and return the parsed items. They can also define configuration schemas and specify rendering options if needed.

#### Development in Rust: 
* Create a struct that implements to the `Parser` trait defined in the [`plugins-api`](https://github.com/esrlabs/chipmunk/tree/master/plugins/plugins_api/) crate.
* Use the `parser_export!()` macro to export your parser struct.

The [`plugins-api`](https://github.com/esrlabs/chipmunk/tree/master/plugins/plugins_api/) crate also offers helper functions for logging, access to temp directory and configuration management.

#### Integration:
*  Use the "Add" function in the Chipmunk UI Plugins Manager, as described in the [Building and Integrating Plugins](#building-and-integrating-plugins) section.
*  Alternatively, you can manually create a directory at `<HOME>/.chipmunk/plugins/parsers/<plugin-name>/` and copy the compiled WASM file (and optionally metadata TOML and README.md files) into this directory.

To get started quickly, you can use the provided [parser template](https://github.com/esrlabs/chipmunk/tree/master/plugins/templates/rust/parser). Simply copy the `parser` directory and modify it to implement your custom parser.  

For reference, see the `string_parser` and `dlt_parser` examples.

### Byte-Source Plugins

#### Purpose:
Byte-source plugins deliver arrays of bytes of a specified length during each load call. These bytes are then processed by a selected parser. Like parser plugins, they can define configuration schemas that are provided during session initialization.

#### Development in Rust:
- Create a struct that implements to the `ByteSource` trait defined in the [`plugins-api`](https://github.com/esrlabs/chipmunk/tree/master/plugins/plugins_api/) crate.
- Use the `bytesource_export!()` macro to export your byte-source struct.

The [`plugins-api`](https://github.com/esrlabs/chipmunk/tree/master/plugins/plugins_api/) crate again provides helper functions for logging, access to temp directory and configuration management.

#### Integration:
- Use the "Add" function in the Chipmunk UI Plugins Manager, as described in the [Building and Integrating Plugins](#building-and-integrating-plugins) section.
- Alternatively, you can manually create a directory at `<HOME>/.chipmunk/plugins/bytesources/<plugin-name>/` and copy the compiled WASM file (and optionally metadata TOML and README.md files) into this directory.

For further details, refer to the `file_source` example.

---

## Developing Plugins in Other Languages

Plugins can also be developed in any language that supports compiling to WASM with the component model. The API and plugin types are defined via the WIT files. Consult your language’s tooling or community resources for guidance on integrating with the WASM component model.

### Useful Tools

#### Wit-bindgen

[wit-bindgen](https://github.com/bytecodealliance/wit-bindgen) is a bindings generator for WIT and the WASM Component Model. It supports multiple languages, including Rust, C/C++, C#, and Java, and can help generate the necessary bindings from your WIT files.

---

## Plugins Benchmarking:

Chipmunk includes several benchmarks designed to measure the performance of various tasks within your plugins. Each benchmark requires a TOML configuration file that specifies the plugin’s path and other relevant settings. You can refer to the provided templates and examples for more details on how to structure the configuration.  

To run the benchmarks, you first need to install the [Chipmunk development tool](./../contributing/dev-cli.md), which is required for managing and executing these benchmarks.  

Once installed, you can explore the available benchmarking options with the following command to see detailed information about each benchmark:
```sh
cargo chipmunk bench core --help
```

### Plugin Initialization  
This benchmark measures how much time it takes to initialize the plugin with the provided configuration. This is useful for gauging the overhead of loading and setting up the plugin before it begins processing actual data.  

To run this benchmark within the Chipmunk repository, use the following command, substituting `{path_to_plugin_config_file}` with the path to your configuration file:  
```sh
cargo chipmunk bench core plugin_parser_init -c {path_to_plugin_conig_file}.toml
```

### Parser Plugin:
This benchmark is designed to evaluate the performance of parser plugins when processing input files. It simulates the real-world scenario of parsing data and allows you to measure how well the plugin performs under various conditions.  

Run the benchmark with the following command, replacing `{path_to_input_file}` with the path to the file you want to parse, and `{path_to_plugin_config_file}` with the path to the corresponding configuration file:  

```sh
cargo chipmunk bench core plugin_praser_producer -i {path_to_input_file} -c {path_to_plugin_conig_file}.toml 
```
For a working example of a parser plugin configuration, refer to the [DLT parser config file](https://github.com/esrlabs/chipmunk/tree/master/plugins/examples/rust/dlt_parser/bench_config.toml). This example will help you understand how to structure your configuration for the parser plugin.

---

## Additional Resources

- **WIT Specifications:** [WIT References](https://component-model.bytecodealliance.org/design/wit.html)
- **Cargo Component:** [cargo component GitHub Repository](https://github.com/bytecodealliance/cargo-component)
- **Wasm-tools:** [Wasm-tools GitHub Repository](https://github.com/bytecodealliance/wasm-tools)
- **Plugins API Crate Documentation:** [Plugins API](./plugins-api.md)
- **Chipmiunk Contribution:** [Contribution Page](../contributing/welcome.md)
