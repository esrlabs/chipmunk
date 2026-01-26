use egui::{Frame, Margin, Ui};

/// Frame used to group controls in side views.
pub fn side_panel_group_frame(ui: &mut Ui) -> Frame {
    Frame::group(ui.style())
        .fill(ui.style().visuals.faint_bg_color)
        .inner_margin(Margin::symmetric(10, 8))
        .outer_margin(Margin::symmetric(0, 4))
}

pub fn main_panel_group_frame(ui: &mut Ui) -> Frame {
    Frame::group(ui.style())
        .fill(ui.style().visuals.faint_bg_color)
        .inner_margin(Margin::symmetric(12, 12))
        .outer_margin(Margin::symmetric(0, 4))
}
