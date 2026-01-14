use egui::{Context, Frame, Id, Label, ModalResponse, NumExt as _, Spinner, Ui, Widget as _};

/// Show standard modal dialog filled with the provided content.
pub fn show_modal<T>(
    ctx: &Context,
    id: impl Into<Id>,
    max_width: f32,
    content: impl FnOnce(&mut Ui) -> T,
) -> ModalResponse<T> {
    egui::Modal::new(id.into())
        .frame(Frame::window(&ctx.style()).inner_margin(egui::Margin::same(8)))
        .show(ctx, |ui| {
            let modal_width = (ctx.content_rect().width() - 20.)
                .at_least(20.)
                .at_most(max_width);

            ui.set_width(modal_width);

            content(ui)
        })
}

/// Show a busy indicator in modal dialog with an optional label.
pub fn show_busy_indicator(ctx: &Context, label: Option<&str>) {
    show_modal(ctx, "busy indicator", 200.0, |ui| {
        ui.vertical_centered(|ui| {
            if let Some(label) = label {
                Label::new(label).selectable(false).ui(ui);
                ui.add_space(5.);
            }
            Spinner::new().size(25.).ui(ui);
        });
    });
}
