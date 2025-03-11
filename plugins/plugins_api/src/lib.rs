#![warn(missing_docs)]
// Activate the banner on docs explaining that the items is only available with specific feature
// `doc_cfg` is chosen over `doc_auto_cfg` to provide the exact feature name and not show every
// conditional compilation detail in the docs, even it would require to specify the cfg_attr on
// every conditional public module.
#![cfg_attr(docsrs, feature(doc_cfg))]
// Use the readme as the main documentation page.
#![doc = include_str!("../README.md")]

mod shared;
pub use shared::{
    chipmunk::shared::{logging, shared_types},
    config,
};

/// Contains re-exported logging macros from [`log`] crate to be used inside the plugins.
/// Logs messages will be sent to the host if logging level matches the current log level
/// inside chipmunk.
pub mod log {
    pub use log::{debug, error, info, log, trace, warn};
    // This is needed to be public because it's used in the export macro.
    #[doc(hidden)]
    pub use log::{set_logger as __set_logger, set_max_level as __set_max_level, Level as __Level};
}

// This is needed to be public because it's used in the export macro
#[doc(hidden)]
pub use shared::{
    logging::PluginLogSend as __PluginLogSend,
    plugin_logger::{LogSend as __LogSend, PluginLogger as __PluginLogger},
};

#[cfg(feature = "bytesource")]
#[cfg_attr(docsrs, doc(cfg(feature = "bytesource")))]
pub mod bytesource;

#[cfg(feature = "parser")]
#[cfg_attr(docsrs, doc(cfg(feature = "parser")))]
pub mod parser;

// This is a temporary reminder to include `--all-features` flag with cargo test in CI pipelines.
// This code is activated in tests only if no features is activated, since almost all tests are
// included within the features.
#[cfg(all(test, not(any(feature = "parser", feature = "bytesource"))))]
mod tests {
    #[test]
    fn no_features_error() {
        const BOLD_RED: &str = "\x1b[1;31m";
        const YELLOW: &str = "\x1b[33m";
        const RESET: &str = "\x1b[0m";

        panic!(
            "{BOLD_RED}Error:{RESET} {YELLOW}Tests were run without activating any features.\n\
            This is a reminder to include all features in test in the CI pipeline{RESET}"
        )
    }
}
