//! Shared controls rendered over attachment preview frames.

use egui::{Button, Rect, RichText, Ui, pos2, vec2};

use crate::{
    common::phosphor::icons,
    host::{notification::AppNotification, ui::UiActions},
    session::types::attachment::PreviewContent,
};

/// Renders the clipboard action over the top-right corner of an attachment preview.
///
/// Returns `true` when the copy button was clicked.
pub fn render_copy_button(
    ui: &mut Ui,
    frame_rect: Rect,
    content: &PreviewContent,
    actions: &mut UiActions,
) -> bool {
    const BUTTON_SIZE: f32 = 26.0;
    const ICON_SIZE: f32 = 16.0;
    const FRAME_INSET: f32 = 8.0;

    let button_rect = Rect::from_min_size(
        pos2(
            frame_rect.right() - FRAME_INSET - BUTTON_SIZE,
            frame_rect.top() + FRAME_INSET,
        ),
        vec2(BUTTON_SIZE, BUTTON_SIZE),
    );
    let tooltip = match content {
        PreviewContent::Text(_) => "Copy attachment text",
        PreviewContent::Image(_) => "Copy image",
    };
    let clicked = ui
        .put(
            button_rect,
            Button::new(RichText::new(icons::regular::COPY).size(ICON_SIZE))
                .frame(true)
                .frame_when_inactive(false),
        )
        .on_hover_text(tooltip)
        .on_hover_cursor(egui::CursorIcon::PointingHand)
        .clicked();

    if clicked {
        content.copy_to(ui.ctx());
        let message = match content {
            PreviewContent::Text(_) => "Copied attachment text to clipboard.",
            PreviewContent::Image(_) => "Copied image to clipboard.",
        };
        actions.add_transient_notification(AppNotification::Info(message.to_owned()));
    }

    clicked
}
