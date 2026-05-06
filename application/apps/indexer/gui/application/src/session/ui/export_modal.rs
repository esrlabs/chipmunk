use egui::{
    Align, Button, Frame, Label, Layout, Margin, RichText, ScrollArea, Ui, Widget as _, vec2,
};

use crate::{
    common::modal::{ModalSize, ResponsiveModalSize, show_modal},
    host::ui::UiActions,
    session::ui::shared::export::{ExportState, TextExportModalState, TextExportValidationError},
};

const ACTION_BUTTON_SIZE: egui::Vec2 = vec2(90.0, 25.0);

/// Renders the pending text table export modal and advances its workflow on confirmation.
pub fn render_content(exports: &mut ExportState, actions: &mut UiActions, parent_ui: &Ui) {
    let Some(mut modal_state) = exports.take_text_modal() else {
        return;
    };

    let mut export = false;
    let mut can_export = false;

    let modal = show_modal(
        parent_ui,
        "text_export_modal",
        ModalSize::Responsive(ResponsiveModalSize {
            width_ratio: 0.5,
            height_ratio: 0.90,
            min_size: vec2(420.0, 280.0),
            max_size: vec2(600.0, 670.0),
            window_padding: vec2(20.0, 20.0),
        }),
        |ui, _size| {
            ui.vertical_centered(|ui| {
                ui.heading(modal_state.title);
            });
            ui.add_space(8.0);

            const RESERVED_FOOTER_HEIGHT: f32 = ACTION_BUTTON_SIZE.y + 24.0;
            const COLUMN_LIST_MIN_HEIGHT: f32 = 120.0;

            // Only the column list scrolls; the action buttons must stay visible.
            let column_list_height = (ui.available_height() - RESERVED_FOOTER_HEIGHT)
                .max(COLUMN_LIST_MIN_HEIGHT)
                .min(ui.available_height());

            // Keep this as exactly two egui columns for DLT/SomeIP table export.
            ui.columns_const(|[col1, col2]| {
                col1.vertical(|ui| {
                    ScrollArea::vertical()
                        .max_height(column_list_height)
                        .auto_shrink([false, false])
                        .show(ui, |ui| render_column_rows(ui, &mut modal_state));
                });

                col2.vertical(|ui| {
                    ui.label(
                        "Please select columns to be exported and define the delimiter, which will be used to split columns.",
                    );
                    ui.add_space(12.0);
                    ui.label(RichText::new("Delimiter").strong());
                    ui.text_edit_singleline(&mut modal_state.delimiter);
                    ui.label(format!("Delimiter \"{}\"", modal_state.delimiter));
                    ui.add_space(4.0);

                    let validation_errors = modal_state.validation_errors();
                    can_export = validation_errors.is_empty();
                    for error in validation_errors {
                        ui.colored_label(ui.visuals().warn_fg_color, validation_error_text(error));
                    }
                });
            });

            ui.add_space(12.0);
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                if Button::new("Cancel")
                    .min_size(ACTION_BUTTON_SIZE)
                    .ui(ui)
                    .clicked()
                {
                    ui.close();
                }

                if ui
                    .add_enabled(
                        can_export,
                        Button::new("Export").min_size(ACTION_BUTTON_SIZE),
                    )
                    .clicked()
                {
                    export = true;
                    ui.close();
                }
            });
        },
    );

    if export {
        exports.export_text_modal(actions, modal_state);
    } else if !modal.should_close() {
        exports.keep_text_modal(modal_state);
    }
}

fn render_column_rows(ui: &mut Ui, modal_state: &mut TextExportModalState) {
    const COLUMN_ROW_MARGIN: Margin = Margin::symmetric(6, 4);

    for column in &mut modal_state.columns {
        Frame::group(ui.style())
            .fill(ui.visuals().faint_bg_color)
            .outer_margin(Margin::symmetric(10, 2))
            .inner_margin(COLUMN_ROW_MARGIN)
            .show(ui, |ui| {
                ui.set_width(ui.available_width());
                ui.horizontal(|ui| {
                    const COLUMN_TEXT_SPACING: f32 = 1.0;
                    let text_height =
                        ui.text_style_height(&egui::TextStyle::Body) * 2.0 + COLUMN_TEXT_SPACING;
                    let checkbox_height = ui.spacing().interact_size.y;
                    ui.allocate_ui(vec2(ui.spacing().interact_size.x, text_height), |ui| {
                        ui.add_space(((text_height - checkbox_height) * 0.5).max(0.0));
                        ui.checkbox(&mut column.selected, "");
                    });

                    ui.vertical(|ui| {
                        ui.spacing_mut().item_spacing.y = COLUMN_TEXT_SPACING;
                        Label::new(RichText::new(column.label.as_str()).strong())
                            .truncate()
                            .ui(ui);
                        Label::new(RichText::new(column.tooltip.as_str()))
                            .truncate()
                            .ui(ui);
                    });
                });
            });
    }
}

fn validation_error_text(error: TextExportValidationError) -> &'static str {
    match error {
        TextExportValidationError::NoColumnsSelected => "Select at least one column.",
        TextExportValidationError::EmptyDelimiter => "Delimiter cannot be empty.",
        TextExportValidationError::DelimiterContainsNewline => {
            "Delimiter cannot contain line breaks."
        }
    }
}
