//! Shared framed button presets for the main UI surfaces.
//!
//! These helpers centralize per-surface sizing so setup, side-panel, bottom-panel,
//! and home actions can stay visually consistent while keeping enable/hover/click
//! behavior at the call site.

use egui::{Button, WidgetText, vec2};

/// Shared framed button used across the session setup surfaces.
///
/// `min_width` overrides the default setup width when a view needs extra label padding.
pub fn session_setup(text: impl Into<WidgetText>, min_width: Option<f32>) -> Button<'static> {
    Button::new(text.into()).min_size(vec2(min_width.unwrap_or(88.0), 26.0))
}

/// Shared framed button for primary actions in session side panels.
pub fn side_panel_primary(text: impl Into<WidgetText>) -> Button<'static> {
    Button::new(text.into()).min_size(vec2(88.0, 24.0))
}

/// Shared framed icon button for contextual side-panel row actions.
pub fn side_panel_row_icon(text: impl Into<WidgetText>) -> Button<'static> {
    Button::new(text.into())
        .min_size(vec2(22.0, 22.0))
        .frame(false)
}

/// Shared framed button for bottom-panel actions.
pub fn bottom_panel(text: impl Into<WidgetText>) -> Button<'static> {
    Button::new(text.into()).min_size(vec2(0.0, 22.0))
}

/// Shared framed icon button for bottom-panel actions.
pub fn bottom_panel_icon(text: impl Into<WidgetText>) -> Button<'static> {
    Button::new(text.into()).min_size(vec2(22.0, 22.0))
}
