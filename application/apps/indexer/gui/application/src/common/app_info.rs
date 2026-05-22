//! Shared application identity and embedded metadata.

use std::sync::LazyLock;

use semver::Version;

/// User-facing application title.
pub const TITLE: &str = "Chipmunk";

/// Current application version embedded in the binary.
pub const VERSION_STR: &str = env!("CARGO_PKG_VERSION");

/// Returns the parsed current application version.
pub fn current_version() -> &'static Version {
    static CURRENT_VERSION: LazyLock<Version> =
        LazyLock::new(|| Version::parse(VERSION_STR).unwrap_or_else(|_| Version::new(0, 0, 0)));

    &CURRENT_VERSION
}

/// Returns the embedded window icon.
pub fn icon() -> egui::IconData {
    let icon_bytes = include_bytes!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../../../holder/resources/icons/png/icon.png"
    ));

    match eframe::icon_data::from_png_bytes(icon_bytes) {
        Ok(icon) => icon,
        Err(err) => {
            #[cfg(debug_assertions)]
            panic!("Failed to load app icon: {err}");

            #[cfg(not(debug_assertions))]
            {
                log::warn!("Failed to load app icon: {err}");
                Default::default()
            }
        }
    }
}
