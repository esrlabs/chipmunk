# Plugins Development in C/C++

Chipmunk's plugin system, built on WebAssembly and the Component Model, supports developing plugins using C/C++. This document will help you get started with C/C++ plugin development.

## Prerequisites

Developing plugins in C/C++ requires having the following tools and SDKs on the developer's machine:

### wit-bindgen

The [wit-bindgen CLI tool](https://github.com/bytecodealliance/wit-bindgen) is required to generate C/C++ types and function declarations from the [WASM Interface Format (WIT)](https://component-model.bytecodealliance.org/design/wit.html) files. While pre-generated header and source files are included in the [C/C++ templates](https://github.com/esrlabs/chipmunk/tree/master/plugins/templates/c-cpp/), `wit-bindgen` is still needed to generate the `parse_component_type.o` file.

### Chipmunk Plugins WIT Definitions

To generate the specific C/C++ functions and types that interface with Chipmunk, developers need to have the [Chipmunk plugins WIT files](https://github.com/esrlabs/chipmunk/tree/master/plugins/plugins_api/wit) available locally on their machines.

### WASI SDK

The [WASI SDK](https://github.com/webassembly/wasi-sdk) is required for compiling C/C++ code into WASM/WASI binaries. Developers need to download the latest version locally and provide its path to the `Makefile` within the plugin templates.

### wasm-tools

The [wasm-tools](https://github.com/bytecodealliance/wasm-tools) suite is required for converting compiled WASM binaries into WASM Component binaries, which embed the WIT interfaces. `wasm-tools` also provides various useful commands for WebAssembly development.

### WASI Reactor

A WASI adapter is required to provide WASI functionalities when creating a WASM component ([more information](https://github.com/bytecodealliance/wit-bindgen/tree/main?tab=readme-ov-file#creating-components-wasi)). `Wasmtime` provides its own adapter, `wasi_snapshot_preview1.reactor.wasm`, which can be downloaded from their [latest releases](https://github.com/bytecodealliance/wasmtime/releases/latest). When developing plugins using the provided templates, the `Makefile` will automatically download the latest version into the plugins directory if a local path is not supplied.

## Plugin Template Starters

Starting plugin development in C/C++ can be complex. To simplify this, we provide [starter templates](https://github.com/esrlabs/chipmunk/tree/master/plugins/templates/c-cpp/) for each plugin type, available for both C and C++. These templates offer a pre-configured structure to organize your source files, generated bindings, vendor dependencies, and build scripts. 
They also include fully working plugin examples that demonstrate all functionalities provided by the Chipmunk host to plugins, as well as the functionalities plugins need to implement, serving as simple showcases.

Each template includes a well-documented `Makefile` that streamlines the compilation process into a final WebAssembly (WASM) component. This `Makefile` handles several key steps automatically:

* **Generating Bindings:** Creates the necessary Wasmtime bindings from your WIT definitions.
* **WASI Reactor Management:** Downloads the WASI reactor (`wasi_snapshot_preview1.reactor.wasm`) if a local path isn't provided.
* **Component Conversion:** Transforms the intermediate WASM module into a fully-fledged WASM component, embedding its WIT interfaces.

### Makefile Configuration

The `Makefile` requires you to specify the paths for the mandatory `WASI SDK` and `Chipmunk WIT Files`. You can also optionally provide the path to your locally installed `wasi_snapshot_preview1.reactor.wasm` file to prevent redundant downloads for each plugin.

## Manual Plugin Development: Step-by-Step

This section details the manual steps involved in compiling a C/C++ plugin into a WebAssembly Component. This information is useful for understanding the underlying mechanics automated by the provided templates, or for developing plugins from scratch without relying on them.

### 1. Generate WIT Bindings

The first step is to generate the C/C++ bindings from Chipmunk's WIT Definitions. Developers use the [wit-bindgen CLI tool](https://github.com/bytecodealliance/wit-bindgen) for this purpose, specifying the path to the WIT root for the desired API version and the 'world' (plugin type) for which to generate bindings.

Here is an example for generating bindings for a parser plugin with API version `0.1.0`:

```sh
wit-bindgen c {path_to_plugins_api_crate}/wit/v0.1.0/ -w chipmunk:parser/parse --out-dir .
```

This command generates `parse.c`, `parse.h`, and `parse_component_type.o` in the current directory. All generated types and functions from the WIT files can then be referenced and used from `parse.h`.

### 2. Compile to WebAssembly Module

After generating the bindings, compile your C/C++ source code into an intermediate WebAssembly module using the `clang` or `clang++` binaries from the [WASI SDK](https://github.com/webassembly/wasi-sdk). Ensure you set the `--sysroot` flag to the `wasi-sysroot` provided by the SDK and `-mexec-model` to `reactor`.

#### Compiling a Parser Plugin in C

This command compiles the source code of a parser plugin into an intermediate WebAssembly module file:

```sh
{path_to_wasi_sdk}/bin/clang --sysroot={path_to_wasi_sdk}/share/wasi-sysroot parse.c parse_component_type.o my_parser.c -o my_parser_intermediate.wasm -mexec-model=reactor
```

#### Compiling a Parser Plugin in C++

C++ plugins require an extra step because `clang` may warn about mixing C and C++ files. First, compile `parse.c` separately:

```sh
{path_to_wasi_sdk}/bin/clang --sysroot={path_to_wasi_sdk}/share/wasi-sysroot parse.c -o parse.o
```
Then, compile the C++ source code into the intermediate WebAssembly module using the compiled binary `parse.o`:
```sh
{path_to_wasi_sdk}/bin/clang++ --sysroot={path_to_wasi_sdk}/share/wasi-sysroot parse.o parse_component_type.o my_parser.c -o my_parser_intermediate.wasm -mexec-model=reactor
```

### 3. Convert to WebAssembly Component

The final step is to convert the compiled WebAssembly module into a WebAssembly Component file. This component includes embedded WIT metadata. This step requires [wasm-tools](https://github.com/bytecodealliance/wasm-tools) and the `wasi_snapshot_preview1.reactor.wasm` adapter (which should be downloaded locally, as detailed in the [WASI Reactor](#wasi-reactor) section).

The command to convert the module and generate the final component in our example is:

```sh
wasm-tools component new my_parser_intermediate.wasm -o my_parser.wasm --adapt=${path_to_wasi_reactor_file}
```
This command generates the `my_parser.wasm` file, which is ready for integration with Chipmunk.

## Plugin Integration

For comprehensive information on integrating plugins with Chipmunk, refer to the following documents:

* The integration and metadata sections in the [Plugins Development Guide](./development-guide.md).
* The [Plugin Integration in Chipmunk UI](./integration-ui.md) guide.
