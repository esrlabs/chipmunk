use egui::{Frame, Margin, Ui};

/// Frame used to group controls in side views.
pub fn side_panel_group_frame(ui: &mut Ui) -> Frame {
    Frame::group(ui.style())
        .fill(ui.style().visuals.faint_bg_color)
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
