// Activate the banner on docs explaining that the items is only available with specific feature
// `doc_cfg` is chosen over `doc_auto_cfg` to provide the exact feature name and not show every
// conditional compilation detail in the docs, even it would require to specify the cfg_attr on
// every conditional public module.
#![cfg_attr(docsrs, feature(doc_cfg))]

//! This library provides types, functions and macros to write plugins for [Chipmunk](https://github.com/esrlabs/chipmunk).
//!
//! The provided types and functions match the definitions from the `WIT` files defined in Chipmunk
//! repository.
//!
//! TODO: This is basic documentation that need a lot of improvements and examples
//!

// NOTE: Calling generate! Macro multiple time on the same crate causes compilation errors with `cargo
// component` in release mode.

#[cfg(feature = "bytesource")]
#[cfg_attr(docsrs, doc(cfg(feature = "bytesource")))]
pub mod bytesource;

#[cfg(feature = "parser")]
#[cfg_attr(docsrs, doc(cfg(feature = "parser")))]
pub mod parser;

// `log` crate must be reexported because we use it withing our macros
pub use log;

mod plugin_logger;

// This is needed to be public because it's used in the export macro
#[doc(hidden)]
pub use plugin_logger::{LogSend as __LogSend, PluginLogger as __PluginLogger};
