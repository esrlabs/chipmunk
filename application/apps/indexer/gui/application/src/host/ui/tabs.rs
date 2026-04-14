use std::borrow::Cow;

use egui::{
    Align, Align2, Color32, CornerRadius, Direction, FontId, Label, Layout, Mesh, Rect, RichText,
    ScrollArea, Sense, Shape, Ui, UiBuilder, pos2, scroll_area::ScrollBarVisibility, vec2,
};
use uuid::Uuid;

use crate::{
    common::phosphor::{self, icons},
    host::{common::colors, ui::HostAction},
};

use super::{HostState, UiActions};

#[derive(Debug, Default)]
pub struct TabsUi {
    pending_tab_scroll_delta: f32,
}

struct HostTabChrome {
    control_height: f32,
    top_gap: f32,
    scroll_step: f32,
    scroll_button_width: f32,
    scroll_edge_epsilon: f32,
    item_width: f32,
    home_width: f32,
    item_horizontal_padding: f32,
    close_slot_width: f32,
    close_icon_size: f32,
    home_icon_size: f32,
    item_corner_radius: u8,
    selected_accent_height: f32,
}

pub(super) const HOST_TAB_CONTROL_HEIGHT: f32 = 28.0;
pub(super) const HOST_TAB_TOP_GAP: f32 = 3.0;
pub(super) const HOST_TAB_BAR_HEIGHT: f32 = HOST_TAB_CONTROL_HEIGHT + HOST_TAB_TOP_GAP;

const HOST_TAB_CHROME: HostTabChrome = HostTabChrome {
    control_height: HOST_TAB_CONTROL_HEIGHT,
    top_gap: HOST_TAB_TOP_GAP,
    scroll_step: 120.0,
    scroll_button_width: 20.0,
    scroll_edge_epsilon: 0.5,
    item_width: 180.0,
    home_width: 36.0,
    item_horizontal_padding: 10.0,
    close_slot_width: 24.0,
    close_icon_size: 14.0,
    home_icon_size: 18.0,
    item_corner_radius: 4,
    selected_accent_height: 2.0,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TabType {
    Home,
    Session(Uuid),
    SessionSetup(Uuid),
    MultiFileSetup(Uuid),
}

#[derive(Debug)]
enum TabAction {
    Select(usize),
    Close(TabCloseRequest),
}

#[derive(Debug, Clone)]
enum TabCloseRequest {
    Session(Uuid),
    SessionSetup(Uuid),
    MultiFileSetup(Uuid),
}

enum TabLabel<'a> {
    Home,
    Text(Cow<'a, str>),
}

struct TabSpec<'a> {
    idx: usize,
    selected: bool,
    label: TabLabel<'a>,
    close_request: Option<TabCloseRequest>,
}

impl TabsUi {
    pub fn render_all_tabs(&mut self, state: &mut HostState, actions: &mut UiActions, ui: &mut Ui) {
        let chrome = &HOST_TAB_CHROME;
        // The parent already reserved the whole host tab strip area. Reuse that rect so the
        // tabs and overlay buttons share one coordinate system.
        let control_rect = ui.max_rect();

        let pending_scroll_delta = std::mem::take(&mut self.pending_tab_scroll_delta);
        let mut pending_tab_action = None;
        let mut tab_ui = ui.new_child(
            UiBuilder::new()
                .id_salt("host_tab_strip_ui")
                .max_rect(chrome.tab_strip_rect(control_rect))
                .layout(Layout::left_to_right(Align::Max)),
        );
        tab_ui.style_mut().always_scroll_the_only_direction = true;

        let output = ScrollArea::horizontal()
            .id_salt("host_tab_strip")
            .auto_shrink([false, true])
            .scroll_bar_visibility(ScrollBarVisibility::AlwaysHidden)
            .show(&mut tab_ui, |ui| {
                if pending_scroll_delta != 0.0 {
                    ui.scroll_with_delta_animation(
                        vec2(pending_scroll_delta, 0.0),
                        ui.style().scroll_animation,
                    );
                }

                ui.spacing_mut().item_spacing.x = 2.0;

                for (idx, tab) in state.tabs.iter().enumerate() {
                    let action = match tab {
                        TabType::Home => render_tab_button(
                            TabSpec {
                                idx,
                                selected: idx == state.active_tab_idx,
                                label: TabLabel::Home,
                                close_request: None,
                            },
                            chrome,
                            ui,
                        ),
                        TabType::Session(id) => {
                            let title = state
                                .sessions
                                .get(id)
                                .expect("Session from host tab must exist")
                                .get_info()
                                .title
                                .as_str();
                            render_tab_button(
                                TabSpec {
                                    idx,
                                    selected: idx == state.active_tab_idx,
                                    label: TabLabel::Text(Cow::Borrowed(title)),
                                    close_request: Some(TabCloseRequest::Session(*id)),
                                },
                                chrome,
                                ui,
                            )
                        }
                        TabType::SessionSetup(id) => {
                            let title = state
                                .session_setups
                                .get(id)
                                .expect("Session setup from host tab must exist")
                                .title();
                            render_tab_button(
                                TabSpec {
                                    idx,
                                    selected: idx == state.active_tab_idx,
                                    label: TabLabel::Text(title),
                                    close_request: Some(TabCloseRequest::SessionSetup(*id)),
                                },
                                chrome,
                                ui,
                            )
                        }
                        TabType::MultiFileSetup(id) => render_tab_button(
                            TabSpec {
                                idx,
                                selected: idx == state.active_tab_idx,
                                label: TabLabel::Text(Cow::Borrowed("Multiple Files")),
                                close_request: Some(TabCloseRequest::MultiFileSetup(*id)),
                            },
                            chrome,
                            ui,
                        ),
                    };

                    if let Some(action) = action
                        && (matches!(action, TabAction::Close(_)) || pending_tab_action.is_none())
                    {
                        pending_tab_action = Some(action);
                    }
                }
            });

        let max_scroll_offset = (output.content_size.x - output.inner_rect.width()).max(0.0);
        if max_scroll_offset > 0.0 {
            let current_scroll_offset = output.state.offset.x.clamp(0.0, max_scroll_offset);
            let left_rect = chrome.scroll_button_rect(ui, control_rect, output.inner_rect, true);
            let right_rect = chrome.scroll_button_rect(ui, control_rect, output.inner_rect, false);

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

        if let Some(action) = pending_tab_action {
            self.apply_tab_action(state, actions, action);
        }
    }

    fn apply_tab_action(
        &mut self,
        state: &mut HostState,
        actions: &mut UiActions,
        action: TabAction,
    ) {
        match action {
            TabAction::Select(idx) => state.active_tab_idx = idx,
            TabAction::Close(TabCloseRequest::Session(id)) => {
                actions.add_host_action(HostAction::CloseSession(id));
            }
            TabAction::Close(TabCloseRequest::SessionSetup(id)) => {
                state
                    .session_setups
                    .get(&id)
                    .expect("Session setup from host tab must exist")
                    .close(actions);
            }
            TabAction::Close(TabCloseRequest::MultiFileSetup(id)) => {
                state
                    .multi_setups
                    .get(&id)
                    .expect("Multiple files setup from host tab must exist")
                    .close(actions);
            }
        }
    }
}

fn render_tab_scroll_button(ui: &mut Ui, rect: Rect, fade_from_left: bool, icon: &str) -> bool {
    const ICON_SIZE: f32 = 14.0;

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

    let id = ui.id().with(("host_tab_scroll_button", fade_from_left));
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

fn render_tab_content(ui: &mut Ui, rect: Rect, fg: Color32, add_content: impl FnOnce(&mut Ui)) {
    let mut content_ui = ui.new_child(
        UiBuilder::new()
            .max_rect(rect)
            .layout(Layout::centered_and_justified(Direction::LeftToRight)),
    );
    content_ui.set_clip_rect(rect);
    content_ui.visuals_mut().override_text_color = Some(fg);
    add_content(&mut content_ui);
}

fn render_tab_button(spec: TabSpec<'_>, chrome: &HostTabChrome, ui: &mut Ui) -> Option<TabAction> {
    let tab_width = match spec.label {
        TabLabel::Home => chrome.home_width,
        TabLabel::Text(..) => chrome.item_width,
    };
    let (rect, _) = ui.allocate_exact_size(vec2(tab_width, chrome.control_height), Sense::hover());

    let close_rect = spec.close_request.as_ref().map(|_| {
        Rect::from_min_max(
            pos2(rect.max.x - chrome.close_slot_width, rect.min.y),
            rect.max,
        )
    });
    let body_rect = if let Some(close_rect) = close_rect {
        Rect::from_min_max(rect.min, pos2(close_rect.min.x, rect.max.y))
    } else {
        rect
    };

    let mut body_response = ui.interact(
        body_rect,
        ui.id().with(("host_tab", spec.idx)),
        Sense::click(),
    );
    let mut action = None;

    match &spec.label {
        TabLabel::Home => {
            body_response = body_response.on_hover_ui(|ui| {
                ui.set_max_width(ui.spacing().tooltip_width);
                ui.label("Home");
            });
        }
        TabLabel::Text(label) => {
            body_response = body_response.on_hover_ui(|ui| {
                ui.set_max_width(ui.spacing().tooltip_width);
                ui.label(label.as_ref());
            });
        }
    }

    if let Some(close_request) = spec.close_request.clone() {
        body_response.context_menu(|ui| {
            if ui.button("Close").clicked() {
                action = Some(TabAction::Close(close_request));
                ui.close();
            }
        });
    }

    let close_response = close_rect.and_then(|close_rect| {
        let close_request = spec.close_request.clone()?;
        let response = ui
            .interact(
                close_rect,
                ui.id().with(("host_tab_close", spec.idx)),
                Sense::click(),
            )
            .on_hover_text("Close tab");
        if response.clicked() {
            action = Some(TabAction::Close(close_request));
        }
        Some(response)
    });

    if action.is_none() && body_response.middle_clicked() {
        if let Some(close_request) = spec.close_request {
            action = Some(TabAction::Close(close_request));
        }
    }
    if action.is_none() && body_response.clicked() {
        action = Some(TabAction::Select(spec.idx));
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
    let bg_fill = if spec.selected {
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
    let fg =
        if spec.selected || body_response.hovered() || body_response.has_focus() || close_hovered {
            accent_stroke
        } else {
            inactive_fg
        };

    if ui.is_rect_visible(rect) {
        if bg_fill != Color32::TRANSPARENT {
            ui.painter()
                .rect_filled(rect, chrome.tab_corner_radius(), bg_fill);
        }

        if spec.selected {
            let accent_rect = Rect::from_min_max(
                rect.min,
                pos2(rect.max.x, rect.min.y + chrome.selected_accent_height),
            );
            ui.painter()
                .rect_filled(accent_rect, chrome.tab_corner_radius(), accent_stroke);
        }

        let content_rect = Rect::from_min_max(
            pos2(
                body_rect.min.x + chrome.item_horizontal_padding,
                body_rect.min.y,
            ),
            pos2(
                body_rect.max.x - chrome.item_horizontal_padding,
                body_rect.max.y,
            ),
        );
        match spec.label {
            TabLabel::Home => render_tab_content(ui, content_rect, fg, |ui| {
                ui.label(
                    RichText::new(icons::fill::HOUSE)
                        .family(phosphor::fill_font_family())
                        .size(chrome.home_icon_size),
                );
            }),
            TabLabel::Text(label) => render_tab_content(ui, content_rect, fg, |ui| {
                ui.add(Label::new(label.as_ref()).truncate().halign(Align::Center));
            }),
        }

        if let Some(close_rect) = close_rect {
            ui.painter().text(
                close_rect.center(),
                Align2::CENTER_CENTER,
                icons::regular::X,
                FontId::proportional(chrome.close_icon_size),
                fg,
            );
        }
    }

    action
}

impl HostTabChrome {
    fn scroll_button_rect(
        &self,
        ui: &Ui,
        control_rect: Rect,
        viewport_rect: Rect,
        fade_from_left: bool,
    ) -> Rect {
        let button_min_x = if fade_from_left {
            viewport_rect.min.x
        } else {
            // ScrollArea clips its content with `clip_rect_margin`, so the rightmost tab can
            // still paint that far past the logical viewport edge. Cover the same overdraw so the
            // right fade button visually reaches the tab bar edge.
            control_rect.max.x - self.scroll_button_width + ui.visuals().clip_rect_margin
        };

        Rect::from_min_size(
            pos2(button_min_x, control_rect.min.y),
            vec2(self.scroll_button_width, self.total_height()),
        )
    }

    fn total_height(&self) -> f32 {
        self.top_gap + self.control_height
    }

    fn tab_strip_rect(&self, control_rect: Rect) -> Rect {
        Rect::from_min_max(
            pos2(control_rect.min.x, control_rect.max.y - self.control_height),
            control_rect.max,
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
