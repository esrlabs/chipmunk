# Plugins in Chipmunk Host:

The Chipmunk core supports plugins built with WebAssembly and the Component Model, utilizing the `wasmtime` runtime for compiling and loading plugin binaries.

For a visual representation of the plugins and how they are connected within the data ingestion pipeline, please refer to the [diagram](./producer-plugins.svg).

## Plugins Runtime

Chipmunk utilizes a single `wasmtime` runtime engine that is shared by all loaded plugins and the core plugin management logic. This design aligns with the recommended usage pattern for `wasmtime`.

This shared runtime is very reliable. If a plugin crashes or has an error (panics), it won't crash the main runtime or stop other plugins or tasks that are running.

## Plugins Manager

The `PluginsManager` is a central component responsible for the life cycle of all available plugins. Its duties include scanning, loading, validating, and managing the metadata and configuration of plugins. It also provides functionality for adding and removing plugins without requiring manual file operations by the user.

On startup, the `PluginsManager` scans the designated plugins directory (`<HOME>/.chipmunk/plugins`). It attempts to load and validate the WebAssembly binaries found there and extract essential information like versions and configuration schemas directly from the binaries' metadata.

To optimize startup performance, the `PluginsManager` employs a caching mechanism. After the initial scan, extracted plugin metadata, configurations, and a hash of the binary are saved to a cache file (located within the plugins directory). On subsequent runs, unchanged plugins are loaded directly from this cache, avoiding the need to recompile and re-extract their information from the binary. The cache can typically be invalidated or reloaded via a UI action.

The `PluginsManager` keeps track of all loaded plugins, their current state, and configurations, making them available to the rest of the Chipmunk application, such as providing loaded plugins to the `UnboundSession` view in the UI.

## Plugin Hosts (Parser and Byte-Source)

For each activated plugin instance (Parser or Byte-Source), a corresponding host-side "Plugin Host" struct is created. These host structs act as wrappers, encapsulating all communication with the Wasm plugin binary and managing aspects specific to that plugin type and its API version.

### Parser Plugin Host

The Parser Plugin Host specifically manages interactions with a Wasm Parser plugin. It internally handles communication across the Wasm boundary and translates between the plugin's version-specific data types (defined by the WIT contract for that API version) and the general data types used throughout Chipmunk. It encapsulates support for different API versions, potentially by containing version-specific bindings or logic. This host is responsible for loading and validating its specific plugin binary instance and implementing the host functions (like logging, temporary directory access) that the Wasm plugin may call. It delivers the parsed items received from the plugin according to the `Parser` trait contract used within Chipmunk.

### Byte-Source Plugin Host

Similar to the Parser Plugin Host, the Byte-Source Plugin Host encapsulates communication and version management for a Wasm Byte-Source plugin. Its implementation, however, leverages Chipmunk's internal `BinaryByteSource` helper struct.

The host-side Byte-Source Plugin struct implements the standard Rust `Read` trait. This implementation is responsible for communicating with the Wasm plugin binary to poll and retrieve chunks of raw bytes whenever the host needs more data.

Chipmunk provides a generic struct, `BinaryByteSource`, which is designed to wrap any type that implements the `std::io::Read` trait. The Byte-Source Plugin Host utilizes `BinaryByteSource`, wrapping its own `Read` implementation within it. This allows `BinaryByteSource` to provide the full implementation of the `ByteSource` trait automatically, handling complexities like offset management and stream positioning.

This design ensures that the plugin developer's responsibility is focused on delivering raw bytes when requested via the WASM API (translated to the host's `Read` calls), while the host-side `BinaryByteSource` manages the lower-level details of byte-source behavior and stream management.

## Async Runtime Integration

`Wasmtime` needs a system to handle async tasks when talking to plugins, even in sync environment it will spawn its own tokio runtime and block on it. Chipmunk already uses `Tokio` for its own async tasks. By turning on a setting in our `wasmtime` code, we tell it to use Chipmunk's `Tokio` system instead of starting its own separate one. This helps things run smoothly and keeps all async tasks working together efficiently.
