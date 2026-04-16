use egui::{
    Align, Frame, Label, Margin, RichText, TextBuffer, TextEdit, TextStyle, Ui, Vec2, Widget as _,
};

/// Frame used for neutral grouped content blocks across application UI.
pub fn general_group_frame(ui: &Ui) -> Frame {
    Frame::group(ui.style()).fill(ui.style().visuals.faint_bg_color)
}

/// Frame used to group controls in side views.
pub fn side_panel_group_frame(ui: &Ui) -> Frame {
    general_group_frame(ui)
        .inner_margin(Margin::symmetric(10, 8))
        .outer_margin(Margin::symmetric(0, 4))
}

/// Show a side-panel group and make its contents claim the full available width.
pub fn show_side_panel_group(ui: &mut Ui, add_contents: impl FnOnce(&mut Ui)) {
    side_panel_group_frame(ui).show(ui, |ui| {
        ui.take_available_width();
        add_contents(ui);
    });
}

pub fn main_panel_group_frame(ui: &mut Ui) -> Frame {
    Frame::group(ui.style())
        .fill(ui.style().visuals.faint_bg_color)
        .inner_margin(Margin::symmetric(12, 12))
        .outer_margin(Margin::symmetric(0, 4))
}

/// Show a validation message while preserving the vertical layout slot.
pub fn show_validation_message(ui: &mut Ui, message: Option<&str>) {
    const VALIDATION_MESSAGE_HEIGHT: f32 = 15.0;
    const VALIDATION_MESSAGE_FONT_SIZE: f32 = 10.5;

    ui.vertical(|ui| {
        ui.set_height(VALIDATION_MESSAGE_HEIGHT);

        if let Some(message) = message {
            Label::new(
                RichText::new(message)
                    .size(VALIDATION_MESSAGE_FONT_SIZE)
                    .small()
                    .color(ui.visuals().warn_fg_color),
            )
            .selectable(true)
            .truncate()
            .ui(ui);
        }
    });
}

/// Build a single-line [`TextEdit`] that approximates the provided outer size.
///
/// # Note:
///
/// This function is a workaround for the regression egui 0.34 regarding
/// `TextEdit::min_size().y` not being respected anymore.
pub fn sized_singleline_text_edit<'t>(
    ui: &mut Ui,
    text: &'t mut dyn TextBuffer,
    size: Vec2,
    horizontal_margin: i8,
) -> TextEdit<'t> {
    let font_id = TextStyle::Body.resolve(ui.style());
    let row_height = ui.fonts_mut(|fonts| fonts.row_height(&font_id));
    let vertical_margin = ((size.y - row_height) / 2.0)
        .round()
        .clamp(0.0, i8::MAX as f32) as i8;

    // egui 0.34 no longer applies `TextEdit::min_size().y`, so use the inner margin to reach the
    // requested row height instead.
    // TODO: Keep track on issue: https://github.com/emilk/egui/issues/8071
    TextEdit::singleline(text)
        .desired_width(size.x)
        .margin(Margin::symmetric(horizontal_margin, vertical_margin))
        .vertical_align(Align::Center)
}
