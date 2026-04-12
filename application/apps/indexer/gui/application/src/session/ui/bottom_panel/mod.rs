use std::rc::Rc;

use enum_iterator::all;
use tokio::sync::mpsc::Sender;

use egui::{
    Align, Align2, Color32, CornerRadius, FontId, Layout, Mesh, Rect, ScrollArea, Sense, Shape,
    TextStyle, Ui, UiBuilder, pos2, scroll_area::ScrollBarVisibility, vec2,
};

use crate::{
    common::phosphor::icons,
    host::{
        command::HostCommand,
        common::colors,
        ui::{UiActions, registry::HostRegistry},
    },
    session::{
        command::SessionCommand,
        ui::{definitions::schema::LogSchema, shared::SessionShared},
    },
};
use chart::ChartUI;
use details::DetailsUI;
use library::LibraryUI;
use presets::PresetsUI;
use search::SearchUI;

mod library;
mod presets;
mod tab_types;

pub use tab_types::BottomTabType;

pub mod chart;
mod details;
mod search;

#[derive(Debug)]
pub struct BottomPanelUI {
    pub search: SearchUI,
    pub details: DetailsUI,
    pub library: LibraryUI,
    pub presets: PresetsUI,
    pub chart: ChartUI,
    pending_tab_scroll_delta: f32,
}

struct BottomTabChrome {
    control_height: f32,
    top_gap: f32,
    scroll_step: f32,
    scroll_button_width: f32,
    scroll_edge_epsilon: f32,
    rail_side_padding: f32,
    item_width: f32,
    item_horizontal_padding: f32,
    item_corner_radius: u8,
    selected_accent_height: f32,
}

const BOTTOM_TAB_CHROME: BottomTabChrome = BottomTabChrome {
    control_height: 26.0,
    top_gap: 4.0,
    scroll_step: 70.0,
    scroll_button_width: 20.0,
    scroll_edge_epsilon: 0.5,
    rail_side_padding: 4.0,
    item_width: 80.0,
    item_horizontal_padding: 10.0,
    item_corner_radius: 4,
    selected_accent_height: 2.0,
};

impl BottomPanelUI {
    pub fn new(
        cmd_tx: Sender<SessionCommand>,
        host_cmd_tx: Sender<HostCommand>,
        schema: Rc<dyn LogSchema>,
    ) -> Self {
        Self {
            search: SearchUI::new(cmd_tx.clone(), schema),
            details: DetailsUI::default(),
            library: LibraryUI::new(cmd_tx.clone()),
            presets: PresetsUI::new(cmd_tx.clone(), host_cmd_tx),
            chart: ChartUI::new(cmd_tx),
            pending_tab_scroll_delta: 0.0,
        }
    }

    pub fn render_content(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut HostRegistry,
        ui: &mut Ui,
    ) {
        self.render_tabs(shared, ui);

        match shared.bottom_tab {
            BottomTabType::Search => {
                self.search
                    .render_content(shared, actions, &mut registry.filters, ui)
            }
            BottomTabType::Details => self.details.render_content(shared, ui),
            BottomTabType::Library => {
                self.library
                    .render_content(shared, actions, &mut registry.filters, ui)
            }
            BottomTabType::Presets => self.presets.render_content(shared, actions, registry, ui),
            BottomTabType::Chart => {
                self.chart
                    .render_content(shared, actions, &registry.filters, ui)
            }
        }
    }

    fn render_tabs(&mut self, shared: &mut SessionShared, ui: &mut Ui) {
        let chrome = &BOTTOM_TAB_CHROME;
        let rail_fill = colors::main_accent_background(ui.visuals().dark_mode);

        // Reserve and paint the full rail so overlay buttons don't affect layout.
        let (control_rect, _) = ui.allocate_exact_size(
            vec2(ui.available_width(), chrome.total_height()),
            Sense::hover(),
        );
        ui.painter().rect_filled(control_rect, 0, rail_fill);

        let pending_scroll_delta = std::mem::take(&mut self.pending_tab_scroll_delta);
        let mut tab_ui = ui.new_child(
            UiBuilder::new()
                .id_salt("session_bottom_tab_strip_ui")
                .max_rect(chrome.tab_strip_rect(control_rect))
                .layout(Layout::left_to_right(Align::Max)),
        );
        tab_ui.style_mut().always_scroll_the_only_direction = true;

        let output = ScrollArea::horizontal()
            .id_salt("session_bottom_tab_strip")
            .auto_shrink([false, true])
            .scroll_bar_visibility(ScrollBarVisibility::AlwaysHidden)
            .show(&mut tab_ui, |ui| {
                // egui only animates scroll requests issued from inside the scroll area.
                if pending_scroll_delta != 0.0 {
                    ui.scroll_with_delta_animation(
                        vec2(pending_scroll_delta, 0.0),
                        ui.style().scroll_animation,
                    );
                }

                ui.with_layout(Layout::left_to_right(Align::Max), |ui| {
                    ui.spacing_mut().item_spacing.x = 2.0;
                    ui.add_space(chrome.rail_side_padding);

                    for tab in all::<BottomTabType>() {
                        render_tab_button(tab, &mut shared.bottom_tab, chrome, ui);
                    }

                    ui.add_space(chrome.rail_side_padding);
                });
            });

        let max_scroll_offset = (output.content_size.x - output.inner_rect.width()).max(0.0);
        if max_scroll_offset <= 0.0 {
            return;
        }
        let current_scroll_offset = output.state.offset.x.clamp(0.0, max_scroll_offset);

        // Overlay buttons share the viewport edges but use the full control height.
        let left_rect = chrome.scroll_button_rect(control_rect, output.inner_rect, true);
        let right_rect = chrome.scroll_button_rect(control_rect, output.inner_rect, false);

        let mut requested_scroll_delta = 0.0;
        if chrome.can_scroll_left(current_scroll_offset)
            && render_tab_scroll_button(ui, left_rect, true, icons::regular::CARET_LEFT)
        {
            requested_scroll_delta += chrome.scroll_step;
        }
        if chrome.can_scroll_right(current_scroll_offset, max_scroll_offset)
            && render_tab_scroll_button(ui, right_rect, false, icons::regular::CARET_RIGHT)
        {
            requested_scroll_delta -= chrome.scroll_step;
        }

        if requested_scroll_delta != 0.0 {
            self.pending_tab_scroll_delta = requested_scroll_delta;
            ui.ctx().request_repaint();
        }
    }
}

fn render_tab_scroll_button(ui: &mut Ui, rect: Rect, fade_from_left: bool, icon: &str) -> bool {
    const ICON_SIZE: f32 = 14.0;

    let dark_mode = ui.visuals().dark_mode;
    let accent_bg = colors::main_accent_background(dark_mode);
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

    let id = ui.id().with(("bottom_tab_scroll_button", fade_from_left));
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
        FontId::proportional(ICON_SIZE),
        icon_color,
    );

    response.clicked()
}

fn render_tab_button(
    target: BottomTabType,
    current_tab: &mut BottomTabType,
    chrome: &BottomTabChrome,
    ui: &mut Ui,
) {
    let selected = target == *current_tab;
    let label = target.to_string();
    let dark_mode = ui.visuals().dark_mode;
    let inactive_fg = ui.visuals().widgets.inactive.fg_stroke.color;
    let accent_stroke = colors::main_accent_stroke(dark_mode);

    // Allocate interaction and attach the tooltip.
    let (rect, response) = ui.allocate_exact_size(
        vec2(chrome.item_width, chrome.control_height),
        Sense::click(),
    );
    let response = response.on_hover_ui(|ui| {
        ui.set_max_width(ui.spacing().tooltip_width);
        ui.label(label.as_str());
    });

    // Derive visuals from the current interaction state.
    let bg_fill = if selected {
        ui.visuals().panel_fill
    } else {
        let accent_bg = colors::main_accent_background(dark_mode);
        if response.is_pointer_button_down_on() {
            if dark_mode {
                accent_bg.gamma_multiply(1.18)
            } else {
                accent_bg.gamma_multiply(0.9)
            }
        } else if response.hovered() {
            if dark_mode {
                accent_bg.gamma_multiply(1.08)
            } else {
                accent_bg.gamma_multiply(0.96)
            }
        } else {
            Color32::TRANSPARENT
        }
    };
    let fg = if selected || response.hovered() || response.has_focus() {
        accent_stroke
    } else {
        inactive_fg
    };
    let text_galley =
        ui.painter()
            .layout_no_wrap(label.clone(), TextStyle::Button.resolve(ui.style()), fg);

    // Paint the tab body, selected accent, and centered clipped label.
    if ui.is_rect_visible(rect) {
        if bg_fill != Color32::TRANSPARENT {
            ui.painter()
                .rect_filled(rect, chrome.tab_corner_radius(), bg_fill);
        }

        if selected {
            let accent_rect = Rect::from_min_max(
                rect.min,
                pos2(rect.max.x, rect.min.y + chrome.selected_accent_height),
            );
            ui.painter()
                .rect_filled(accent_rect, chrome.tab_corner_radius(), accent_stroke);
        }

        let text_clip_rect = Rect::from_min_max(
            pos2(rect.min.x + chrome.item_horizontal_padding, rect.min.y),
            pos2(rect.max.x - chrome.item_horizontal_padding, rect.max.y),
        );
        let text_pos = pos2(
            text_clip_rect.center().x - text_galley.size().x * 0.5,
            rect.center().y - text_galley.size().y * 0.5,
        );
        ui.painter()
            .with_clip_rect(text_clip_rect)
            .galley(text_pos, text_galley, fg);
    }

    // Commit selection on click.
    if response.clicked() {
        *current_tab = target;
    }
}

impl BottomTabChrome {
    fn total_height(&self) -> f32 {
        self.top_gap + self.tab_strip_height()
    }

    fn tab_strip_height(&self) -> f32 {
        self.control_height
    }

    fn tab_strip_rect(&self, control_rect: Rect) -> Rect {
        Rect::from_min_max(
            pos2(
                control_rect.min.x,
                control_rect.max.y - self.tab_strip_height(),
            ),
            control_rect.max,
        )
    }

    fn scroll_button_rect(
        &self,
        control_rect: Rect,
        viewport_rect: Rect,
        fade_from_left: bool,
    ) -> Rect {
        let button_min_x = if fade_from_left {
            viewport_rect.min.x
        } else {
            viewport_rect.max.x - self.scroll_button_width
        };

        Rect::from_min_size(
            pos2(button_min_x, control_rect.min.y),
            vec2(self.scroll_button_width, self.total_height()),
        )
    }

    fn tab_corner_radius(&self) -> CornerRadius {
        CornerRadius {
            nw: self.item_corner_radius,
            ne: self.item_corner_radius,
            sw: 0,
            se: 0,
        }
    }

    fn can_scroll_left(&self, offset: f32) -> bool {
        offset > self.scroll_edge_epsilon
    }

    fn can_scroll_right(&self, offset: f32, max_offset: f32) -> bool {
        offset < max_offset - self.scroll_edge_epsilon
    }
}
