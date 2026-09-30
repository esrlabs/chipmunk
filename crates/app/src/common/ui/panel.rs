//! Shared helpers for application panels.

use egui::{Panel, Ui};

/// Shows `panel` with egui's slide animation, while only the application's own
/// toggles change its visibility.
///
/// egui's drag-to-close, drag-to-open and double-click toggle gestures are disabled.
pub fn show_toggled_panel(
    panel: Panel,
    ui: &mut Ui,
    visible: bool,
    add_contents: impl FnOnce(&mut Ui),
) {
    // `show_collapsible` writes panel gestures back into `is_expanded`. Pass a
    // per-frame copy so those writes are discarded, and disable drag-to-open so a
    // closed panel leaves no grab handle behind.
    let mut expanded = visible;
    panel
        .drag_to_open(false)
        .show_collapsible(ui, &mut expanded, add_contents);
}
