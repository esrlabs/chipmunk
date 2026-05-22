//! Application font setup for the native UI.
//!
//! Registers the bundled proportional, monospace, and icon fonts and applies
//! them to the shared `egui` context during startup.

use std::sync::Arc;

use egui::{FontData, FontDefinitions, FontFamily};

use crate::common::phosphor;

const IBM_PLEX_SANS_REGULAR_KEY: &str = "ibm-plex-sans-regular";
const JETBRAINS_MONO_REGULAR_KEY: &str = "jetbrains-mono-regular";

/// Configure the application's text and icon fonts.
pub fn setup(ctx: &egui::Context) {
    let mut fonts = FontDefinitions::default();

    // IBM Plex Sans
    fonts.font_data.insert(
        IBM_PLEX_SANS_REGULAR_KEY.into(),
        Arc::new(FontData::from_static(include_bytes!(
            "../../data/fonts/IBMPlexSans-Regular.ttf"
        ))),
    );
    fonts.font_data.insert(
        JETBRAINS_MONO_REGULAR_KEY.into(),
        Arc::new(FontData::from_static(include_bytes!(
            "../../data/fonts/JetBrainsMono-Regular.ttf"
        ))),
    );

    // Jet Brains Mono
    fonts
        .families
        .get_mut(&FontFamily::Proportional)
        .expect("Proportional fonts must exist")
        .insert(0, IBM_PLEX_SANS_REGULAR_KEY.into());

    fonts
        .families
        .get_mut(&FontFamily::Monospace)
        .expect("Monospace fonts must exist")
        .insert(0, JETBRAINS_MONO_REGULAR_KEY.into());

    phosphor::init(&mut fonts);

    ctx.set_fonts(fonts);
}
