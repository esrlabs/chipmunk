//! Module to interact with UI icons using [Phosphor Icons](https://phosphoricons.com/)

use std::sync::Arc;

use egui::FontFamily;

/// Module contains the keys for phosphor fonts in the application.
pub mod keys {
    /// Key for Regular icons font.
    ///
    /// # Note:
    /// Regular keys are added to the built-in Proportional fonts,
    /// therefore there is no need to specify special font family.
    pub const REGULAR: &str = "phosphor";

    /// Key for Fill icons font.
    ///
    /// # Note:
    /// Regular keys are added to the additional font family with the
    /// FILL key, which must be used with with fill icons.
    pub const FILL: &str = "phosphor-fill";
}

/// Module contains phosphor icons
pub mod icons {
    // Reexport phosphor icons to handle icons from the same module.
    pub use egui_phosphor::{fill, regular};
}

/// Add phosphor icons to app fonts.
pub fn init(egui_ctx: &egui::Context) {
    // Add phosphor icons to app fonts.
    let mut fonts = egui::FontDefinitions::default();

    fonts.font_data.insert(
        keys::REGULAR.into(),
        Arc::new(egui_phosphor::Variant::Regular.font_data()),
    );

    fonts.font_data.insert(
        keys::FILL.into(),
        Arc::new(egui_phosphor::Variant::Fill.font_data()),
    );

    let prop_keys = fonts
        .families
        .get_mut(&egui::FontFamily::Proportional)
        .expect("Proportional fonts must exist");

    let mut fill_keys = prop_keys.to_vec();

    // Use regular by default.
    prop_keys.insert(1, keys::REGULAR.into());

    // Use fill with its own font family
    fill_keys.insert(1, keys::FILL.into());

    fonts
        .families
        .insert(FontFamily::Name(keys::FILL.into()), fill_keys);

    egui_ctx.set_fonts(fonts);
}

#[inline]
pub fn fill_font_family() -> FontFamily {
    FontFamily::Name(keys::FILL.into())
}
