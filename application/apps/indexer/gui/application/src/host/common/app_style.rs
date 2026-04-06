use egui::Style;

/// Applies global style settings to the provided `style` object.
pub fn global_styles(style: &mut Style) {
    // We expect the labels to be not selectable by default.
    style.interaction.selectable_labels = false;

    //TODO AAZ: Workaround until issue with egui_table is fixed.
    // Issue Link: https://github.com/rerun-io/egui_table/issues/56
    style.debug.warn_if_rect_changes_id = false;
}
