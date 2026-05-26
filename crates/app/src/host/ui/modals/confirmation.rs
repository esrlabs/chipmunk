//! Rendering for caller-owned host confirmation dialogs.

use egui::{Align, Label, Layout, RichText, TextWrapMode, Ui, Widget as _};

use crate::{
    common::ui::{
        buttons,
        modal::{ModalSize, show_modal},
    },
    host::ui::state::modal::{ConfirmationAnswer, ConfirmationDialog},
};

/// Renders a confirmation dialog and returns an answer once it is accepted or dismissed.
pub fn render_modal(dialog: &ConfirmationDialog, parent_ui: &Ui) -> Option<ConfirmationAnswer> {
    let mut answer = None;

    let modal = show_modal(
        parent_ui,
        egui::Id::new(("confirmation", &dialog.id)),
        ModalSize::MaxWidth(420.0),
        |ui, _size| {
            ui.vertical_centered(|ui| {
                ui.heading(&dialog.title);
            });
            ui.add_space(8.0);

            Label::new(RichText::new(&dialog.message))
                .wrap_mode(TextWrapMode::Wrap)
                .ui(ui);

            ui.add_space(16.0);
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                if ui
                    .add(buttons::command(&dialog.cancel_label, None))
                    .clicked()
                {
                    answer = Some(ConfirmationAnswer::Cancelled);
                    ui.close();
                }

                if ui
                    .add(buttons::command(&dialog.confirm_label, None))
                    .clicked()
                {
                    answer = Some(ConfirmationAnswer::Confirmed);
                    ui.close();
                }
            });
        },
    );

    if answer.is_none() && modal.should_close() {
        answer = Some(ConfirmationAnswer::Cancelled);
    }

    answer
}
