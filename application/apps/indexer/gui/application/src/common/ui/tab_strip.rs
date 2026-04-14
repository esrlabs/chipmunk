//! Shared horizontal tab-strip rendering for the host and session UIs.
//!
//! Callers keep ownership of tab identity, selection, tooltip text, and width policy.
//! This module owns the strip geometry, clipping, scrolling, and interactions so both
//! call sites keep the same behavior.

use std::{borrow::Cow, mem};

use egui::{
    Align, Align2, Color32, CornerRadius, Direction, FontId, Mesh, Rect, ScrollArea, Sense, Shape,
    TextStyle, Ui, UiBuilder, pos2, scroll_area::ScrollBarVisibility, vec2,
};

use crate::{common::phosphor::icons, host::common::colors};

const ITEM_SPACING_X: f32 = 2.0;
const ITEM_HORIZONTAL_PADDING: f32 = 10.0;
const ITEM_CORNER_RADIUS: u8 = 4;
const SCROLL_BUTTON_WIDTH: f32 = 20.0;
const SCROLL_BUTTON_ICON_SIZE: f32 = 14.0;
const SCROLL_EDGE_EPSILON: f32 = 0.5;
const SELECTED_ACCENT_HEIGHT: f32 = 2.0;
const CLOSE_SLOT_WIDTH: f32 = 24.0;
const CLOSE_ICON_SIZE: f32 = 14.0;

/// Shared horizontal tab-strip control.
#[derive(Debug, Clone)]
pub struct TabStrip {
    id: egui::Id,
    selected_tab_index: usize,
    control_height: f32,
    top_gap: f32,
    scroll_step: f32,
    rail_side_padding: f32,
    has_close_buttons: bool,
}

/// Immutable tab metadata consumed by [`TabStrip::show`].
///
/// Callers provide one spec per tab in visual order. The strip uses that order as the tab index
/// for selection and emitted [`TabEvent`] values, while tab contents are rendered separately by
/// `TabStrip::show`'s closure.
#[derive(Debug, Clone)]
pub struct TabSpec<'a> {
    key: egui::Id,
    closeable: bool,
    width: TabWidth,
    tooltip: Option<Cow<'a, str>>,
}

impl<'a> TabSpec<'a> {
    /// Creates a tab spec with the required identity and width.
    pub fn new(key: impl Into<egui::Id>, width: TabWidth) -> Self {
        Self {
            key: key.into(),
            closeable: false,
            width,
            tooltip: None,
        }
    }

    /// Enables close interactions for this tab.
    pub fn closeable(mut self, closeable: bool) -> Self {
        self.closeable = closeable;
        self
    }

    /// Sets the tooltip shown when hovering the tab body.
    pub fn tooltip(mut self, tooltip: impl Into<Cow<'a, str>>) -> Self {
        self.tooltip = Some(tooltip.into());
        self
    }
}

/// Width policy for an individual tab.
#[derive(Debug, Clone)]
pub enum TabWidth {
    /// Use the provided width as-is.
    Exact(f32),
    /// Start from caller-measured content width, then add shared chrome and clamp if needed.
    Dynamic {
        /// Width of the caller's visible tab content, before shared padding and close slot.
        content_width: f32,
        /// Optional hard cap applied after shared chrome is added.
        max: Option<f32>,
    },
}

/// Interaction emitted by the strip.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TabEvent {
    /// Select the tab at the given index.
    Select(usize),
    /// Close the tab at the given index.
    Close(usize),
}

/// Internal per-strip state stored in egui memory.
#[derive(Debug, Default, Clone)]
struct TabStripState {
    pending_scroll_delta: f32,
}

#[derive(Debug)]
struct TabRects {
    body_rect: Rect,
    close_rect: Option<Rect>,
    content_rect: Rect,
}

impl TabStrip {
    /// Creates a tab strip with default chrome and the selected tab index.
    ///
    /// `id` must be stable for the same logical strip across frames so egui can keep its internal
    /// state. If `selected_tab_index` is out of range for the provided tab slice, the strip falls
    /// back to tab `0` and emits [`TabEvent::Select(0)`].
    pub fn new(id: egui::Id, selected_tab_index: usize) -> Self {
        Self {
            id,
            selected_tab_index,
            control_height: 26.0,
            top_gap: 0.0,
            scroll_step: 70.0,
            rail_side_padding: 0.0,
            has_close_buttons: false,
        }
    }

    /// Sets the strip height, excluding any top gap.
    pub fn control_height(mut self, control_height: f32) -> Self {
        self.control_height = control_height;
        self
    }

    /// Sets the vertical gap reserved above the strip.
    pub fn top_gap(mut self, top_gap: f32) -> Self {
        self.top_gap = top_gap;
        self
    }

    /// Sets the horizontal scroll delta used by the overlay buttons.
    pub fn scroll_step(mut self, scroll_step: f32) -> Self {
        self.scroll_step = scroll_step;
        self
    }

    /// Sets horizontal padding before the first tab and after the last tab.
    pub fn rail_side_padding(mut self, rail_side_padding: f32) -> Self {
        self.rail_side_padding = rail_side_padding;
        self
    }

    /// Enables the built-in close affordance for closeable tabs.
    pub fn has_close_buttons(mut self, has_close_buttons: bool) -> Self {
        self.has_close_buttons = has_close_buttons;
        self
    }

    /// Total vertical space the caller should reserve for the strip, including the top gap.
    pub const fn total_height(&self) -> f32 {
        self.top_gap + self.control_height
    }

    /// Measures one unwrapped text run using the current `Ui` style.
    pub fn measure_text_width(ui: &Ui, text: &str, text_style: TextStyle) -> f32 {
        ui.painter()
            .layout_no_wrap(
                text.to_owned(),
                text_style.resolve(ui.style()),
                Color32::TRANSPARENT,
            )
            .size()
            .x
    }

    /// Renders a scrollable tab strip inside `control_rect` and returns the highest-priority
    /// interaction from this frame.
    ///
    /// Overlay scroll buttons are painted outside the `ScrollArea` layout so tab positions remain
    /// stable while the viewport is partially covered.
    ///
    /// - `ui` is the parent `Ui` that owns the strip.
    /// - `control_rect` is the full outer rect reserved for the strip, including any top gap.
    /// - `tabs` defines the tabs in visual order. Slice indices are used as tab indices in
    ///   selection and emitted events.
    /// - `render_content` renders the visible content for one tab. It receives the tab body `Ui`
    ///   and the tab index from `tabs`.
    pub fn show(
        self,
        ui: &mut Ui,
        control_rect: Rect,
        tabs: &[TabSpec<'_>],
        mut render_content: impl FnMut(&mut Ui, usize),
    ) -> Option<TabEvent> {
        let rail_fill = colors::main_accent_background(ui.visuals().dark_mode);
        ui.painter().rect_filled(control_rect, 0, rail_fill);

        let strip_rect = self.strip_rect(control_rect);
        let state_id = self.id.with("state");
        let pending_scroll_delta = ui.ctx().data_mut(|data| {
            let state = data.get_temp_mut_or_default::<TabStripState>(state_id);
            mem::take(&mut state.pending_scroll_delta)
        });
        let mut pending_event = None;
        let selected_tab_index = if tabs.is_empty() {
            self.selected_tab_index
        } else {
            self.selected_tab_index.min(tabs.len() - 1)
        };
        let selected_tab_invalid = !tabs.is_empty() && self.selected_tab_index >= tabs.len();
        let mut tab_ui = ui.new_child(
            UiBuilder::new()
                .id_salt(self.id.with("ui"))
                .max_rect(strip_rect)
                .layout(egui::Layout::left_to_right(Align::Max)),
        );
        tab_ui.style_mut().always_scroll_the_only_direction = true;

        let output = ScrollArea::horizontal()
            .id_salt(self.id.with("scroll"))
            .auto_shrink([false, true])
            .scroll_bar_visibility(ScrollBarVisibility::AlwaysHidden)
            .show(&mut tab_ui, |ui| {
                if pending_scroll_delta != 0.0 {
                    ui.scroll_with_delta_animation(
                        vec2(pending_scroll_delta, 0.0),
                        ui.style().scroll_animation,
                    );
                }

                ui.spacing_mut().item_spacing.x = ITEM_SPACING_X;

                if self.rail_side_padding > 0.0 {
                    ui.add_space(self.rail_side_padding);
                }

                for (tab_index, spec) in tabs.iter().enumerate() {
                    let selected = tab_index == selected_tab_index;
                    if let Some(event) =
                        render_tab(ui, &self, strip_rect, tab_index, spec, selected, |ui| {
                            render_content(ui, tab_index)
                        })
                    {
                        record_tab_event(&mut pending_event, event);
                    }
                }

                if self.rail_side_padding > 0.0 {
                    ui.add_space(self.rail_side_padding);
                }
            });

        // Paint overlay buttons after layout so partially covered tabs keep their original geometry.
        let max_scroll_offset = (output.content_size.x - output.inner_rect.width()).max(0.0);
        if pending_event.is_none() && selected_tab_invalid {
            pending_event = Some(TabEvent::Select(0));
            ui.ctx().request_repaint();
        }

        if max_scroll_offset > 0.0 {
            let current_scroll_offset = output.state.offset.x.clamp(0.0, max_scroll_offset);
            let clip_rect_margin = ui.visuals().clip_rect_margin;
            let left_rect = self.scroll_button_rect(control_rect, output.inner_rect, true, 0.0);
            let right_rect =
                self.scroll_button_rect(control_rect, output.inner_rect, false, clip_rect_margin);

            let mut requested_scroll_delta = 0.0;
            if self.can_scroll_left(current_scroll_offset)
                && render_scroll_button(
                    ui,
                    self.id.with(("scroll_button", true)),
                    left_rect,
                    true,
                    icons::regular::CARET_LEFT,
                )
            {
                requested_scroll_delta += self.scroll_step;
            }
            if self.can_scroll_right(current_scroll_offset, max_scroll_offset)
                && render_scroll_button(
                    ui,
                    self.id.with(("scroll_button", false)),
                    right_rect,
                    false,
                    icons::regular::CARET_RIGHT,
                )
            {
                requested_scroll_delta -= self.scroll_step;
            }

            if requested_scroll_delta != 0.0 {
                ui.ctx().data_mut(|data| {
                    data.get_temp_mut_or_default::<TabStripState>(state_id)
                        .pending_scroll_delta = requested_scroll_delta;
                });
                ui.ctx().request_repaint();
            }
        }

        pending_event
    }
}

impl TabWidth {
    fn resolve(&self, strip: &TabStrip, closeable: bool) -> f32 {
        match self {
            TabWidth::Exact(width) => *width,
            TabWidth::Dynamic { content_width, max } => {
                let mut width = content_width + ITEM_HORIZONTAL_PADDING * 2.0;
                if closeable && strip.has_close_buttons {
                    width += CLOSE_SLOT_WIDTH;
                }
                if let Some(max) = max {
                    width = width.min(*max);
                }
                width
            }
        }
    }
}

impl TabStrip {
    fn strip_rect(&self, control_rect: Rect) -> Rect {
        Rect::from_min_max(
            pos2(control_rect.min.x, control_rect.max.y - self.control_height),
            control_rect.max,
        )
    }

    fn scroll_button_rect(
        &self,
        control_rect: Rect,
        viewport_rect: Rect,
        fade_from_left: bool,
        clip_rect_margin: f32,
    ) -> Rect {
        let button_min_x = if fade_from_left {
            viewport_rect.min.x
        } else {
            // ScrollArea clips content with `clip_rect_margin`, so the rightmost tab can
            // still paint slightly past the logical viewport edge.
            control_rect.max.x - SCROLL_BUTTON_WIDTH + clip_rect_margin
        };

        Rect::from_min_size(
            pos2(button_min_x, control_rect.min.y),
            vec2(SCROLL_BUTTON_WIDTH, self.total_height()),
        )
    }

    fn split_tab_rects(&self, tab_rect: Rect, closeable: bool) -> TabRects {
        let close_rect = if closeable && self.has_close_buttons {
            Some(Rect::from_min_max(
                pos2(tab_rect.max.x - CLOSE_SLOT_WIDTH, tab_rect.min.y),
                tab_rect.max,
            ))
        } else {
            None
        };
        let body_rect = if let Some(close_rect) = close_rect {
            Rect::from_min_max(tab_rect.min, pos2(close_rect.min.x, tab_rect.max.y))
        } else {
            tab_rect
        };
        let content_rect = Rect::from_min_max(
            pos2(body_rect.min.x + ITEM_HORIZONTAL_PADDING, body_rect.min.y),
            pos2(body_rect.max.x - ITEM_HORIZONTAL_PADDING, body_rect.max.y),
        );

        TabRects {
            body_rect,
            close_rect,
            content_rect,
        }
    }

    fn tab_corner_radius(&self) -> CornerRadius {
        CornerRadius {
            nw: ITEM_CORNER_RADIUS,
            ne: ITEM_CORNER_RADIUS,
            sw: 0,
            se: 0,
        }
    }

    fn can_scroll_left(&self, offset: f32) -> bool {
        offset > SCROLL_EDGE_EPSILON
    }

    fn can_scroll_right(&self, offset: f32, max_offset: f32) -> bool {
        offset < max_offset - SCROLL_EDGE_EPSILON
    }
}

fn record_tab_event(pending_event: &mut Option<TabEvent>, event: TabEvent) {
    // A close action wins over a previously recorded select so the caller sees the destructive
    // action that actually happened.
    if matches!(event, TabEvent::Close(_)) || pending_event.is_none() {
        *pending_event = Some(event);
    }
}

fn render_tab(
    ui: &mut Ui,
    strip: &TabStrip,
    strip_clip_rect: Rect,
    tab_index: usize,
    spec: &TabSpec<'_>,
    selected: bool,
    add_content: impl FnOnce(&mut Ui),
) -> Option<TabEvent> {
    let TabSpec {
        key,
        closeable,
        width,
        tooltip,
    } = spec;
    let can_close = *closeable && strip.has_close_buttons;
    let width = width.resolve(strip, can_close);
    let (rect, _) = ui.allocate_exact_size(vec2(width, strip.control_height), Sense::hover());
    let rects = strip.split_tab_rects(rect, can_close);

    let mut body_response = ui.interact(rects.body_rect, key.with("body"), Sense::click());
    if let Some(tooltip) = tooltip {
        body_response = body_response.on_hover_ui(move |ui| {
            ui.set_max_width(ui.spacing().tooltip_width);
            ui.label(tooltip.as_ref());
        });
    }

    let mut action = None;
    if can_close {
        body_response.context_menu(|ui| {
            if ui.button("Close").clicked() {
                action = Some(TabEvent::Close(tab_index));
                ui.close();
            }
        });
    }

    let close_response = rects.close_rect.map(|close_rect| {
        let response = ui
            .interact(close_rect, key.with("close"), Sense::click())
            .on_hover_text("Close tab");
        if response.clicked() {
            action = Some(TabEvent::Close(tab_index));
        }
        response
    });

    if action.is_none() && can_close && body_response.middle_clicked() {
        action = Some(TabEvent::Close(tab_index));
    }
    if action.is_none() && body_response.clicked() {
        action = Some(TabEvent::Select(tab_index));
    }

    let dark_mode = ui.visuals().dark_mode;
    let inactive_fg = ui.visuals().widgets.inactive.fg_stroke.color;
    let accent_stroke = colors::main_accent_stroke(dark_mode);
    let close_hovered = close_response
        .as_ref()
        .is_some_and(|response| response.hovered());
    let close_pressed = close_response
        .as_ref()
        .is_some_and(|response| response.is_pointer_button_down_on());
    let bg_fill = if selected {
        ui.visuals().panel_fill
    } else {
        let accent_bg = colors::main_accent_background(dark_mode);
        if body_response.is_pointer_button_down_on() || close_pressed {
            if dark_mode {
                accent_bg.gamma_multiply(1.18)
            } else {
                accent_bg.gamma_multiply(0.9)
            }
        } else if body_response.hovered() || body_response.has_focus() || close_hovered {
            if dark_mode {
                accent_bg.gamma_multiply(1.08)
            } else {
                accent_bg.gamma_multiply(0.96)
            }
        } else {
            Color32::TRANSPARENT
        }
    };
    let fg = if selected || body_response.hovered() || body_response.has_focus() || close_hovered {
        accent_stroke
    } else {
        inactive_fg
    };

    if ui.is_rect_visible(rect) {
        // Tab chrome and close icons must respect the logical strip viewport so they do not paint
        // underneath the overlay scroll buttons.
        let painter = ui.painter().with_clip_rect(strip_clip_rect);

        if bg_fill != Color32::TRANSPARENT {
            painter.rect_filled(rect, strip.tab_corner_radius(), bg_fill);
        }

        if selected {
            let accent_rect = Rect::from_min_max(
                rect.min,
                pos2(rect.max.x, rect.min.y + SELECTED_ACCENT_HEIGHT),
            );
            painter.rect_filled(accent_rect, strip.tab_corner_radius(), accent_stroke);
        }

        render_tab_content(
            ui,
            rects.content_rect,
            rects.content_rect.intersect(strip_clip_rect),
            fg,
            add_content,
        );

        if let Some(close_rect) = rects.close_rect {
            painter.text(
                close_rect.center(),
                Align2::CENTER_CENTER,
                icons::regular::X,
                FontId::proportional(CLOSE_ICON_SIZE),
                fg,
            );
        }
    }

    action
}

fn render_scroll_button(
    ui: &mut Ui,
    id: egui::Id,
    rect: Rect,
    fade_from_left: bool,
    icon: &str,
) -> bool {
    let accent_bg = colors::main_accent_background(ui.visuals().dark_mode);
    let [r, g, b, _] = accent_bg.to_srgba_unmultiplied();
    let edge_color = Color32::from_rgba_unmultiplied(r, g, b, 255);
    let center_color = Color32::from_rgba_unmultiplied(r, g, b, 0);

    let mut fade = Mesh::default();
    let base = fade.vertices.len() as u32;
    if fade_from_left {
        fade.colored_vertex(rect.left_top(), edge_color);
        fade.colored_vertex(rect.right_top(), center_color);
        fade.colored_vertex(rect.left_bottom(), edge_color);
        fade.colored_vertex(rect.right_bottom(), center_color);
    } else {
        fade.colored_vertex(rect.left_top(), center_color);
        fade.colored_vertex(rect.right_top(), edge_color);
        fade.colored_vertex(rect.left_bottom(), center_color);
        fade.colored_vertex(rect.right_bottom(), edge_color);
    }
    fade.add_triangle(base, base + 1, base + 2);
    fade.add_triangle(base + 2, base + 1, base + 3);
    ui.painter().add(Shape::mesh(fade));

    let response = ui
        .interact(rect, id, Sense::click())
        .on_hover_text("Scroll tabs");

    let hover_fill = if response.is_pointer_button_down_on() {
        Color32::from_rgba_unmultiplied(255, 255, 255, 32)
    } else if response.hovered() {
        Color32::from_rgba_unmultiplied(255, 255, 255, 18)
    } else {
        Color32::TRANSPARENT
    };
    if hover_fill != Color32::TRANSPARENT {
        ui.painter().rect_filled(rect, 0, hover_fill);
    }

    let icon_color = ui.style().interact(&response).fg_stroke.color;
    ui.painter().text(
        rect.center(),
        Align2::CENTER_CENTER,
        icon,
        FontId::proportional(SCROLL_BUTTON_ICON_SIZE),
        icon_color,
    );

    response.clicked()
}

fn render_tab_content(
    ui: &mut Ui,
    rect: Rect,
    clip_rect: Rect,
    fg: Color32,
    add_content: impl FnOnce(&mut Ui),
) {
    if clip_rect.width() <= 0.0 || clip_rect.height() <= 0.0 {
        return;
    }

    // Keep layout anchored in the full content rect and clip paint separately so partially
    // covered tabs do not shift while the strip is resized.
    let mut content_ui = ui.new_child(
        UiBuilder::new()
            .max_rect(rect)
            .layout(egui::Layout::centered_and_justified(Direction::LeftToRight)),
    );
    content_ui.set_clip_rect(clip_rect);
    content_ui.visuals_mut().override_text_color = Some(fg);
    add_content(&mut content_ui);
}

#[cfg(test)]
mod tests {
    use super::*;
    use egui::{Rect, pos2};

    fn test_strip() -> TabStrip {
        TabStrip::new(egui::Id::new("test_strip"), 0)
            .control_height(26.0)
            .top_gap(4.0)
            .scroll_step(70.0)
            .rail_side_padding(4.0)
            .has_close_buttons(true)
    }

    #[test]
    fn total_height_includes_top_gap() {
        assert_eq!(test_strip().total_height(), 30.0);
    }

    #[test]
    fn strip_rect_bottom_aligns() {
        let control_rect = Rect::from_min_max(pos2(10.0, 5.0), pos2(110.0, 35.0));

        assert_eq!(
            test_strip().strip_rect(control_rect),
            Rect::from_min_max(pos2(10.0, 9.0), pos2(110.0, 35.0))
        );
    }

    #[test]
    fn right_button_rect_uses_clip_margin() {
        let control_rect = Rect::from_min_max(pos2(0.0, 0.0), pos2(120.0, 30.0));
        let viewport_rect = Rect::from_min_max(pos2(0.0, 4.0), pos2(90.0, 30.0));

        assert_eq!(
            test_strip().scroll_button_rect(control_rect, viewport_rect, false, 3.0),
            Rect::from_min_max(pos2(103.0, 0.0), pos2(123.0, 30.0))
        );
    }

    #[test]
    fn split_tab_rects_reserves_close_slot() {
        let tab_rect = Rect::from_min_max(pos2(0.0, 0.0), pos2(180.0, 26.0));
        let rects = test_strip().split_tab_rects(tab_rect, true);

        assert_eq!(
            rects.close_rect,
            Some(Rect::from_min_max(pos2(156.0, 0.0), pos2(180.0, 26.0)))
        );
        assert_eq!(
            rects.body_rect,
            Rect::from_min_max(pos2(0.0, 0.0), pos2(156.0, 26.0))
        );
    }

    #[test]
    fn exact_width_stays_exact() {
        assert_eq!(TabWidth::Exact(80.0).resolve(&test_strip(), false), 80.0);
    }

    #[test]
    fn dynamic_width_adds_padding_and_close_slot() {
        assert_eq!(
            TabWidth::Dynamic {
                content_width: 50.0,
                max: None,
            }
            .resolve(&test_strip(), true),
            94.0
        );
    }

    #[test]
    fn dynamic_width_respects_maximum() {
        assert_eq!(
            TabWidth::Dynamic {
                content_width: 300.0,
                max: Some(180.0),
            }
            .resolve(&test_strip(), true),
            180.0
        );
    }
}
