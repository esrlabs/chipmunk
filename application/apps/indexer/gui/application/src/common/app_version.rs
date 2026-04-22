//! Shared access to the application's embedded version metadata.

use std::sync::LazyLock;

use semver::Version;

/// Current application version embedded in the binary.
pub const CURRENT_VERSION_STR: &str = env!("CARGO_PKG_VERSION");

/// Returns the parsed current application version.
pub fn current_version() -> &'static Version {
    static CURRENT_VERSION: LazyLock<Version> = LazyLock::new(|| {
        Version::parse(CURRENT_VERSION_STR).unwrap_or_else(|_| Version::new(0, 0, 0))
    });

    &CURRENT_VERSION
}
