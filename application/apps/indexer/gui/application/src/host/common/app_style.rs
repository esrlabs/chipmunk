use egui::{FontFamily, FontId, Style, TextStyle};

/// Applies global style settings to the provided `style` object.
pub fn global_styles(style: &mut Style) {
    // We expect the labels to be not selectable by default.
    style.interaction.selectable_labels = false;

    // Reduce monospace fonts default size.
    const MONOSPACE_FONT_SIZE_DELTA: f32 = 1.5;
    if let Some(body_font) = style.text_styles.get(&TextStyle::Body) {
        style.text_styles.insert(
            TextStyle::Monospace,
            FontId::new(
                (body_font.size - MONOSPACE_FONT_SIZE_DELTA).max(1.0),
                FontFamily::Monospace,
            ),
        );
    }

    //TODO AAZ: Workaround until issue with egui_table is fixed.
    // Issue Link: https://github.com/rerun-io/egui_table/issues/56
    #[cfg(debug_assertions)]
    {
        style.debug.warn_if_rect_changes_id = false;
    }
}
