//! Shared egui modal primitives for host and session UI.

use egui::{Button, Frame, Id, ModalResponse, NumExt as _, Spinner, Ui, Vec2, Widget as _, vec2};

/// Modal sizing policy applied before rendering content.
#[derive(Debug, Clone)]
pub enum ModalSize {
    /// Content-driven height with width capped by available space and this max width.
    MaxWidth(f32),
    /// Fixed modal size resolved from the current UI content area.
    Responsive(ResponsiveModalSize),
}

/// Responsive modal sizing limits resolved against the current UI content area.
#[derive(Debug, Clone)]
pub struct ResponsiveModalSize {
    /// Width as a fraction of the content area width.
    pub width_ratio: f32,
    /// Height as a fraction of the content area height.
    pub height_ratio: f32,
    /// Smallest allowed modal size.
    pub min_size: Vec2,
    /// Largest allowed modal size.
    pub max_size: Vec2,
    /// Space kept between the modal and content area edges.
    pub window_padding: Vec2,
}

impl ResponsiveModalSize {
    /// Returns the modal size clamped by configured limits and available content area.
    pub fn resolve(&self, ui: &Ui) -> Vec2 {
        let app_size = ui.content_rect().size();
        let available = (app_size - self.window_padding).max(vec2(20.0, 20.0));

        vec2(
            (app_size.x * self.width_ratio)
                .clamp(self.min_size.x, self.max_size.x)
                .min(available.x),
            (app_size.y * self.height_ratio)
                .clamp(self.min_size.y, self.max_size.y)
                .min(available.y),
        )
    }
}

/// Show a modal dialog and pass the resolved content size to the renderer.
pub fn show_modal<T>(
    parent_ui: &Ui,
    id: impl Into<Id>,
    size: ModalSize,
    content: impl FnOnce(&mut Ui, Vec2) -> T,
) -> ModalResponse<T> {
    let ctx = parent_ui.ctx();
    egui::Modal::new(id.into())
        .frame(Frame::window(ctx.global_style().as_ref()).inner_margin(egui::Margin::same(8)))
        .show(ctx, |ui| {
            let content_size = apply_size(parent_ui, ui, size);
            content(ui, content_size)
        })
}

fn apply_size(parent_ui: &Ui, modal_ui: &mut Ui, size: ModalSize) -> Vec2 {
    match size {
        ModalSize::MaxWidth(max_width) => {
            let modal_width = (parent_ui.content_rect().width() - 20.0)
                .at_least(20.0)
                .at_most(max_width);
            modal_ui.set_width(modal_width);
            vec2(modal_width, modal_ui.available_height())
        }
        ModalSize::Responsive(size) => {
            let size = size.resolve(parent_ui);
            modal_ui.set_width(size.x);
            modal_ui.set_height(size.y);
            size
        }
    }
}

/// Shows a busy indicator with an optional label and cancel action.
pub fn show_busy_indicator<F>(ui: &Ui, label: Option<&str>, cancel_action: Option<F>)
where
    F: FnOnce(),
{
    show_modal(
        ui,
        "busy indicator",
        ModalSize::MaxWidth(200.0),
        |ui, _size| {
            ui.vertical_centered(|ui| {
                if let Some(label) = label {
                    ui.label(label);
                    ui.add_space(5.);
                }
                Spinner::new().size(25.).ui(ui);

                if let Some(cancel_action) = cancel_action {
                    ui.add_space(5.);
                    if Button::new("Cancel")
                        .min_size(vec2(90.0, 0.0))
                        .ui(ui)
                        .clicked()
                    {
                        cancel_action();
                    }
                }
            });
        },
    );
}
