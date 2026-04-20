use egui::{FontFamily, FontId, Style, TextStyle, Visuals};

use crate::host::common::colors;

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

    apply_global_color_styles(&mut style.visuals);

    //TODO AAZ: Workaround until issue with egui_table is fixed.
    // Issue Link: https://github.com/rerun-io/egui_table/issues/56
    #[cfg(debug_assertions)]
    {
        style.debug.warn_if_rect_changes_id = false;
    }
}

fn apply_global_color_styles(visuals: &mut Visuals) {
    let dark_mode = visuals.dark_mode;
    let accent_bg = colors::main_accent_background(dark_mode);
    let accent_stroke = colors::main_accent_stroke(dark_mode);
    let hovered_fill = if dark_mode {
        accent_bg.gamma_multiply(1.08)
    } else {
        accent_bg.gamma_multiply(0.96)
    };
    let active_fill = if dark_mode {
        accent_bg.gamma_multiply(1.18)
    } else {
        accent_bg.gamma_multiply(0.9)
    };

    // `faint_bg_color` should be darker than the general background in light mode.
    if !dark_mode {
        visuals.faint_bg_color = egui::Color32::from_gray(246);
    }

    visuals.selection.bg_fill = active_fill;
    visuals.selection.stroke.color = accent_stroke;

    visuals.widgets.hovered.weak_bg_fill = hovered_fill;
    visuals.widgets.hovered.bg_fill = hovered_fill;
    visuals.widgets.hovered.bg_stroke.color = accent_stroke;

    visuals.widgets.active.weak_bg_fill = active_fill;
    visuals.widgets.active.bg_fill = active_fill;
    visuals.widgets.active.bg_stroke.color = accent_stroke;

    visuals.widgets.open.weak_bg_fill = active_fill;
    visuals.widgets.open.bg_fill = active_fill;
    visuals.widgets.open.bg_stroke.color = accent_stroke;
}
