//! Preset card rendering for browse and edit modes.

use egui::{
    Align, Color32, Frame, Key, Layout, Margin, Response, RichText, ScrollArea, Sense, Sides,
    StrokeKind, TextEdit, Ui, UiBuilder, vec2,
};
use uuid::Uuid;

use processor::search::filter::SearchFilter;

use crate::{
    common::{phosphor::icons, ui::buttons},
    host::ui::registry::{
        HostRegistry,
        presets::{Preset, PresetFilterEntry, PresetSearchValueEntry},
    },
};

use super::{PresetAction, PresetsUI};

mod card_metrics {
    pub const PRESET_CARD_WIDTH: f32 = 280.0;
    pub const PRESET_CARD_HEIGHT: f32 = 160.0;
    pub const PRESET_CARD_INNER_MARGIN_X: i8 = 12;
    pub const PRESET_CARD_INNER_MARGIN_Y: i8 = 8;
    pub const PRESET_CARD_OUTER_MARGIN_Y: i8 = 4;
    pub const PRESET_CARD_HEADER_GAP: f32 = 4.0;
    pub const PRESET_EDIT_ITEM_ICON_SIZE: f32 = 12.0;
    pub const PRESET_CARD_CONTENT_WIDTH: f32 =
        PRESET_CARD_WIDTH - (PRESET_CARD_INNER_MARGIN_X as f32 * 2.0);
    pub const PRESET_CARD_CONTENT_HEIGHT: f32 = PRESET_CARD_HEIGHT
        - ((PRESET_CARD_INNER_MARGIN_Y as f32 + PRESET_CARD_OUTER_MARGIN_Y as f32) * 2.0);
}

/// Render-time metadata for a single editable preset row.
#[derive(Debug, Clone, Copy)]
struct PresetItemRow<'a> {
    label: &'a str,
    enabled: bool,
    color: Color32,
    index: usize,
    len: usize,
}

/// Logical sections shared by preset browse and edit rendering.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PresetBrowseSection {
    Filter,
    SearchValue,
}

impl PresetsUI {
    /// Renders a single fixed-size preset card and returns its container response.
    pub fn render_preset_card(
        &mut self,
        preset: &Preset,
        registry: &HostRegistry,
        ui: &mut Ui,
        pending_action: &mut Option<PresetAction>,
    ) -> Response {
        let is_editing = self.is_editing(preset.id);
        let is_export_selected = self.is_selected_for_export(preset.id);
        let card_size = vec2(
            card_metrics::PRESET_CARD_WIDTH,
            card_metrics::PRESET_CARD_HEIGHT,
        );
        ui.allocate_ui_with_layout(card_size, Layout::top_down(Align::Min), |ui| {
            let visuals = ui.visuals();
            let mut frame = Frame::group(ui.style())
                .fill(visuals.faint_bg_color)
                .inner_margin(Margin::symmetric(
                    card_metrics::PRESET_CARD_INNER_MARGIN_X,
                    card_metrics::PRESET_CARD_INNER_MARGIN_Y,
                ))
                .outer_margin(Margin::symmetric(
                    0,
                    card_metrics::PRESET_CARD_OUTER_MARGIN_Y,
                ));
            if is_editing {
                frame = frame
                    .fill(visuals.widgets.open.bg_fill)
                    .stroke(visuals.selection.stroke);
            } else if is_export_selected {
                frame = frame.stroke(visuals.selection.stroke);
            }

            frame.show(ui, |ui| {
                // Lock the inner card size so long content cannot widen or
                // stretch cards inside the wrapped layout.
                ui.set_width(card_metrics::PRESET_CARD_CONTENT_WIDTH);
                ui.set_height(card_metrics::PRESET_CARD_CONTENT_HEIGHT);
                if is_editing {
                    self.render_edit_header(preset.id, ui, pending_action);
                    if let Some(edit_state) = self
                        .edit_state
                        .as_ref()
                        .filter(|state| state.preset_id == preset.id)
                    {
                        let summary = entries_summary(
                            &edit_state.draft_filters,
                            &edit_state.draft_search_values,
                        );
                        ui.label(RichText::new(summary).weak().size(11.0));
                    }
                } else if self.is_exporting() {
                    self.render_export_header(preset, ui, pending_action);
                    let summary = entries_summary(&preset.filters, &preset.search_values);
                    ui.label(RichText::new(summary).weak().size(11.0));
                } else {
                    self.render_browse_header(preset, ui, pending_action);
                    let summary = entries_summary(&preset.filters, &preset.search_values);
                    ui.label(RichText::new(summary).weak().size(11.0));
                }

                ui.add_space(card_metrics::PRESET_CARD_HEADER_GAP);

                ScrollArea::vertical()
                    .id_salt(("preset_card_body", preset.id))
                    .auto_shrink(false)
                    .show(ui, |ui| {
                        Frame::NONE
                            .inner_margin(Margin {
                                left: 1,
                                right: 6,
                                top: 0,
                                bottom: 0,
                            })
                            .show(ui, |ui| {
                                if is_editing {
                                    self.render_editing_body(
                                        preset.id,
                                        registry,
                                        ui,
                                        pending_action,
                                    );
                                } else {
                                    self.render_browse_body(preset, ui);
                                }
                            });
                    });
            });
        })
        .response
    }

    /// Renders the export-mode header with a single inclusion checkbox.
    fn render_export_header(
        &self,
        preset: &Preset,
        ui: &mut Ui,
        pending_action: &mut Option<PresetAction>,
    ) {
        ui.horizontal(|ui| {
            ui.label(RichText::new(preset.name.as_str()).strong());
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                let mut selected = self.is_selected_for_export(preset.id);
                if ui
                    .checkbox(&mut selected, "")
                    .on_hover_text("Include preset in export")
                    .changed()
                {
                    let action = PresetAction::ToggleExportSelection(preset.id);
                    *pending_action = Some(action);
                }
            });
        });
    }

    /// Renders the browse-mode header actions for a preset card.
    fn render_browse_header(
        &mut self,
        preset: &Preset,
        ui: &mut Ui,
        pending_action: &mut Option<PresetAction>,
    ) {
        ui.horizontal(|ui| {
            ui.label(RichText::new(preset.name.as_str()).strong());
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                if ui
                    .add(buttons::bottom_panel_icon(
                        RichText::new(icons::regular::TRASH).size(14.0),
                    ))
                    .on_hover_text("Delete preset")
                    .clicked()
                {
                    let action = PresetAction::Delete(preset.id);
                    *pending_action = Some(action);
                }
                if ui
                    .add(buttons::bottom_panel_icon(
                        RichText::new(icons::regular::PENCIL_SIMPLE).size(14.0),
                    ))
                    .on_hover_text("Edit preset")
                    .clicked()
                {
                    self.start_edit_from_preset(preset);
                }
                if ui
                    .add(buttons::bottom_panel_icon(
                        RichText::new(icons::regular::PLAY).size(14.0),
                    ))
                    .on_hover_text("Apply preset")
                    .clicked()
                {
                    let action = PresetAction::Apply(preset.id);
                    *pending_action = Some(action);
                }
            });
        });
    }

    /// Renders the read-only preset contents below the card header.
    fn render_browse_body(&self, preset: &Preset, ui: &mut Ui) {
        self.render_browse_filters(&preset.filters, ui);
        ui.separator();
        self.render_browse_search_values(&preset.search_values, ui);
    }

    /// Renders the browse filter list.
    fn render_browse_filters(&self, items: &[PresetFilterEntry], ui: &mut Ui) {
        let section = PresetBrowseSection::Filter;
        ui.label(section_title(section.title(), items.len()));

        if items.is_empty() {
            ui.label(RichText::new(section.empty_text()).weak());
            return;
        }

        for item in items {
            self.render_filter_row(ui, item);
        }
    }

    /// Renders the browse chart/search-value list.
    fn render_browse_search_values(&self, items: &[PresetSearchValueEntry], ui: &mut Ui) {
        let section = PresetBrowseSection::SearchValue;
        ui.label(section_title(section.title(), items.len()));

        if items.is_empty() {
            ui.label(RichText::new(section.empty_text()).weak());
            return;
        }

        for item in items {
            self.render_search_value_row(ui, item);
        }
    }

    /// Renders a browse row for a filter, including its matching flags.
    fn render_filter_row(&self, ui: &mut Ui, item: &PresetFilterEntry) {
        Self::item_frame(ui).show(ui, |ui| {
            Sides::new().shrink_left().truncate().show(
                ui,
                |ui| {
                    Self::render_readonly_checkbox(ui, item.enabled);
                    Self::render_color_swatch(ui, item.colors.bg);
                    Self::render_item_label(ui, item.filter.value.as_str(), item.enabled);
                },
                |ui| {
                    self.render_filter_flag(
                        ui,
                        icons::regular::ASTERISK,
                        item.filter.is_regex(),
                        item.enabled,
                    );
                    self.render_filter_flag(
                        ui,
                        icons::regular::TEXT_T,
                        item.filter.is_word(),
                        item.enabled,
                    );
                    self.render_filter_flag(
                        ui,
                        icons::regular::TEXT_AA,
                        !item.filter.is_ignore_case(),
                        item.enabled,
                    );
                },
            );
        });
    }

    /// Renders a browse row for a chart/search-value entry.
    fn render_search_value_row(&self, ui: &mut Ui, item: &PresetSearchValueEntry) {
        Self::item_frame(ui).show(ui, |ui| {
            Sides::new().shrink_left().truncate().show(
                ui,
                |ui| {
                    Self::render_readonly_checkbox(ui, item.enabled);
                    Self::render_color_swatch(ui, item.color);
                    Self::render_item_label(ui, item.filter.value.as_str(), item.enabled);
                },
                |_ui| {},
            );
        });
    }

    /// Returns the shared background-only row frame used across browse and edit lists.
    fn item_frame(ui: &Ui) -> Frame {
        Frame::new()
            .fill(ui.visuals().panel_fill)
            .inner_margin(Margin::symmetric(6, 4))
    }

    /// Renders a filter flag icon with active or weak emphasis.
    fn render_filter_flag(&self, ui: &mut Ui, icon: &str, active: bool, enabled: bool) {
        let color = if active && enabled {
            ui.visuals().text_color()
        } else {
            ui.visuals().weak_text_color()
        };
        ui.label(RichText::new(icon).size(12.0).color(color));
    }

    /// Renders the saved enabled state without allowing browse-mode changes.
    fn render_readonly_checkbox(ui: &mut Ui, enabled: bool) {
        let mut value = enabled;
        let response = ui
            .add_enabled_ui(false, |ui| ui.checkbox(&mut value, ""))
            .inner;
        response.on_disabled_hover_ui(|ui| {
            ui.set_max_width(ui.spacing().tooltip_width);
            if enabled {
                ui.label("Saved as enabled");
            } else {
                ui.label("Saved as disabled");
            }
        });
    }

    /// Renders an editable enabled-state checkbox and returns whether it changed.
    fn render_enabled_checkbox(ui: &mut Ui, enabled: bool) -> bool {
        let mut value = enabled;
        ui.checkbox(&mut value, "")
            .on_hover_ui(|ui| {
                ui.set_max_width(ui.spacing().tooltip_width);
                if enabled {
                    ui.label("Save this row as disabled");
                } else {
                    ui.label("Save this row as enabled");
                }
            })
            .changed()
    }

    /// Renders a row label with disabled rows visually muted.
    fn render_item_label(ui: &mut Ui, label: &str, enabled: bool) {
        if enabled {
            ui.label(label);
        } else {
            ui.label(RichText::new(label).weak());
        }
    }

    /// Renders the compact row color swatch.
    fn render_color_swatch(ui: &mut Ui, color: Color32) {
        const ITEM_SWATCH_SIZE: egui::Vec2 = vec2(10.0, 20.0);

        let (response, painter) = ui.allocate_painter(ITEM_SWATCH_SIZE, Sense::hover());
        painter.rect_filled(response.rect, 2.0, color);
    }

    /// Renders the editable filter and chart lists for the active draft.
    fn render_editing_body(
        &mut self,
        preset_id: Uuid,
        registry: &HostRegistry,
        ui: &mut Ui,
        pending_action: &mut Option<PresetAction>,
    ) {
        let Some(edit_state) = self.edit_state.as_ref() else {
            return;
        };

        self.render_edit_filters_section(
            preset_id,
            &edit_state.draft_filters,
            registry,
            ui,
            pending_action,
        );
        ui.separator();
        self.render_edit_search_values_section(
            preset_id,
            &edit_state.draft_search_values,
            registry,
            ui,
            pending_action,
        );
    }

    /// Renders the edit-mode header, including scoped save and cancel shortcuts.
    fn render_edit_header(
        &mut self,
        preset_id: Uuid,
        ui: &mut Ui,
        pending_action: &mut Option<PresetAction>,
    ) {
        let Some(edit_state) = self.edit_state.as_mut() else {
            return;
        };
        if edit_state.preset_id != preset_id {
            return;
        }

        let draft_name_id = ui.id().with(("preset_edit_name", preset_id));
        let draft_name_has_focus = ui.memory(|memory| memory.has_focus(draft_name_id));
        let enter_pressed = ui.input_mut(|input| {
            // Scope save to the draft-name field so other controls, including
            // the top preset search box, do not trigger it.
            draft_name_has_focus && input.consume_key(egui::Modifiers::NONE, Key::Enter)
        });

        let header_size = vec2(ui.available_width(), 16.0);
        ui.allocate_ui_with_layout(header_size, Layout::right_to_left(Align::Center), |ui| {
            if ui
                .add(buttons::bottom_panel_icon(
                    RichText::new(icons::regular::CHECK).size(14.0),
                ))
                .on_hover_text("Save preset")
                .clicked()
                || enter_pressed
            {
                let action = PresetAction::SaveEdit(preset_id);
                *pending_action = Some(action);
            }

            let mut cancel_edit = ui
                .add(buttons::bottom_panel_icon(
                    RichText::new(icons::regular::X).size(14.0),
                ))
                .on_hover_text("Cancel edit")
                .clicked();

            ui.with_layout(Layout::left_to_right(Align::Center), |ui| {
                let mut text_edit = TextEdit::singleline(&mut edit_state.draft_name)
                    .id(draft_name_id)
                    .desired_width(f32::INFINITY)
                    .show(ui);

                // Input text will lose focus directly on pressing escape which can
                // be used as indicator of escape pressed while input text in focus.
                let escape_pressed = text_edit.response.lost_focus()
                    && text_edit
                        .response
                        .ctx
                        .input(|input| input.key_pressed(Key::Escape));

                if escape_pressed {
                    cancel_edit = true;
                }

                if edit_state.first_render_frame {
                    // Entering edit mode should focus the draft name once,
                    // without re-stealing focus on later frames.
                    text_edit.state.cursor.set_char_range(None);
                    text_edit.state.store(ui.ctx(), text_edit.response.id);
                    text_edit.response.request_focus();
                    edit_state.first_render_frame = false;
                }
            });

            if cancel_edit {
                let action = PresetAction::CancelEdit(preset_id);
                *pending_action = Some(action);
            }
        });
    }

    /// Renders the editable filter section and its add menu.
    fn render_edit_filters_section(
        &self,
        preset_id: Uuid,
        draft_filters: &[PresetFilterEntry],
        registry: &HostRegistry,
        ui: &mut Ui,
        pending_action: &mut Option<PresetAction>,
    ) {
        ui.horizontal(|ui| {
            ui.label(RichText::new(section_title("Filters", draft_filters.len())).strong());
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                ui.menu_button(
                    RichText::new(icons::regular::PLUS)
                        .size(card_metrics::PRESET_EDIT_ITEM_ICON_SIZE),
                    |ui| {
                        ui.set_max_width(150.0);
                        // This allocation will happen only when the menu is opened
                        // making it not worthy for caching optimizations.
                        let mut filters =
                            registry.filters.filters_map().values().collect::<Vec<_>>();
                        // Keep the picker stable across frames instead of exposing
                        // registry hash-map iteration order.
                        filters.sort_unstable_by(|left, right| {
                            let left = &left.filter;
                            let right = &right.filter;
                            left.value
                                .cmp(&right.value)
                                .then_with(|| left.is_regex().cmp(&right.is_regex()))
                                .then_with(|| left.is_word().cmp(&right.is_word()))
                                .then_with(|| {
                                    (!left.is_ignore_case()).cmp(&(!right.is_ignore_case()))
                                })
                        });

                        if filters.is_empty() {
                            ui.label(RichText::new("No filter definitions in library").weak());
                        }

                        for definition in filters {
                            let already_added = draft_filters
                                .iter()
                                .any(|entry| entry.filter == definition.filter);
                            let response = ui
                                .add_enabled_ui(!already_added, |ui| {
                                    render_filter_picker_button(ui, &definition.filter)
                                })
                                .inner
                                .on_disabled_hover_text("Already in preset");
                            if response.clicked() {
                                let action =
                                    PresetAction::AddFilter(preset_id, definition.filter.clone());
                                *pending_action = Some(action);
                                ui.close();
                            }
                        }
                    },
                )
                .response
                .on_hover_text("Add filter");
            });
        });

        if draft_filters.is_empty() {
            ui.label(RichText::new("No filters in this preset").weak());
            return;
        }

        for (index, entry) in draft_filters.iter().enumerate() {
            self.render_edit_item_row(
                PresetItemRow {
                    label: entry.filter.value.as_str(),
                    enabled: entry.enabled,
                    color: entry.colors.bg,
                    index,
                    len: draft_filters.len(),
                },
                ui,
                |row| PresetAction::ToggleFilterEnabled(preset_id, row),
                |from, to| PresetAction::MoveFilter(preset_id, from, to),
                |row| PresetAction::RemoveFilter(preset_id, row),
                pending_action,
            );
        }
    }

    /// Renders the editable chart section and its add menu.
    fn render_edit_search_values_section(
        &self,
        preset_id: Uuid,
        draft_search_values: &[PresetSearchValueEntry],
        registry: &HostRegistry,
        ui: &mut Ui,
        pending_action: &mut Option<PresetAction>,
    ) {
        ui.horizontal(|ui| {
            ui.label(RichText::new(section_title("Charts", draft_search_values.len())).strong());
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                ui.menu_button(
                    RichText::new(icons::regular::PLUS)
                        .size(card_metrics::PRESET_EDIT_ITEM_ICON_SIZE),
                    |ui| {
                        let mut values = registry
                            .filters
                            .search_value_map()
                            .values()
                            .collect::<Vec<_>>();
                        // Keep the picker stable across frames instead of exposing
                        // registry hash-map iteration order.
                        values.sort_by(|left, right| left.filter.value.cmp(&right.filter.value));

                        if values.is_empty() {
                            ui.label(RichText::new("No chart definitions in library").weak());
                        }

                        for definition in values {
                            let already_added = draft_search_values
                                .iter()
                                .any(|entry| entry.filter == definition.filter);
                            let response = ui
                                .add_enabled(
                                    !already_added,
                                    buttons::bottom_panel(definition.filter.value.as_str()),
                                )
                                .on_disabled_hover_text("Already in preset");
                            if response.clicked() {
                                let action = PresetAction::AddSearchValue(
                                    preset_id,
                                    definition.filter.clone(),
                                );
                                *pending_action = Some(action);
                                ui.close();
                            }
                        }
                    },
                )
                .response
                .on_hover_text("Add chart");
            });
        });

        if draft_search_values.is_empty() {
            ui.label(RichText::new("No charts in this preset").weak());
            return;
        }

        for (index, entry) in draft_search_values.iter().enumerate() {
            self.render_edit_item_row(
                PresetItemRow {
                    label: entry.filter.value.as_str(),
                    enabled: entry.enabled,
                    color: entry.color,
                    index,
                    len: draft_search_values.len(),
                },
                ui,
                |row| PresetAction::ToggleSearchValueEnabled(preset_id, row),
                |from, to| PresetAction::MoveSearchValue(preset_id, from, to),
                |row| PresetAction::RemoveSearchValue(preset_id, row),
                pending_action,
            );
        }
    }

    /// Renders one editable preset row and emits deferred mutations for its controls.
    fn render_edit_item_row<FToggle, FMove, FRemove>(
        &self,
        row: PresetItemRow<'_>,
        ui: &mut Ui,
        toggle_action: FToggle,
        move_action: FMove,
        remove_action: FRemove,
        pending_action: &mut Option<PresetAction>,
    ) where
        FToggle: Fn(usize) -> PresetAction,
        FMove: Fn(usize, usize) -> PresetAction,
        FRemove: Fn(usize) -> PresetAction,
    {
        let (toggle, controls) = Sides::new().shrink_left().truncate().show(
            ui,
            |ui| {
                let mut action = None;
                if Self::render_enabled_checkbox(ui, row.enabled) {
                    action = Some(toggle_action(row.index));
                }
                Self::render_color_swatch(ui, row.color);
                Self::render_item_label(ui, row.label, row.enabled);
                action
            },
            |ui| {
                let mut action = None;
                // Mutations are deferred until after rendering so the
                // immediate-mode traversal does not edit the active list in place.
                if ui
                    .add(buttons::bottom_panel_icon(
                        RichText::new(icons::regular::TRASH)
                            .size(card_metrics::PRESET_EDIT_ITEM_ICON_SIZE),
                    ))
                    .on_hover_text("Remove from preset")
                    .clicked()
                {
                    action = Some(remove_action(row.index));
                }

                let can_move_down = row.index + 1 < row.len;
                if ui
                    .add_enabled(
                        can_move_down,
                        buttons::bottom_panel_icon(
                            RichText::new(icons::regular::CARET_DOWN)
                                .size(card_metrics::PRESET_EDIT_ITEM_ICON_SIZE),
                        ),
                    )
                    .on_hover_text("Move down")
                    .clicked()
                {
                    action = Some(move_action(row.index, row.index + 1));
                }

                let can_move_up = row.index > 0;
                if ui
                    .add_enabled(
                        can_move_up,
                        buttons::bottom_panel_icon(
                            RichText::new(icons::regular::CARET_UP)
                                .size(card_metrics::PRESET_EDIT_ITEM_ICON_SIZE),
                        ),
                    )
                    .on_hover_text("Move up")
                    .clicked()
                {
                    action = Some(move_action(row.index, row.index - 1));
                }
                action
            },
        );

        if let Some(action) = toggle.or(controls) {
            *pending_action = Some(action);
        }
    }
}

impl PresetBrowseSection {
    /// Returns the user-facing title for the browse/edit section header.
    fn title(self) -> &'static str {
        match self {
            Self::Filter => "Filters",
            Self::SearchValue => "Charts",
        }
    }

    /// Returns the empty-state copy for the browse/edit section body.
    fn empty_text(self) -> &'static str {
        match self {
            Self::Filter => "No filters in this preset",
            Self::SearchValue => "No charts in this preset",
        }
    }
}

/// Formats a section header with its current item count.
fn section_title(title: &str, count: usize) -> String {
    format!("{title} ({count})")
}

/// Formats the compact card summary for filters, charts, and disabled rows.
fn entries_summary(
    filters: &[PresetFilterEntry],
    search_values: &[PresetSearchValueEntry],
) -> String {
    let disabled_count = filters.iter().filter(|entry| !entry.enabled).count()
        + search_values.iter().filter(|entry| !entry.enabled).count();

    let filters_count = filters.len();
    let filters_label = if filters_count == 1 {
        "filter"
    } else {
        "filters"
    };
    let charts_count = search_values.len();
    let charts_label = if charts_count == 1 { "chart" } else { "charts" };

    format!(
        "{filters_count} {filters_label} · {charts_count} {charts_label} · {disabled_count} disabled"
    )
}

fn render_filter_picker_button(ui: &mut Ui, filter: &SearchFilter) -> Response {
    let desired_size = vec2(ui.available_width(), ui.spacing().interact_size.y);
    let (_, response) = ui.allocate_exact_size(desired_size, Sense::click());
    let button_padding = ui.spacing().button_padding;

    // `interact(&response)` already chose hovered/active/inactive visuals.
    let visuals = ui.style().interact(&response);
    let active_color = visuals.text_color();
    let inactive_color = if response.enabled() {
        ui.visuals().weak_text_color()
    } else {
        active_color.gamma_multiply(0.6)
    };

    // This guard only avoids emitting paint for rows clipped out of the menu.
    if ui.is_rect_visible(response.rect) {
        ui.painter().rect(
            response.rect.expand(visuals.expansion),
            visuals.corner_radius,
            visuals.weak_bg_fill,
            visuals.bg_stroke,
            StrokeKind::Inside,
        );
    }

    // Keep the button hitbox and hover visuals from egui while rendering the
    // label/flags with `Sides` so the left text truncates before the icons move.
    let mut overlay_ui = ui.new_child(
        UiBuilder::new()
            .max_rect(response.rect.shrink2(button_padding))
            .layout(Layout::left_to_right(Align::Center)),
    );
    Sides::new().shrink_left().truncate().show(
        &mut overlay_ui,
        |ui| {
            ui.label(RichText::new(filter.value.as_str()).color(active_color));
        },
        |ui| {
            let icon_size = 12.0;
            ui.label(
                RichText::new(icons::regular::ASTERISK)
                    .size(icon_size)
                    .color(if filter.is_regex() {
                        active_color
                    } else {
                        inactive_color
                    }),
            );
            ui.label(RichText::new(icons::regular::TEXT_T).size(icon_size).color(
                if filter.is_word() {
                    active_color
                } else {
                    inactive_color
                },
            ));
            ui.label(
                RichText::new(icons::regular::TEXT_AA)
                    .size(icon_size)
                    .color(if !filter.is_ignore_case() {
                        active_color
                    } else {
                        inactive_color
                    }),
            );
        },
    );

    response
}
