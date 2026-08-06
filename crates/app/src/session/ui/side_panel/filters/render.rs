//! Filters sidebar list rendering and inline editing.

use egui::{
    Align, Button, Color32, CursorIcon, Frame, Key, Layout, Modifiers, Response, RichText, Sense,
    Sides, TextEdit, Ui, UiBuilder, Vec2, vec2,
};
use processor::search::filter::SearchFilter;
use uuid::Uuid;

use crate::{
    common::{
        phosphor::icons,
        ui::buttons,
        validation::{ValidationEligibility, validate_filter, validate_search_value_filter},
    },
    host::ui::registry::filters::FilterRegistry,
    session::ui::shared::SessionShared,
};

use super::actions::FilterPanelAction;
use super::drag_drop::{self, SidebarDrag, SidebarDropTarget};
use super::{FilterFlags, FiltersUi, SelectedSidebarItem, TextEditState};

fn validate_filter_text(flags: FilterFlags, draft: &str) -> Option<String> {
    let FilterFlags {
        regex,
        ignore_case,
        word,
    } = flags;
    let next_filter = SearchFilter::plain(draft)
        .regex(regex)
        .ignore_case(ignore_case)
        .word(word);

    match validate_filter(&next_filter) {
        ValidationEligibility::Eligible => None,
        ValidationEligibility::Ineligible { reason } => Some(reason),
    }
}

/// Validates a search-value text draft while preserving the current
/// definition flags so text edits do not silently change search semantics.
pub fn validate_search_value_text(current_filter: &SearchFilter, draft: &str) -> Option<String> {
    let mut next_filter = current_filter.clone();
    next_filter.value = draft.to_owned();
    match validate_search_value_filter(&next_filter) {
        ValidationEligibility::Eligible => None,
        ValidationEligibility::Ineligible { reason } => Some(reason),
    }
}

#[derive(Debug, Clone)]
struct FilterRowView<'a> {
    id: Uuid,
    enabled: bool,
    color: Color32,
    text: &'a str,
    flags: FilterFlags,
    search_value_eligibility: &'a ValidationEligibility,
    regex_enable_eligibility: &'a ValidationEligibility,
}

#[derive(Debug, Clone)]
struct SearchValueRowView<'a> {
    id: Uuid,
    enabled: bool,
    color: Color32,
    text: &'a str,
    filter: SearchFilter,
}

impl FiltersUi {
    /// Renders the filter rows and records their deferred action.
    pub(super) fn render_filters_group(
        &mut self,
        shared: &SessionShared,
        registry: &FilterRegistry,
        dnd_enabled: bool,
        ui: &mut Ui,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        let filters_count = shared.filters.filter_entries.len();
        let target = SidebarDropTarget::Filter;
        let drop_action =
            drag_drop::render_group(ui, registry, target, filters_count, dnd_enabled, |ui| {
                Self::render_group_heading(ui, "Filters", filters_count);
                ui.add_space(5.0);
                self.render_filters_section(shared, registry, dnd_enabled, ui, side_action);
            });
        if let Some(drop_action) = drop_action {
            *side_action = Some(drop_action);
        }
    }

    /// Renders the chart rows and records their deferred action.
    pub(super) fn render_search_values_group(
        &mut self,
        shared: &SessionShared,
        registry: &FilterRegistry,
        dnd_enabled: bool,
        ui: &mut Ui,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        let charts_count = shared.filters.search_value_entries.len();
        let target = SidebarDropTarget::SearchValue;
        let drop_action =
            drag_drop::render_group(ui, registry, target, charts_count, dnd_enabled, |ui| {
                Self::render_group_heading(ui, "Charts", charts_count);
                ui.add_space(5.0);
                self.render_search_values_section(shared, registry, dnd_enabled, ui, side_action);
            });
        if let Some(drop_action) = drop_action {
            *side_action = Some(drop_action);
        }
    }

    fn render_filters_section(
        &mut self,
        shared: &SessionShared,
        registry: &FilterRegistry,
        dnd_enabled: bool,
        ui: &mut Ui,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        let mut have_items = false;
        for (index, item) in shared.filters.filter_entries.iter().enumerate() {
            let Some(def) = registry.get_filter(&item.id) else {
                continue;
            };
            let row = FilterRowView {
                id: item.id,
                enabled: item.enabled,
                color: item.colors.bg,
                text: def.filter.value.as_str(),
                flags: FilterFlags {
                    regex: def.filter.is_regex(),
                    ignore_case: def.filter.is_ignore_case(),
                    word: def.filter.is_word(),
                },
                search_value_eligibility: &def.search_value_eligibility,
                regex_enable_eligibility: &def.regex_enable_eligibility,
            };

            have_items = true;
            self.render_filter_item(ui, &row, index, registry, dnd_enabled, side_action);
        }

        if !have_items {
            ui.label(RichText::new("No filters applied").weak());
        }
    }

    fn render_search_values_section(
        &mut self,
        shared: &SessionShared,
        registry: &FilterRegistry,
        dnd_enabled: bool,
        ui: &mut Ui,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        let mut has_items = false;
        for (index, item) in shared.filters.search_value_entries.iter().enumerate() {
            let Some(def) = registry.get_search_value(&item.id) else {
                continue;
            };
            let row = SearchValueRowView {
                id: item.id,
                enabled: item.enabled,
                color: item.color,
                text: def.filter.value.as_str(),
                filter: def.filter.clone(),
            };

            has_items = true;
            self.render_search_value_item(ui, &row, index, registry, dnd_enabled, side_action);
        }

        if !has_items {
            ui.label(RichText::new("No Charts applied").weak());
        }
    }

    fn render_filter_item(
        &mut self,
        ui: &mut Ui,
        row: &FilterRowView,
        index: usize,
        registry: &FilterRegistry,
        dnd_enabled: bool,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        let mut edit_state = self.take_filter_edit_state(row.id);
        let is_editing = edit_state.is_some();
        let item = SelectedSidebarItem::Filter(row.id);
        let drag = dnd_enabled.then(|| SidebarDrag::new(item, index));
        if let Some(action) = self.render_sidebar_item(
            ui,
            item,
            drag,
            registry,
            |ui, side_action| {
                let action = if let Some(edit_state) = edit_state.as_mut() {
                    ui.push_id((row.id, "filter_edit"), |ui| {
                        Self::render_text_edit_row(
                            ui,
                            row.id,
                            edit_state,
                            |draft| validate_filter_text(row.flags, draft),
                            FilterPanelAction::ApplyFilterText,
                            FilterPanelAction::CancelFilterEdit,
                        )
                    })
                    .inner
                } else {
                    ui.push_id((row.id, "filter_display"), |ui| {
                        Self::render_filter_display_row(ui, row)
                    })
                    .inner
                };

                if let Some(action) = action {
                    *side_action = Some(action);
                }
            },
            |ui, side_action| {
                let toggle_label = if row.enabled {
                    "Disable Filter"
                } else {
                    "Enable Filter"
                };
                if ui.button(toggle_label).clicked() {
                    *side_action = Some(FilterPanelAction::ToggleFilter(row.id, !row.enabled));
                    ui.close();
                }

                let edit_btn = ui.add_enabled(!is_editing, Button::new("Edit Filter"));
                if edit_btn.clicked() {
                    *side_action = Some(FilterPanelAction::StartFilterEdit(row.id));
                    ui.close();
                }

                ui.separator();

                if ui.button("Remove Filter").clicked() {
                    *side_action = Some(FilterPanelAction::RemoveFilter(row.id));
                    ui.close();
                }

                if ui.button("Remove All Filters").clicked() {
                    *side_action = Some(FilterPanelAction::RemoveAllFilters);
                    ui.close();
                }

                let mut move_btn = ui
                    .add_enabled(
                        row.search_value_eligibility.is_eligible(),
                        Button::new("Move to Charts"),
                    )
                    .on_hover_text("Move to Charts");

                match &row.search_value_eligibility {
                    ValidationEligibility::Eligible => {}
                    ValidationEligibility::Ineligible { reason } => {
                        move_btn = move_btn.on_disabled_hover_text(format!("Chart: {reason}"));
                    }
                };

                if move_btn.clicked() {
                    *side_action = Some(FilterPanelAction::MoveFilterToValue(row.id, None));
                    ui.close();
                }

                ui.separator();

                if ui.button("Create Preset from Session").clicked() {
                    *side_action = Some(FilterPanelAction::CapturePreset);
                    ui.close();
                }
            },
        ) {
            *side_action = Some(action);
        }

        if let Some(edit_state) = edit_state {
            self.filter_edit_state = Some(edit_state);
        }
    }

    fn render_search_value_item(
        &mut self,
        ui: &mut Ui,
        row: &SearchValueRowView,
        index: usize,
        registry: &FilterRegistry,
        dnd_enabled: bool,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        let mut edit_state = self.take_search_value_edit_state(row.id);
        let is_editing = edit_state.is_some();
        let item = SelectedSidebarItem::SearchValue(row.id);
        let drag = dnd_enabled.then(|| SidebarDrag::new(item, index));
        if let Some(action) = self.render_sidebar_item(
            ui,
            item,
            drag,
            registry,
            |ui, side_action| {
                let action = if let Some(edit_state) = edit_state.as_mut() {
                    ui.push_id((row.id, "search_value_edit"), |ui| {
                        Self::render_text_edit_row(
                            ui,
                            row.id,
                            edit_state,
                            |draft| validate_search_value_text(&row.filter, draft),
                            FilterPanelAction::ApplySearchValueText,
                            FilterPanelAction::CancelSearchValueEdit,
                        )
                    })
                    .inner
                } else {
                    ui.push_id((row.id, "search_value_display"), |ui| {
                        Self::render_search_value_display_row(ui, row)
                    })
                    .inner
                };

                if let Some(action) = action {
                    *side_action = Some(action);
                }
            },
            |ui, side_action| {
                let toggle_label = if row.enabled {
                    "Disable Chart"
                } else {
                    "Enable Chart"
                };
                if ui.button(toggle_label).clicked() {
                    *side_action = Some(FilterPanelAction::ToggleSearchValue(row.id, !row.enabled));
                    ui.close();
                }

                let edit_btn = ui.add_enabled(!is_editing, Button::new("Edit Chart"));
                if edit_btn.clicked() {
                    *side_action = Some(FilterPanelAction::StartSearchValueEdit(row.id));
                    ui.close();
                }

                ui.separator();

                if ui.button("Remove Chart").clicked() {
                    *side_action = Some(FilterPanelAction::RemoveSearchValue(row.id));
                    ui.close();
                }

                if ui.button("Remove All Charts").clicked() {
                    *side_action = Some(FilterPanelAction::RemoveAllSearchValues);
                    ui.close();
                }

                if ui.button("Move to Filter").clicked() {
                    *side_action = Some(FilterPanelAction::MoveValueToFilter(row.id, None));
                    ui.close();
                }

                ui.separator();

                if ui.button("Create Preset from Session").clicked() {
                    *side_action = Some(FilterPanelAction::CapturePreset);
                    ui.close();
                }
            },
        ) {
            *side_action = Some(action);
        }

        if let Some(edit_state) = edit_state {
            self.search_value_edit_state = Some(edit_state);
        }
    }

    /// Renders one selectable sidebar row while preserving child widget interactions.
    fn render_sidebar_item<F, C>(
        &mut self,
        ui: &mut Ui,
        item: SelectedSidebarItem,
        drag: Option<SidebarDrag>,
        registry: &FilterRegistry,
        render_ui: F,
        context_ui: C,
    ) -> Option<FilterPanelAction>
    where
        F: FnOnce(&mut Ui, &mut Option<FilterPanelAction>),
        C: FnOnce(&mut Ui, &mut Option<FilterPanelAction>),
    {
        let is_selected = self.selected_item.is_some_and(|current| current == item);
        let mut side_action = None;

        const ITEM_ROW_HEIGHT: f32 = 30.0;
        let desired_size = vec2(ui.available_width(), ITEM_ROW_HEIGHT);
        let (item_rect, _) = ui.allocate_exact_size(desired_size, Sense::hover());
        // Editing either list keeps every row click-only and disables drag-and-drop.
        let sense = if drag.is_some() {
            Sense::click_and_drag()
        } else {
            Sense::click()
        };
        let item_id = ui.id().with(("filter_sidebar_item", item));
        let item_response = ui.interact(item_rect, item_id, sense);
        item_response.context_menu(|ui| context_ui(ui, &mut side_action));

        // Keep one explicit row-sized selection target while child widgets render
        // inside the same rect and retain their own interaction handling.
        ui.scope_builder(
            UiBuilder::new()
                .max_rect(item_response.rect)
                .layout(Layout::left_to_right(Align::Center)),
            |ui| {
                let visuals = ui.visuals();
                let mut frame = Frame::group(ui.style()).fill(visuals.faint_bg_color);
                if is_selected {
                    frame = frame
                        .fill(visuals.widgets.active.bg_fill)
                        .stroke(visuals.selection.stroke);
                }

                frame.show(ui, |ui| {
                    render_ui(ui, &mut side_action);
                });
            },
        );

        let item_response = item_response.on_hover_cursor(CursorIcon::PointingHand);
        if side_action.is_none() && item_response.double_clicked() {
            self.selected_item = Some(item);
            side_action = Some(FilterPanelAction::ApplyTempSearch(item));
        } else if item_response.clicked() {
            self.toggle_selected_item(item);
        }

        if let Some(drop_action) = drag_drop::handle_row(ui, &item_response, drag, registry) {
            side_action = Some(drop_action);
        }

        side_action
    }

    fn render_filter_display_row(ui: &mut Ui, row: &FilterRowView) -> Option<FilterPanelAction> {
        let (left_action, right_action) = Sides::new().shrink_left().truncate().show(
            ui,
            |ui| {
                let mut action = None;

                if Self::render_enabled_checkbox(
                    ui,
                    row.enabled,
                    "Disable this filter temporarily.",
                    "Enable this filter again.",
                ) {
                    action = Some(FilterPanelAction::ToggleFilter(row.id, !row.enabled));
                }

                Self::render_color_swatch(ui, row.color);
                ui.label(row.text);

                action
            },
            |ui| {
                let mut action = None;

                let mut regex_res = Self::render_filter_flag_button(
                    ui,
                    icons::regular::ASTERISK,
                    row.flags.regex,
                    row.regex_enable_eligibility.is_eligible(),
                    "Use Regular Expression",
                );

                match &row.regex_enable_eligibility {
                    ValidationEligibility::Eligible => (),
                    ValidationEligibility::Ineligible { reason } => {
                        regex_res = regex_res.on_disabled_hover_text(format!("Filter: {reason}"));
                    }
                }

                if regex_res.clicked() {
                    action = Some(FilterPanelAction::EditFilterFlags(
                        row.id,
                        FilterFlags {
                            regex: !row.flags.regex,
                            ..row.flags
                        },
                    ));
                }

                let whole_word_res = Self::render_filter_flag_button(
                    ui,
                    icons::regular::TEXT_T,
                    row.flags.word,
                    true,
                    "Match Whole Word",
                );
                if whole_word_res.clicked() {
                    action = Some(FilterPanelAction::EditFilterFlags(
                        row.id,
                        FilterFlags {
                            word: !row.flags.word,
                            ..row.flags
                        },
                    ));
                }

                let match_case_res = Self::render_filter_flag_button(
                    ui,
                    icons::regular::TEXT_AA,
                    !row.flags.ignore_case,
                    true,
                    "Match Case",
                );
                if match_case_res.clicked() {
                    action = Some(FilterPanelAction::EditFilterFlags(
                        row.id,
                        FilterFlags {
                            ignore_case: !row.flags.ignore_case,
                            ..row.flags
                        },
                    ));
                }

                action
            },
        );

        left_action.or(right_action)
    }

    fn render_search_value_display_row(
        ui: &mut Ui,
        row: &SearchValueRowView,
    ) -> Option<FilterPanelAction> {
        let (left_action, right_action) = Sides::new().shrink_left().truncate().show(
            ui,
            |ui| {
                let mut action = None;

                if Self::render_enabled_checkbox(
                    ui,
                    row.enabled,
                    "Disable this Chart temporarily.",
                    "Enable this Chart again.",
                ) {
                    action = Some(FilterPanelAction::ToggleSearchValue(row.id, !row.enabled));
                }

                Self::render_color_swatch(ui, row.color);
                ui.label(row.text);

                action
            },
            |ui| {
                let mut action = None;

                let move_btn = ui
                    .add(buttons::side_panel_row_icon(
                        RichText::new(icons::regular::FUNNEL).size(14.0),
                    ))
                    .on_hover_text("Move to Filter");
                if move_btn.clicked() {
                    action = Some(FilterPanelAction::MoveValueToFilter(row.id, None));
                }

                let remove_btn = ui
                    .add(buttons::side_panel_row_icon(
                        RichText::new(icons::regular::TRASH).size(14.0),
                    ))
                    .on_hover_text("Remove chart from session");
                if remove_btn.clicked() {
                    action = Some(FilterPanelAction::RemoveSearchValue(row.id));
                }

                action
            },
        );

        left_action.or(right_action)
    }

    /// Renders the enabled/disabled checkbox and returns whether the user
    /// toggled it in this frame.
    ///
    /// The returned flag is a change signal only; callers already know the
    /// current state and derive the next state themselves.
    fn render_enabled_checkbox(
        ui: &mut Ui,
        enabled: bool,
        disabled_tooltip: &str,
        enabled_tooltip: &str,
    ) -> bool {
        let mut enabled_state = enabled;
        let checkbox = ui.checkbox(&mut enabled_state, "").on_hover_ui(|ui| {
            ui.set_max_width(ui.spacing().tooltip_width);

            let tooltip = if enabled {
                disabled_tooltip
            } else {
                enabled_tooltip
            };
            ui.label(tooltip);
        });
        checkbox.changed()
    }

    fn render_filter_flag_button(
        ui: &mut Ui,
        icon: &str,
        active: bool,
        interactable: bool,
        tooltip: &str,
    ) -> Response {
        ui.scope(|ui| {
            if !active {
                // Keep inactive buttons muted at rest while preserving egui's hovered color.
                let weak_text_color = ui.visuals().weak_text_color();
                let visuals = &mut ui.visuals_mut().widgets;
                visuals.inactive.fg_stroke.color = weak_text_color;
            }

            ui.add_enabled(
                interactable,
                Button::new(RichText::new(icon).size(14.0))
                    .frame(false)
                    .frame_when_inactive(false),
            )
            .on_hover_text(tooltip)
        })
        .inner
    }

    fn render_text_edit_row<V, A, C>(
        ui: &mut Ui,
        id: Uuid,
        edit_state: &mut TextEditState,
        validate: V,
        on_apply: A,
        on_cancel: C,
    ) -> Option<FilterPanelAction>
    where
        V: Fn(&str) -> Option<String>,
        A: Fn(Uuid, String) -> FilterPanelAction,
        C: Fn(Uuid) -> FilterPanelAction,
    {
        let mut action = None;
        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
            let mut apply_btn = ui.add_enabled(
                edit_state.is_valid(),
                Button::new(RichText::new(icons::regular::CHECK).size(12.0))
                    .frame(false)
                    .frame_when_inactive(false),
            );
            if let Some(reason) = edit_state.err_msg.as_deref() {
                apply_btn = apply_btn.on_disabled_hover_text(reason);
            }

            if apply_btn.clicked() && edit_state.is_valid() {
                action = Some(on_apply(id, edit_state.draft.clone()));
            }

            let cancel_btn = ui
                .add(
                    Button::new(RichText::new(icons::regular::X).size(12.0))
                        .frame(false)
                        .frame_when_inactive(false),
                )
                .on_hover_text("Cancel edit");

            if cancel_btn.clicked() {
                action = Some(on_cancel(id));
            }

            ui.with_layout(Layout::left_to_right(Align::Center), |ui| {
                let (enter_pressed, escape_pressed) = ui.input_mut(|i| {
                    (
                        // We need to consume the enter key because TextEdit will move
                        // focus on enter press and we still don't have way to disable
                        // this behavior.
                        i.consume_key(Modifiers::NONE, Key::Enter),
                        i.key_pressed(Key::Escape),
                    )
                });

                let mut text_res = TextEdit::singleline(&mut edit_state.draft)
                    .desired_width(f32::INFINITY)
                    .hint_text("Pattern")
                    .show(ui);

                if edit_state.first_render_frame {
                    // Removing last char position will move the cursor to end.
                    text_res.state.cursor.set_char_range(None);
                    text_res.state.store(ui.ctx(), text_res.response.id);
                    text_res.response.request_focus();
                    edit_state.first_render_frame = false;
                }
                if text_res.response.changed() {
                    edit_state.err_msg = validate(&edit_state.draft);
                }

                let lost_focus = text_res.response.lost_focus();
                if enter_pressed && edit_state.is_valid() {
                    action = Some(on_apply(id, edit_state.draft.clone()));
                } else if escape_pressed {
                    action = Some(on_cancel(id));
                } else if lost_focus && action.is_none() {
                    text_res.response.request_focus();
                }
            });
        });

        action
    }

    fn render_group_heading(ui: &mut Ui, title: &str, count: usize) {
        ui.horizontal_wrapped(|ui| {
            ui.label(RichText::new(title).heading().size(16.0));
            ui.label(RichText::new(format!("({count})")).weak().size(16.0));
        });
    }

    fn render_color_swatch(ui: &mut Ui, color: Color32) {
        const ITEM_SWATCH_SIZE: Vec2 = vec2(10.0, 20.0);

        let (response, painter) = ui.allocate_painter(ITEM_SWATCH_SIZE, Sense::hover());
        painter.rect_filled(response.rect, 2.0, color);
    }
}

#[cfg(test)]
mod tests {
    use processor::search::filter::SearchFilter;

    use super::{FilterFlags, validate_filter_text, validate_search_value_text};

    #[test]
    fn empty_text_invalid() {
        let reason = validate_filter_text(
            FilterFlags {
                regex: false,
                ignore_case: true,
                word: false,
            },
            "",
        );

        assert!(reason.is_some());
    }
    #[test]
    fn valid_text_clears_error() {
        assert_eq!(
            validate_filter_text(
                FilterFlags {
                    regex: false,
                    ignore_case: true,
                    word: false,
                },
                "cpu",
            ),
            None
        );
    }
    #[test]
    fn invalid_regex_shows_reason() {
        let reason = validate_filter_text(
            FilterFlags {
                regex: true,
                ignore_case: true,
                word: false,
            },
            "(",
        );

        assert!(reason.is_some());
    }
    #[test]
    fn invalid_regex_ignored_without_flag() {
        assert_eq!(
            validate_filter_text(
                FilterFlags {
                    regex: false,
                    ignore_case: true,
                    word: false,
                },
                "(",
            ),
            None
        );
    }
    #[test]
    fn invalid_search_value_text_shows_reason() {
        let filter = SearchFilter::plain("cpu=(\\d+)")
            .regex(true)
            .ignore_case(true);
        let reason = validate_search_value_text(&filter, "cpu=\\d+");

        assert!(reason.is_some());
    }
}
