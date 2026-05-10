//! Keyboard shortcuts overview modal.

use egui::{Align, Context, Grid, Label, Layout, RichText, ScrollArea, Ui, scroll_area, vec2};

use crate::common::ui::{
    buttons,
    modal::{ModalSize, ResponsiveModalSize, show_modal},
};

use super::definitions::{Shortcut, ShortcutDisplay, app_shortcut_defs};

const SHORTCUTS_MODAL_SIZE: ResponsiveModalSize = ResponsiveModalSize {
    width_ratio: 0.55,
    height_ratio: 0.65,
    min_size: vec2(600.0, 420.0),
    max_size: vec2(900.0, 720.0),
    window_padding: vec2(20.0, 40.0),
};

const SHORTCUT_COLUMN_MAX_WIDTH: f32 = 220.0;
const SECTION_TITLE_ROW_HEIGHT: f32 = 32.0;

/// Renders the shortcuts modal and returns true when it should close.
pub fn render_modal(parent_ui: &Ui) -> bool {
    let mut scroll_area_id = None;
    let modal = show_modal(
        parent_ui,
        "shortcuts",
        ModalSize::Responsive(SHORTCUTS_MODAL_SIZE),
        |ui, _size| {
            ui.vertical_centered(|ui| {
                ui.heading("Keyboard shortcuts");
            });
            ui.add_space(8.0);

            let scroll_area = ScrollArea::vertical()
                .id_salt("shortcuts_overview")
                .auto_shrink([false, false])
                .show(ui, |ui| {
                    ui.set_width(ui.available_width());

                    let app_shortcuts = app_shortcut_defs();
                    let session_shortcuts = crate::session::ui::shortcut_defs();
                    render_shortcuts_grid(&app_shortcuts, &session_shortcuts, ui);
                });
            scroll_area_id = Some(scroll_area.id);

            ui.add_space(8.0);
            ui.vertical_centered(|ui| {
                if ui.add(buttons::command("Close", None)).clicked() {
                    ui.close();
                }
            });
        },
    );

    let should_close = modal.should_close();
    if should_close && let Some(scroll_id) = scroll_area_id {
        parent_ui.data_mut(|data| {
            data.remove::<scroll_area::State>(scroll_id);
        });
    }

    should_close
}

fn render_shortcuts_grid(
    app_shortcuts: &[&Shortcut],
    session_shortcuts: &[&Shortcut],
    ui: &mut Ui,
) {
    const GRID_SPACING: egui::Vec2 = vec2(24.0, 4.0);

    Grid::new("shortcuts_grid")
        .num_columns(2)
        .spacing(GRID_SPACING)
        .striped(true)
        .show(ui, |ui| {
            render_section("Application", app_shortcuts, ui);
            render_section("Session", session_shortcuts, ui);
        });
}

fn render_section(title: &str, shortcuts: &[&Shortcut], ui: &mut Ui) {
    ui.allocate_ui_with_layout(
        vec2(SHORTCUT_COLUMN_MAX_WIDTH, SECTION_TITLE_ROW_HEIGHT),
        Layout::left_to_right(Align::Center),
        |ui| {
            const SECTION_TITLE_SIZE: f32 = 15.0;

            ui.label(RichText::new(title).strong().size(SECTION_TITLE_SIZE));
        },
    );
    ui.allocate_space(vec2(ui.available_width(), SECTION_TITLE_ROW_HEIGHT));
    ui.end_row();

    for shortcut in shortcuts {
        if matches!(shortcut.display, ShortcutDisplay::Skip) {
            continue;
        }

        render_shortcut_row(shortcut, ui);
    }
}

fn render_shortcut_row(shortcut: &Shortcut, ui: &mut Ui) {
    let row_height = ui.spacing().interact_size.y;
    ui.allocate_ui_with_layout(
        vec2(SHORTCUT_COLUMN_MAX_WIDTH, row_height),
        Layout::left_to_right(Align::Center),
        |ui| {
            let binding = binding_text(ui.ctx(), shortcut);
            ui.add(Label::new(RichText::new(binding).monospace()).truncate());
        },
    );
    ui.allocate_ui_with_layout(
        vec2(ui.available_width(), row_height),
        Layout::left_to_right(Align::Center),
        |ui| {
            ui.add(Label::new(RichText::new(shortcut.description)).truncate());
        },
    );
    ui.end_row();
}

fn binding_text(ctx: &Context, shortcut: &Shortcut) -> String {
    if let ShortcutDisplay::OverrideText(text) = shortcut.display {
        return text.to_owned();
    }

    let mut text = String::new();
    for (idx, binding) in shortcut.bindings.iter().enumerate() {
        if idx > 0 {
            text.push_str(" / ");
        }
        text.push_str(&ctx.format_shortcut(binding));
    }

    text
}
