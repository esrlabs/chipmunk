use egui::Style;

/// Applies global style settings to the provided `style` object.
pub fn global_styles(style: &mut Style) {
    // We expect the labels to be not selectable by default.
    style.interaction.selectable_labels = false;
}
