use egui::{
    Align, Button, Frame, Key, Layout, Modifiers, RichText, ScrollArea, Sense, Sides, TextEdit, Ui,
    UiBuilder, vec2,
};
use processor::search::filter::SearchFilter;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::{
    common::phosphor::icons,
    common::validation::ValidationEligibility,
    common::validation::validate_filter,
    common::validation::validate_search_value_filter,
    host::{
        common::colors::ColorPair,
        common::ui_utls::show_side_panel_group,
        ui::{
            UiActions,
            registry::filters::{FilterRegistry, RegistryEditOutcome},
        },
    },
    session::{
        command::SessionCommand,
        ui::shared::{SearchSyncTarget, SessionShared},
    },
};

/// Pending action selected from the Filters side panel.
///
/// # Note:
///
/// We are using actions here because we can't apply changes on the state while
/// we are iterating through them.
#[derive(Debug, Clone)]
enum FilterPanelAction {
    StartFilterEdit(Uuid),
    ApplyFilterText(Uuid, String),
    CancelFilterEdit(Uuid),
    StartSearchValueEdit(Uuid),
    ApplySearchValueText(Uuid, String),
    CancelSearchValueEdit(Uuid),
    ToggleFilter(Uuid, bool),
    EditFilterFlags(Uuid, FilterFlags),
    RemoveFilter(Uuid),
    MoveFilterToValue(Uuid),
    ToggleSearchValue(Uuid, bool),
    RemoveSearchValue(Uuid),
    MoveValueToFilter(Uuid),
}

#[derive(Debug, Clone, Copy)]
struct FilterFlags {
    regex: bool,
    ignore_case: bool,
    word: bool,
}

#[derive(Debug, Clone)]
struct TextEditState {
    id: Uuid,
    draft: String,
    err_msg: Option<String>,
    first_render_frame: bool,
}

impl TextEditState {
    fn new(id: Uuid, draft: String) -> Self {
        Self {
            id,
            draft,
            err_msg: None,
            first_render_frame: true,
        }
    }

    fn is_valid(&self) -> bool {
        self.err_msg.is_none()
    }
}

fn validate_filter_text(flags: FilterFlags, draft: &str) -> Option<String> {
    let next_filter = SearchFilter::plain(draft)
        .regex(flags.regex)
        .ignore_case(flags.ignore_case)
        .word(flags.word);

    match validate_filter(&next_filter) {
        ValidationEligibility::Eligible => None,
        ValidationEligibility::Ineligible { reason } => Some(reason),
    }
}

/// Validates a search-value text draft while preserving the current
/// definition flags so text edits do not silently change search semantics.
fn validate_search_value_text(current_filter: &SearchFilter, draft: &str) -> Option<String> {
    let mut next_filter = current_filter.clone();
    next_filter.value = draft.to_owned();
    match validate_search_value_filter(&next_filter) {
        ValidationEligibility::Eligible => None,
        ValidationEligibility::Ineligible { reason } => Some(reason),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SelectedSidebarItem {
    Filter(Uuid),
    SearchValue(Uuid),
}

#[derive(Debug)]
pub struct FiltersUi {
    cmd_tx: mpsc::Sender<SessionCommand>,
    selected_item: Option<SelectedSidebarItem>,
    filter_edit_state: Option<TextEditState>,
    search_value_edit_state: Option<TextEditState>,
}

#[derive(Debug, Clone)]
struct FilterRowView<'a> {
    id: Uuid,
    enabled: bool,
    color: egui::Color32,
    text: &'a str,
    flags: FilterFlags,
    search_value_eligibility: &'a ValidationEligibility,
    regex_enable_eligibility: &'a ValidationEligibility,
}

#[derive(Debug, Clone)]
struct SearchValueRowView<'a> {
    id: Uuid,
    enabled: bool,
    color: egui::Color32,
    text: &'a str,
    filter: SearchFilter,
}

impl FiltersUi {
    pub fn new(cmd_tx: mpsc::Sender<SessionCommand>) -> Self {
        Self {
            cmd_tx,
            selected_item: None,
            filter_edit_state: None,
            search_value_edit_state: None,
        }
    }

    /// Renders the sidebar lists, applies one deferred action, and then shows the editor.
    pub fn render_content(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut FilterRegistry,
        ui: &mut Ui,
    ) {
        ScrollArea::vertical().show(ui, |ui| {
            // Render both lists first, then apply the deferred row action once,
            // and finally refresh the selected editor against the latest state.
            let mut side_action = None;
            self.render_filters_group(shared, registry, ui, &mut side_action);
            self.render_search_values_group(shared, registry, ui, &mut side_action);

            self.handle_action(side_action, shared, actions, registry);
            self.render_selected_group(shared, registry, ui);
        });
    }

    fn render_filters_group(
        &mut self,
        shared: &SessionShared,
        registry: &FilterRegistry,
        ui: &mut Ui,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        show_side_panel_group(ui, |ui| {
            let filters_count = shared.filters.filter_entries.len();
            Self::render_group_heading(ui, "Filters", filters_count);
            ui.add_space(5.0);
            self.render_filters_section(shared, registry, ui, side_action);
        });
    }

    fn render_search_values_group(
        &mut self,
        shared: &SessionShared,
        registry: &FilterRegistry,
        ui: &mut Ui,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        show_side_panel_group(ui, |ui| {
            let charts_count = shared.filters.search_value_entries.len();
            Self::render_group_heading(ui, "Charts", charts_count);
            ui.add_space(5.0);
            self.render_search_values_section(shared, registry, ui, side_action);
        });
    }

    fn render_filters_section(
        &mut self,
        shared: &SessionShared,
        registry: &FilterRegistry,
        ui: &mut Ui,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        let mut have_items = false;
        shared
            .filters
            .filter_entries
            .iter()
            .filter_map(|item| {
                registry.get_filter(&item.id).map(|def| FilterRowView {
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
                })
            })
            .for_each(|row| {
                have_items = true;
                self.render_filter_item(ui, &row, side_action);
            });

        if !have_items {
            ui.label(RichText::new("No filters applied").weak());
        }
    }

    fn render_search_values_section(
        &mut self,
        shared: &SessionShared,
        registry: &FilterRegistry,
        ui: &mut Ui,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        let mut has_items = false;
        shared
            .filters
            .search_value_entries
            .iter()
            .filter_map(|item| {
                registry
                    .get_search_value(&item.id)
                    .map(|def| SearchValueRowView {
                        id: item.id,
                        enabled: item.enabled,
                        color: item.color,
                        text: def.filter.value.as_str(),
                        filter: def.filter.clone(),
                    })
            })
            .for_each(|row| {
                has_items = true;
                self.render_search_value_item(ui, &row, side_action);
            });

        if !has_items {
            ui.label(RichText::new("No Charts applied").weak());
        }
    }

    fn render_filter_item(
        &mut self,
        ui: &mut Ui,
        row: &FilterRowView,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        let mut edit_state = self.take_filter_edit_state(row.id);
        let is_editing = edit_state.is_some();
        if let Some(action) = self.render_sidebar_item(
            ui,
            SelectedSidebarItem::Filter(row.id),
            |ui, side_action| {
                let action = if let Some(edit_state) = edit_state.as_mut() {
                    Self::render_text_edit_row(
                        ui,
                        row.id,
                        edit_state,
                        |draft| validate_filter_text(row.flags, draft),
                        FilterPanelAction::ApplyFilterText,
                        FilterPanelAction::CancelFilterEdit,
                    )
                } else {
                    Self::render_filter_display_row(ui, row)
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

                let edit_btn = ui.add_enabled(!is_editing, egui::Button::new("Edit Filter"));
                if edit_btn.clicked() {
                    *side_action = Some(FilterPanelAction::StartFilterEdit(row.id));
                    ui.close();
                }

                ui.separator();

                if ui.button("Remove Filter").clicked() {
                    *side_action = Some(FilterPanelAction::RemoveFilter(row.id));
                    ui.close();
                }

                let mut move_btn = ui
                    .add_enabled(
                        row.search_value_eligibility.is_eligible(),
                        egui::Button::new("Move to Charts"),
                    )
                    .on_hover_text("Move to Charts");

                match &row.search_value_eligibility {
                    ValidationEligibility::Eligible => {}
                    ValidationEligibility::Ineligible { reason } => {
                        move_btn = move_btn.on_disabled_hover_text(format!("Chart: {reason}"));
                    }
                };

                if move_btn.clicked() {
                    *side_action = Some(FilterPanelAction::MoveFilterToValue(row.id));
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
        side_action: &mut Option<FilterPanelAction>,
    ) {
        let mut edit_state = self.take_search_value_edit_state(row.id);
        let is_editing = edit_state.is_some();
        if let Some(action) = self.render_sidebar_item(
            ui,
            SelectedSidebarItem::SearchValue(row.id),
            |ui, side_action| {
                let action = if let Some(edit_state) = edit_state.as_mut() {
                    Self::render_text_edit_row(
                        ui,
                        row.id,
                        edit_state,
                        |draft| validate_search_value_text(&row.filter, draft),
                        FilterPanelAction::ApplySearchValueText,
                        FilterPanelAction::CancelSearchValueEdit,
                    )
                } else {
                    Self::render_search_value_display_row(ui, row)
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

                let edit_btn = ui.add_enabled(!is_editing, egui::Button::new("Edit Chart"));
                if edit_btn.clicked() {
                    *side_action = Some(FilterPanelAction::StartSearchValueEdit(row.id));
                    ui.close();
                }

                ui.separator();

                if ui.button("Remove Chart").clicked() {
                    *side_action = Some(FilterPanelAction::RemoveSearchValue(row.id));
                    ui.close();
                }

                if ui.button("Move to Filter").clicked() {
                    *side_action = Some(FilterPanelAction::MoveValueToFilter(row.id));
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
        let (_, item_response) = ui.allocate_exact_size(desired_size, Sense::click());
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

        if item_response
            .on_hover_cursor(egui::CursorIcon::PointingHand)
            .clicked()
        {
            self.toggle_selected_item(item);
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
                    .button(RichText::new(icons::regular::FUNNEL).size(14.0))
                    .on_hover_text("Move to Filter");
                if move_btn.clicked() {
                    action = Some(FilterPanelAction::MoveValueToFilter(row.id));
                }

                let remove_btn = ui
                    .button(RichText::new(icons::regular::TRASH).size(14.0))
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
    ) -> egui::Response {
        ui.scope(|ui| {
            if !active {
                // Keep inactive buttons muted at rest while preserving egui's hovered color.
                let weak_text_color = ui.visuals().weak_text_color();
                let visuals = &mut ui.visuals_mut().widgets;
                visuals.inactive.fg_stroke.color = weak_text_color;
            }

            ui.add_enabled(
                interactable,
                egui::Button::new(RichText::new(icon).size(14.0))
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

    fn render_color_picker_row(ui: &mut Ui, label: &str, color: &mut egui::Color32) {
        ui.horizontal(|ui| {
            ui.label(label);
            ui.color_edit_button_srgba(color);
        });
    }

    fn render_color_swatch(ui: &mut Ui, color: egui::Color32) {
        const ITEM_SWATCH_SIZE: egui::Vec2 = vec2(10.0, 20.0);

        let (response, painter) = ui.allocate_painter(ITEM_SWATCH_SIZE, Sense::hover());
        painter.rect_filled(response.rect, 2.0, color);
    }

    /// Renders the editor for the currently selected filter or chart item.
    fn render_selected_group(
        &mut self,
        shared: &mut SessionShared,
        registry: &FilterRegistry,
        ui: &mut Ui,
    ) {
        let Some(selected_item) = self.selected_item else {
            return;
        };

        // Color edits are session-local presentation changes, so they do not need
        // a search-pipeline resync. This also clears stale sidebar-local selection
        // when the semantic definition disappears from the registry.
        match selected_item {
            SelectedSidebarItem::Filter(filter_id) => {
                if shared.filters.is_filter_applied(&filter_id)
                    && registry.get_filter(&filter_id).is_some()
                    && let Some(filter_entry) = shared
                        .filters
                        .filter_entries
                        .iter_mut()
                        .find(|item| item.id == filter_id)
                {
                    show_side_panel_group(ui, |ui| {
                        Self::render_filter_editor(ui, &mut filter_entry.colors);
                    });
                } else {
                    self.selected_item = None;
                }
            }
            SelectedSidebarItem::SearchValue(value_id) => {
                if shared.filters.is_search_value_applied(&value_id)
                    && registry.get_search_value(&value_id).is_some()
                    && let Some(value_entry) = shared
                        .filters
                        .search_value_entries
                        .iter_mut()
                        .find(|item| item.id == value_id)
                {
                    show_side_panel_group(ui, |ui| {
                        Self::render_search_value_editor(ui, &mut value_entry.color);
                    });
                } else {
                    self.selected_item = None;
                }
            }
        }
    }

    fn render_filter_editor(ui: &mut Ui, colors: &mut ColorPair) {
        ui.heading(RichText::new("Filter Details").size(16.0));
        ui.add_space(10.0);

        Self::render_color_picker_row(ui, "Foreground", &mut colors.fg);
        Self::render_color_picker_row(ui, "Background", &mut colors.bg);
    }

    fn render_search_value_editor(ui: &mut Ui, color: &mut egui::Color32) {
        ui.heading(RichText::new("Chart Details").size(16.0));
        ui.add_space(10.0);

        Self::render_color_picker_row(ui, "Color", color);
    }

    /// Applies the queued sidebar mutation and dispatches any required pipeline sync commands.
    fn handle_action(
        &mut self,
        side_action: Option<FilterPanelAction>,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut FilterRegistry,
    ) {
        let Some(side_action) = side_action else {
            return;
        };
        // Apply the queued row mutation after rendering so we don't mutate the
        // session/registry state while iterating it to build the current UI frame.
        match side_action {
            FilterPanelAction::StartFilterEdit(filter_id) => {
                let Some(filter_def) = registry.get_filter(&filter_id) else {
                    return;
                };

                self.selected_item = Some(SelectedSidebarItem::Filter(filter_id));
                self.search_value_edit_state = None;
                let mut edit_state = TextEditState::new(filter_id, filter_def.filter.value.clone());
                edit_state.err_msg = match validate_filter(&filter_def.filter) {
                    ValidationEligibility::Eligible => None,
                    ValidationEligibility::Ineligible { reason } => Some(reason),
                };
                self.filter_edit_state = Some(edit_state);
            }
            FilterPanelAction::ApplyFilterText(filter_id, draft) => {
                let Some(current_filter) = registry.get_filter(&filter_id) else {
                    self.clear_filter_edit_for(filter_id);
                    return;
                };

                let mut next_filter = current_filter.filter.clone();
                next_filter.value = draft;

                match registry.edit_filter_for_session(filter_id, shared.get_id(), next_filter) {
                    RegistryEditOutcome::NotFound => {
                        self.clear_filter_edit_for(filter_id);
                    }
                    RegistryEditOutcome::EditedInPlace => {
                        self.clear_filter_edit_for(filter_id);
                        shared.bump_recent_revision();
                        shared
                            .sync_search_pipelines(registry, SearchSyncTarget::Filter)
                            .into_iter()
                            .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
                    }
                    RegistryEditOutcome::Reassigned(next_filter_id) => {
                        if shared.rebind_filter(&filter_id, next_filter_id) {
                            self.replace_selection(
                                SelectedSidebarItem::Filter(filter_id),
                                SelectedSidebarItem::Filter(next_filter_id),
                            );
                        }
                        self.clear_filter_edit_for(filter_id);
                        shared
                            .sync_search_pipelines(registry, SearchSyncTarget::Filter)
                            .into_iter()
                            .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
                    }
                }
            }
            FilterPanelAction::CancelFilterEdit(filter_id) => {
                self.clear_filter_edit_for(filter_id);
            }
            FilterPanelAction::StartSearchValueEdit(value_id) => {
                let Some(value_def) = registry.get_search_value(&value_id) else {
                    return;
                };

                self.selected_item = Some(SelectedSidebarItem::SearchValue(value_id));
                self.filter_edit_state = None;
                let mut edit_state = TextEditState::new(value_id, value_def.filter.value.clone());
                edit_state.err_msg =
                    validate_search_value_text(&value_def.filter, &edit_state.draft);
                self.search_value_edit_state = Some(edit_state);
            }
            FilterPanelAction::ApplySearchValueText(value_id, draft) => {
                let Some(current_value) = registry.get_search_value(&value_id) else {
                    self.clear_search_value_edit_for(value_id);
                    return;
                };

                let mut next_filter = current_value.filter.clone();
                next_filter.value = draft;

                match registry.edit_search_value_for_session(value_id, shared.get_id(), next_filter)
                {
                    RegistryEditOutcome::NotFound => {
                        self.clear_search_value_edit_for(value_id);
                    }
                    RegistryEditOutcome::EditedInPlace => {
                        self.clear_search_value_edit_for(value_id);
                        shared.bump_recent_revision();
                        shared
                            .sync_search_pipelines(registry, SearchSyncTarget::SearchValue)
                            .into_iter()
                            .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
                    }
                    RegistryEditOutcome::Reassigned(next_value_id) => {
                        if shared.rebind_search_value(&value_id, next_value_id) {
                            self.replace_selection(
                                SelectedSidebarItem::SearchValue(value_id),
                                SelectedSidebarItem::SearchValue(next_value_id),
                            );
                        }
                        self.clear_search_value_edit_for(value_id);
                        shared
                            .sync_search_pipelines(registry, SearchSyncTarget::SearchValue)
                            .into_iter()
                            .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
                    }
                }
            }
            FilterPanelAction::CancelSearchValueEdit(value_id) => {
                self.clear_search_value_edit_for(value_id);
            }
            FilterPanelAction::ToggleFilter(filter_id, enabled) => {
                if shared.set_filter_enabled(&filter_id, enabled) {
                    shared
                        .sync_search_pipelines(registry, SearchSyncTarget::Filter)
                        .into_iter()
                        .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
                }
            }
            FilterPanelAction::EditFilterFlags(filter_id, flags) => {
                let Some(current_filter) = registry.get_filter(&filter_id) else {
                    return;
                };

                let next_filter = current_filter
                    .filter
                    .clone()
                    .regex(flags.regex)
                    .ignore_case(flags.ignore_case)
                    .word(flags.word);

                match validate_filter(&next_filter) {
                    ValidationEligibility::Eligible => (),
                    ValidationEligibility::Ineligible { reason } => {
                        log::warn!(
                            "EditFilterFlags produced invalid filter {filter_id} in session {}: {reason}",
                            shared.get_id()
                        );
                        return;
                    }
                }

                match registry.edit_filter_for_session(filter_id, shared.get_id(), next_filter) {
                    RegistryEditOutcome::NotFound => {}
                    RegistryEditOutcome::EditedInPlace => {
                        shared.bump_recent_revision();
                        shared
                            .sync_search_pipelines(registry, SearchSyncTarget::Filter)
                            .into_iter()
                            .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
                    }
                    RegistryEditOutcome::Reassigned(next_filter_id) => {
                        if shared.rebind_filter(&filter_id, next_filter_id) {
                            self.replace_selection(
                                SelectedSidebarItem::Filter(filter_id),
                                SelectedSidebarItem::Filter(next_filter_id),
                            );
                        }

                        shared
                            .sync_search_pipelines(registry, SearchSyncTarget::Filter)
                            .into_iter()
                            .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
                    }
                }
            }
            FilterPanelAction::RemoveFilter(filter_id) => {
                self.clear_filter_edit_for(filter_id);
                self.clear_selection_for(SelectedSidebarItem::Filter(filter_id));
                shared.unapply_filter(registry, &filter_id);
                shared
                    .sync_search_pipelines(registry, SearchSyncTarget::Filter)
                    .into_iter()
                    .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
            }
            FilterPanelAction::MoveFilterToValue(filter_id) => {
                self.clear_filter_edit_for(filter_id);
                let was_applied = shared.filters.is_filter_applied(&filter_id);
                let was_enabled = shared.filters.is_filter_enabled(&filter_id);
                let session_id = shared.get_id();
                let converted_value = registry.convert_filter_to_value(filter_id, session_id);
                if let Some(value_id) = converted_value
                    && was_applied
                {
                    shared.unapply_filter(registry, &filter_id);
                    shared.apply_search_value_with_state(registry, value_id, was_enabled);
                    self.replace_selection(
                        SelectedSidebarItem::Filter(filter_id),
                        SelectedSidebarItem::SearchValue(value_id),
                    );
                    shared
                        .sync_search_pipelines(registry, SearchSyncTarget::Both)
                        .into_iter()
                        .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
                }
            }
            FilterPanelAction::ToggleSearchValue(value_id, enabled) => {
                if shared.set_search_value_enabled(&value_id, enabled) {
                    shared
                        .sync_search_pipelines(registry, SearchSyncTarget::SearchValue)
                        .into_iter()
                        .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
                }
            }
            FilterPanelAction::RemoveSearchValue(value_id) => {
                self.clear_search_value_edit_for(value_id);
                self.clear_selection_for(SelectedSidebarItem::SearchValue(value_id));
                shared.unapply_search_value(registry, &value_id);
                shared
                    .sync_search_pipelines(registry, SearchSyncTarget::SearchValue)
                    .into_iter()
                    .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
            }
            FilterPanelAction::MoveValueToFilter(value_id) => {
                self.clear_search_value_edit_for(value_id);
                let was_applied = shared.filters.is_search_value_applied(&value_id);
                let was_enabled = shared.filters.is_search_value_enabled(&value_id);
                let session_id = shared.get_id();
                let converted_filter = registry.convert_value_to_filter(value_id, session_id);
                if let Some(filter_id) = converted_filter
                    && was_applied
                {
                    shared.unapply_search_value(registry, &value_id);
                    shared.apply_filter_with_state(registry, filter_id, was_enabled);
                    self.replace_selection(
                        SelectedSidebarItem::SearchValue(value_id),
                        SelectedSidebarItem::Filter(filter_id),
                    );
                    shared
                        .sync_search_pipelines(registry, SearchSyncTarget::Both)
                        .into_iter()
                        .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
                }
            }
        }
    }

    fn toggle_selected_item(&mut self, item: SelectedSidebarItem) {
        self.selected_item = match self.selected_item {
            Some(current) if current == item => None,
            _ => Some(item),
        };
    }

    fn clear_selection_for(&mut self, item: SelectedSidebarItem) {
        if self.selected_item.is_some_and(|i| i == item) {
            self.selected_item = None;
        }
    }

    fn replace_selection(&mut self, from: SelectedSidebarItem, to: SelectedSidebarItem) {
        if self.selected_item.is_some_and(|i| i == from) {
            self.selected_item = Some(to);
        }
    }

    /// Moves the active filter edit state out of `self` only for the matching row.
    fn take_filter_edit_state(&mut self, filter_id: Uuid) -> Option<TextEditState> {
        if self
            .filter_edit_state
            .as_ref()
            .is_some_and(|state| state.id == filter_id)
        {
            return self.filter_edit_state.take();
        }

        None
    }

    /// Clears the active filter edit state when it still belongs to `filter_id`.
    fn clear_filter_edit_for(&mut self, filter_id: Uuid) {
        if self
            .filter_edit_state
            .as_ref()
            .is_some_and(|state| state.id == filter_id)
        {
            self.filter_edit_state = None;
        }
    }

    /// Moves the active chart edit state out of `self` only for the matching row.
    fn take_search_value_edit_state(&mut self, value_id: Uuid) -> Option<TextEditState> {
        if self
            .search_value_edit_state
            .as_ref()
            .is_some_and(|state| state.id == value_id)
        {
            return self.search_value_edit_state.take();
        }

        None
    }

    /// Clears the active chart edit state when it still belongs to `value_id`.
    fn clear_search_value_edit_for(&mut self, value_id: Uuid) {
        if self
            .search_value_edit_state
            .as_ref()
            .is_some_and(|state| state.id == value_id)
        {
            self.search_value_edit_state = None;
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::session::command::SessionCommand;
    use processor::search::filter::SearchFilter;
    use tokio::sync::mpsc;
    use uuid::Uuid;

    use super::{
        FilterFlags, FiltersUi, SelectedSidebarItem, TextEditState, validate_filter_text,
        validate_search_value_text,
    };

    fn new_ui() -> FiltersUi {
        let (cmd_tx, _cmd_rx) = mpsc::channel::<SessionCommand>(4);
        FiltersUi::new(cmd_tx)
    }

    #[test]
    fn selecting_same_toggles() {
        let mut ui = new_ui();
        let filter_id = Uuid::new_v4();

        ui.toggle_selected_item(SelectedSidebarItem::Filter(filter_id));
        ui.toggle_selected_item(SelectedSidebarItem::Filter(filter_id));

        assert_eq!(ui.selected_item, None);
    }

    #[test]
    fn selecting_other_replaces() {
        let mut ui = new_ui();
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();

        ui.toggle_selected_item(SelectedSidebarItem::Filter(first));
        ui.toggle_selected_item(SelectedSidebarItem::SearchValue(second));

        assert_eq!(
            ui.selected_item,
            Some(SelectedSidebarItem::SearchValue(second))
        );
    }

    #[test]
    fn removing_selected_clears() {
        let mut ui = new_ui();
        let filter_id = Uuid::new_v4();
        ui.selected_item = Some(SelectedSidebarItem::Filter(filter_id));

        ui.clear_selection_for(SelectedSidebarItem::Filter(filter_id));

        assert_eq!(ui.selected_item, None);
    }

    #[test]
    fn moving_filter_follows() {
        let mut ui = new_ui();
        let filter_id = Uuid::new_v4();
        let value_id = Uuid::new_v4();
        ui.selected_item = Some(SelectedSidebarItem::Filter(filter_id));

        ui.replace_selection(
            SelectedSidebarItem::Filter(filter_id),
            SelectedSidebarItem::SearchValue(value_id),
        );

        assert_eq!(
            ui.selected_item,
            Some(SelectedSidebarItem::SearchValue(value_id))
        );
    }

    #[test]
    fn rebinding_filter_follows() {
        let mut ui = new_ui();
        let old_filter_id = Uuid::new_v4();
        let new_filter_id = Uuid::new_v4();
        ui.selected_item = Some(SelectedSidebarItem::Filter(old_filter_id));

        ui.replace_selection(
            SelectedSidebarItem::Filter(old_filter_id),
            SelectedSidebarItem::Filter(new_filter_id),
        );

        assert_eq!(
            ui.selected_item,
            Some(SelectedSidebarItem::Filter(new_filter_id))
        );
    }

    #[test]
    fn moving_value_follows() {
        let mut ui = new_ui();
        let filter_id = Uuid::new_v4();
        let value_id = Uuid::new_v4();
        ui.selected_item = Some(SelectedSidebarItem::SearchValue(value_id));

        ui.replace_selection(
            SelectedSidebarItem::SearchValue(value_id),
            SelectedSidebarItem::Filter(filter_id),
        );

        assert_eq!(
            ui.selected_item,
            Some(SelectedSidebarItem::Filter(filter_id))
        );
    }

    #[test]
    fn empty_text_invalid() {
        assert_eq!(
            validate_filter_text(
                FilterFlags {
                    regex: false,
                    ignore_case: true,
                    word: false,
                },
                "",
            ),
            Some("Filter text cannot be empty".to_owned())
        );
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

        assert!(reason.is_some_and(|reason| reason.starts_with("Invalid regex:")));
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
    fn clearing_edit_state() {
        let mut ui = new_ui();
        let filter_id = Uuid::new_v4();
        ui.filter_edit_state = Some(TextEditState::new(filter_id, "cpu".into()));

        ui.clear_filter_edit_for(filter_id);

        assert!(ui.filter_edit_state.is_none());
    }

    #[test]
    fn new_edit_state_starts_first_frame() {
        let edit_state = TextEditState::new(Uuid::new_v4(), "cpu".into());

        assert!(edit_state.first_render_frame);
        assert_eq!(edit_state.err_msg, None);
    }

    #[test]
    fn clearing_other_edit_keeps_state() {
        let mut ui = new_ui();
        let filter_id = Uuid::new_v4();
        ui.filter_edit_state = Some(TextEditState::new(filter_id, "cpu".into()));

        ui.clear_filter_edit_for(Uuid::new_v4());

        assert!(
            ui.filter_edit_state
                .is_some_and(|state| state.id == filter_id)
        );
    }

    #[test]
    fn new_search_value_edit_state_starts_first_frame() {
        let edit_state = TextEditState::new(Uuid::new_v4(), "cpu=(\\d+)".into());

        assert!(edit_state.first_render_frame);
        assert_eq!(edit_state.err_msg, None);
    }

    #[test]
    fn invalid_search_value_text_shows_reason() {
        let filter = SearchFilter::plain("cpu=(\\d+)")
            .regex(true)
            .ignore_case(true);
        assert_eq!(
            validate_search_value_text(&filter, "cpu=\\d+").as_deref(),
            Some("Regex must include at least one capture group.")
        );
    }

    #[test]
    fn clearing_search_value_edit_state() {
        let mut ui = new_ui();
        let value_id = Uuid::new_v4();
        ui.search_value_edit_state = Some(TextEditState::new(value_id, "cpu=(\\d+)".into()));

        ui.clear_search_value_edit_for(value_id);

        assert!(ui.search_value_edit_state.is_none());
    }

    #[test]
    fn clearing_other_search_value_edit_keeps_state() {
        let mut ui = new_ui();
        let value_id = Uuid::new_v4();
        ui.search_value_edit_state = Some(TextEditState::new(value_id, "cpu=(\\d+)".into()));

        ui.clear_search_value_edit_for(Uuid::new_v4());

        assert!(
            ui.search_value_edit_state
                .is_some_and(|state| state.id == value_id)
        );
    }
}
