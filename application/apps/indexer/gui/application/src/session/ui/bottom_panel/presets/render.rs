//! Preset card rendering for browse and edit modes.

use egui::{
    Align, Button, Frame, Key, Layout, Margin, RichText, ScrollArea, Sense, Sides, StrokeKind,
    TextEdit, Ui, UiBuilder, vec2,
};

use super::{
    HostRegistry, Preset, PresetAction, PresetBrowseSection, PresetItemRow, PresetsUI,
    SearchFilter, card_metrics, icons,
};

impl PresetsUI {
    /// Renders a single fixed-size preset card in browse or edit mode.
    pub(super) fn render_preset_card(
        &mut self,
        preset: &Preset,
        registry: &HostRegistry,
        ui: &mut Ui,
        pending_action: &mut Option<PresetAction>,
    ) {
        let is_editing = self.is_editing(preset.id);
        let is_export_selected = self.is_selected_for_export(preset.id);
        ui.allocate_ui_with_layout(
            vec2(
                card_metrics::PRESET_CARD_WIDTH,
                card_metrics::PRESET_CARD_HEIGHT,
            ),
            Layout::top_down(Align::Min),
            |ui| {
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
                    } else if self.is_exporting() {
                        self.render_export_header(preset, ui, pending_action);
                    } else {
                        self.render_browse_header(preset, ui, pending_action);
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
            },
        );
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
                    *pending_action = Some(PresetAction::ToggleExportSelection(preset.id));
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
                    .button(RichText::new(icons::regular::TRASH).size(14.0))
                    .on_hover_text("Delete preset")
                    .clicked()
                {
                    *pending_action = Some(PresetAction::Delete(preset.id));
                }
                if ui
                    .button(RichText::new(icons::regular::PENCIL_SIMPLE).size(14.0))
                    .on_hover_text("Edit preset")
                    .clicked()
                {
                    self.start_edit_from_preset(preset);
                }
                if ui
                    .button(RichText::new(icons::regular::PLAY).size(14.0))
                    .on_hover_text("Apply preset")
                    .clicked()
                {
                    *pending_action = Some(PresetAction::Apply(preset.id));
                }
            });
        });
    }

    /// Renders the read-only preset contents below the card header.
    fn render_browse_body(&self, preset: &Preset, ui: &mut Ui) {
        self.render_browse_section(PresetBrowseSection::Filter, &preset.filters, ui);
        ui.separator();
        self.render_browse_section(PresetBrowseSection::SearchValue, &preset.search_values, ui);
    }

    /// Renders one browse section and its current item list.
    fn render_browse_section(
        &self,
        section: PresetBrowseSection,
        items: &[SearchFilter],
        ui: &mut Ui,
    ) {
        ui.label(section_title(section.title(), items.len()));

        if items.is_empty() {
            ui.label(RichText::new(section.empty_text()).weak());
            return;
        }

        for item in items {
            match section {
                PresetBrowseSection::Filter => self.render_filter_row(ui, item),
                PresetBrowseSection::SearchValue => self.render_search_value_row(ui, item),
            }
        }
    }

    /// Renders a browse row for a filter, including its semantic flags.
    fn render_filter_row(&self, ui: &mut Ui, filter: &SearchFilter) {
        Self::item_frame(ui).show(ui, |ui| {
            Sides::new().shrink_left().truncate().show(
                ui,
                |ui| {
                    ui.label(filter.value.as_str());
                },
                |ui| {
                    self.render_filter_flag(ui, icons::regular::ASTERISK, filter.is_regex());
                    self.render_filter_flag(ui, icons::regular::TEXT_T, filter.is_word());
                    self.render_filter_flag(ui, icons::regular::TEXT_AA, !filter.is_ignore_case());
                },
            );
        });
    }

    /// Renders a browse row for a chart/search-value entry.
    fn render_search_value_row(&self, ui: &mut Ui, filter: &SearchFilter) {
        Self::item_frame(ui).show(ui, |ui| {
            Sides::new().shrink_left().truncate().show(
                ui,
                |ui| {
                    ui.label(filter.value.as_str());
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
    fn render_filter_flag(&self, ui: &mut Ui, icon: &str, active: bool) {
        let color = if active {
            ui.visuals().text_color()
        } else {
            ui.visuals().weak_text_color()
        };
        ui.label(RichText::new(icon).size(12.0).color(color));
    }

    /// Renders the editable filter and chart lists for the active draft.
    fn render_editing_body(
        &mut self,
        preset_id: uuid::Uuid,
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
        preset_id: uuid::Uuid,
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

        ui.allocate_ui_with_layout(
            vec2(ui.available_width(), 16.0),
            Layout::right_to_left(Align::Center),
            |ui| {
                if ui
                    .button(RichText::new(icons::regular::CHECK).size(14.0))
                    .on_hover_text("Save preset")
                    .clicked()
                    || enter_pressed
                {
                    *pending_action = Some(PresetAction::SaveEdit(preset_id));
                }

                let mut cancel_edit = ui
                    .button(RichText::new(icons::regular::X).size(14.0))
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
                    *pending_action = Some(PresetAction::CancelEdit(preset_id));
                }
            },
        );
    }

    /// Renders the editable filter section and its add menu.
    fn render_edit_filters_section(
        &self,
        preset_id: uuid::Uuid,
        draft_filters: &[SearchFilter],
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
                            let already_added = draft_filters.contains(&definition.filter);
                            let response = ui
                                .add_enabled_ui(!already_added, |ui| {
                                    render_filter_picker_button(ui, &definition.filter)
                                })
                                .inner
                                .on_disabled_hover_text("Already in preset");
                            if response.clicked() {
                                *pending_action = Some(PresetAction::AddFilter(
                                    preset_id,
                                    definition.filter.clone(),
                                ));
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

        for (index, filter) in draft_filters.iter().enumerate() {
            self.render_edit_item_row(
                PresetItemRow {
                    label: filter.value.as_str(),
                    index,
                    len: draft_filters.len(),
                },
                ui,
                |from, to| PresetAction::MoveFilter(preset_id, from, to),
                |row| PresetAction::RemoveFilter(preset_id, row),
                pending_action,
            );
        }
    }

    /// Renders the editable chart section and its add menu.
    fn render_edit_search_values_section(
        &self,
        preset_id: uuid::Uuid,
        draft_search_values: &[SearchFilter],
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
                            let already_added = draft_search_values.contains(&definition.filter);
                            let response = ui
                                .add_enabled(
                                    !already_added,
                                    Button::new(definition.filter.value.as_str()),
                                )
                                .on_disabled_hover_text("Already in preset");
                            if response.clicked() {
                                *pending_action = Some(PresetAction::AddSearchValue(
                                    preset_id,
                                    definition.filter.clone(),
                                ));
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

        for (index, filter) in draft_search_values.iter().enumerate() {
            self.render_edit_item_row(
                PresetItemRow {
                    label: filter.value.as_str(),
                    index,
                    len: draft_search_values.len(),
                },
                ui,
                |from, to| PresetAction::MoveSearchValue(preset_id, from, to),
                |row| PresetAction::RemoveSearchValue(preset_id, row),
                pending_action,
            );
        }
    }

    /// Renders one editable preset row and emits deferred mutations for its controls.
    fn render_edit_item_row<FMove, FRemove>(
        &self,
        row: PresetItemRow<'_>,
        ui: &mut Ui,
        move_action: FMove,
        remove_action: FRemove,
        pending_action: &mut Option<PresetAction>,
    ) where
        FMove: Fn(usize, usize) -> PresetAction,
        FRemove: Fn(usize) -> PresetAction,
    {
        Sides::new().shrink_left().truncate().show(
            ui,
            |ui| {
                ui.label(row.label);
            },
            |ui| {
                // Mutations are deferred until after rendering so the
                // immediate-mode traversal does not edit the active list in place.
                if ui
                    .button(
                        RichText::new(icons::regular::TRASH)
                            .size(card_metrics::PRESET_EDIT_ITEM_ICON_SIZE),
                    )
                    .on_hover_text("Remove from preset")
                    .clicked()
                {
                    *pending_action = Some(remove_action(row.index));
                }

                let can_move_down = row.index + 1 < row.len;
                if ui
                    .add_enabled(
                        can_move_down,
                        Button::new(
                            RichText::new(icons::regular::CARET_DOWN)
                                .size(card_metrics::PRESET_EDIT_ITEM_ICON_SIZE),
                        ),
                    )
                    .on_hover_text("Move down")
                    .clicked()
                {
                    *pending_action = Some(move_action(row.index, row.index + 1));
                }

                let can_move_up = row.index > 0;
                if ui
                    .add_enabled(
                        can_move_up,
                        Button::new(
                            RichText::new(icons::regular::CARET_UP)
                                .size(card_metrics::PRESET_EDIT_ITEM_ICON_SIZE),
                        ),
                    )
                    .on_hover_text("Move up")
                    .clicked()
                {
                    *pending_action = Some(move_action(row.index, row.index - 1));
                }
            },
        );
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

fn render_filter_picker_button(ui: &mut Ui, filter: &SearchFilter) -> egui::Response {
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

#[cfg(test)]
mod tests {
    use super::section_title;

    #[test]
    fn section_title_shows_count() {
        assert_eq!(section_title("Filters", 3), "Filters (3)");
        assert_eq!(section_title("Charts", 0), "Charts (0)");
    }
}
