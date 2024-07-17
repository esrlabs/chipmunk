// Calling generate! Macro multiple time on the same crate causes compilation errors with `cargo
// component` in release mode.

#[cfg(feature = "bytesource")]
/// Provides types, methods and macros to write plugins that provide byte source functionality
pub mod bytesource;

#[cfg(feature = "parser")]
/// Provides types, methods and macros to write plugins that provide parser functionality
pub mod parser;

// `log` crate must be reexported because we use it withing our macros
pub use log;

mod plugin_logger;
// This is needed to be public because it's used in the export macro
#[doc(hidden)]
pub use plugin_logger::{LogSend as __LogSend, PluginLogger as __PluginLogger};
