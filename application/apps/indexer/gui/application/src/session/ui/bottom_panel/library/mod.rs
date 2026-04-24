use egui::{
    Align, Button, Frame, Layout, Margin, Response, RichText, ScrollArea, Sense, Sides, TextEdit,
    Ui, UiBuilder, vec2,
};
use rustc_hash::FxHashSet;
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::{
    common::{
        phosphor::icons, ui::substring_matcher::SubstringMatcher, validation::ValidationEligibility,
    },
    host::ui::{UiActions, registry::filters::FilterRegistry},
    session::{
        command::SessionCommand,
        ui::shared::{SearchSyncTarget, SessionShared},
    },
};

const HEADING_FONT_SIZE: f32 = 16.0;

/// Bottom-panel library surface with local navigation state.
///
/// Definition actions still go through normal session command dispatch so the
/// existing apply/delete and explicit sync paths remain unchanged.
#[derive(Debug)]
pub struct LibraryUI {
    cmd_tx: Sender<SessionCommand>,
    filter_state: DefinitionQueryState,
    chart_state: DefinitionQueryState,
}

/// Local query state and cached matches for one library definition column.
#[derive(Debug, Default)]
struct DefinitionQueryState {
    query: String,
    matcher: SubstringMatcher,
    matching_ids: Option<FxHashSet<Uuid>>,
    cached_revision: u64,
}

#[derive(Debug, Clone, Copy)]
struct FilterFlags {
    regex: bool,
    ignore_case: bool,
    word: bool,
}

#[derive(Debug, Clone)]
struct FilterRowView<'a> {
    id: Uuid,
    applied: bool,
    text: &'a str,
    flags: FilterFlags,
    regex_enable_eligibility: &'a ValidationEligibility,
}

#[derive(Debug, Clone)]
struct SearchValueRowView<'a> {
    id: Uuid,
    applied: bool,
    text: &'a str,
}

/// Deferred row mutation applied after rendering finishes for the current list.
///
/// The registry maps stay borrowed while rows are rendered, so we queue only
/// the chosen action and execute it once iteration is complete.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PendingDefinitionAction {
    Toggle(Uuid),
    Delete(Uuid),
}

impl LibraryUI {
    pub fn new(cmd_tx: Sender<SessionCommand>) -> Self {
        Self {
            cmd_tx,
            filter_state: DefinitionQueryState::default(),
            chart_state: DefinitionQueryState::default(),
        }
    }

    pub fn render_content(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut FilterRegistry,
        ui: &mut Ui,
    ) {
        ui.columns_const(|[filter_col, search_values_col]| {
            Self::render_section_group(filter_col, |ui| {
                self.render_filter_definitions(shared, actions, registry, ui);
            });
            Self::render_section_group(search_values_col, |ui| {
                self.render_search_value_definitions(shared, actions, registry, ui);
            });
        });
    }

    fn render_filter_definitions(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut FilterRegistry,
        ui: &mut Ui,
    ) {
        ui.vertical(|ui| {
            ui.label(RichText::new("Filters").heading().size(HEADING_FONT_SIZE));
            ui.add_space(8.0);

            if registry.filters_map().is_empty() {
                ui.label(RichText::new("No filter definitions in library").weak());
                return;
            }

            let query_changed =
                Self::render_name_filter_input(ui, "Filter by name", &mut self.filter_state.query)
                    .changed();
            self.filter_state.update_with_revision(
                registry.filter_definitions_revision(),
                query_changed,
                |matcher| collect_matching_filter_ids(matcher, registry),
            );

            ScrollArea::vertical()
                .id_salt("library_filters")
                .auto_shrink(false)
                .show(ui, |ui| {
                    // Defer mutations until after the loop so we do not mutate
                    // session/registry state while iterating the borrowed map.
                    let mut pending_action = None;
                    let mut any_visible = false;
                    let session_id = shared.get_id();
                    for (id, def) in registry.filters_map() {
                        if !self.filter_state.matches(id) {
                            continue;
                        }

                        any_visible = true;
                        let row = FilterRowView {
                            id: *id,
                            applied: shared.filters.is_filter_applied(id),
                            text: def.filter.value.as_str(),
                            flags: FilterFlags {
                                regex: def.filter.is_regex(),
                                ignore_case: def.filter.is_ignore_case(),
                                word: def.filter.is_word(),
                            },
                            regex_enable_eligibility: &def.regex_enable_eligibility,
                        };
                        let delete_enabled = registry.can_remove_filter(&row.id, &session_id);

                        if let Some(action) = self.render_library_row(
                            ui,
                            row.applied,
                            PendingDefinitionAction::Toggle(row.id),
                            |ui, _action| {
                                Self::render_filter_display_row(ui, &row);
                            },
                            |ui, action| {
                                let mut delete_btn = ui
                                    .add_enabled(delete_enabled, Button::new("Delete definition"));
                                delete_btn = delete_btn.on_disabled_hover_ui(|ui| {
                                    ui.set_max_width(ui.spacing().tooltip_width);
                                    ui.label(format!(
                                        "Cannot delete: currently used in {} other session(s).",
                                        registry.filter_usage_count(&row.id)
                                            - usize::from(
                                                registry.is_filter_applied(&row.id, &session_id,),
                                            )
                                    ));
                                });
                                if delete_btn.clicked() {
                                    *action = Some(PendingDefinitionAction::Delete(row.id));
                                }
                            },
                        ) {
                            pending_action = Some(action);
                        }
                    }

                    if !any_visible {
                        ui.label(
                            RichText::new("No filter definitions match the current filter.").weak(),
                        );
                    }

                    match pending_action {
                        Some(PendingDefinitionAction::Toggle(id)) => {
                            self.toggle_filter_definition(shared, actions, registry, id);
                        }
                        Some(PendingDefinitionAction::Delete(id)) => {
                            self.delete_filter_definition(shared, actions, registry, id);
                        }
                        None => {}
                    }
                });
        });
    }

    fn render_search_value_definitions(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut FilterRegistry,
        ui: &mut Ui,
    ) {
        ui.vertical(|ui| {
            ui.label(RichText::new("Charts").heading().size(HEADING_FONT_SIZE));
            ui.add_space(8.0);

            if registry.search_value_map().is_empty() {
                ui.label(RichText::new("No chart definitions in library").weak());
                return;
            }

            let query_changed =
                Self::render_name_filter_input(ui, "Filter by name", &mut self.chart_state.query)
                    .changed();
            self.chart_state.update_with_revision(
                registry.search_value_definitions_revision(),
                query_changed,
                |matcher| collect_matching_search_value_ids(matcher, registry),
            );

            ScrollArea::vertical()
                .id_salt("library_charts")
                .auto_shrink(false)
                .show(ui, |ui| {
                    // Charts use the same deferred-mutation pattern as filters
                    // because search-value rows are rendered from a borrowed map.
                    let mut pending_action = None;
                    let mut any_visible = false;
                    let session_id = shared.get_id();
                    for (id, def) in registry.search_value_map() {
                        if !self.chart_state.matches(id) {
                            continue;
                        }

                        any_visible = true;
                        let row = SearchValueRowView {
                            id: *id,
                            applied: shared.filters.is_search_value_applied(id),
                            text: def.filter.value.as_str(),
                        };
                        let delete_enabled = registry.can_remove_search_value(&row.id, &session_id);

                        if let Some(action) = self.render_library_row(
                            ui,
                            row.applied,
                            PendingDefinitionAction::Toggle(row.id),
                            |ui, _action| {
                                Self::render_search_value_display_row(ui, &row);
                            },
                            |ui, action| {
                                let mut delete_btn = ui
                                    .add_enabled(delete_enabled, Button::new("Delete definition"));
                                delete_btn = delete_btn.on_disabled_hover_ui(|ui| {
                                    ui.set_max_width(ui.spacing().tooltip_width);
                                    ui.label(format!(
                                        "Cannot delete: currently used in {} other session(s).",
                                        registry.search_value_usage_count(&row.id)
                                            - usize::from(
                                                registry
                                                    .is_search_value_applied(&row.id, &session_id,),
                                            )
                                    ));
                                });
                                if delete_btn.clicked() {
                                    *action = Some(PendingDefinitionAction::Delete(row.id));
                                }
                            },
                        ) {
                            pending_action = Some(action);
                        }
                    }

                    if !any_visible {
                        ui.label(
                            RichText::new("No chart definitions match the current filter.").weak(),
                        );
                    }

                    match pending_action {
                        Some(PendingDefinitionAction::Toggle(id)) => {
                            self.toggle_search_value_definition(shared, actions, registry, id);
                        }
                        Some(PendingDefinitionAction::Delete(id)) => {
                            self.delete_search_value_definition(shared, actions, registry, id);
                        }
                        None => {}
                    }
                });
        });
    }

    fn render_section_group<R>(ui: &mut Ui, add_contents: impl FnOnce(&mut Ui) -> R) -> R {
        let visuals = ui.visuals();
        Frame::group(ui.style())
            .fill(visuals.faint_bg_color)
            .stroke(visuals.widgets.noninteractive.bg_stroke)
            .inner_margin(Margin::symmetric(12, 10))
            .outer_margin(Margin::symmetric(4, 4))
            .show(ui, |ui| {
                ui.take_available_space();
                add_contents(ui)
            })
            .inner
    }

    fn toggle_filter_definition(
        &self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut FilterRegistry,
        id: Uuid,
    ) {
        let was_enabled = shared.filters.is_filter_enabled(&id);

        // Library rows represent session membership, not the enabled flag.
        if shared.filters.is_filter_applied(&id) {
            shared.unapply_filter(registry, &id);
        } else {
            shared.apply_filter(registry, id);
        }

        if was_enabled || shared.filters.is_filter_applied(&id) {
            self.dispatch_sync_commands(shared, actions, registry, SearchSyncTarget::Filter);
        }
    }

    fn delete_filter_definition(
        &self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut FilterRegistry,
        id: Uuid,
    ) -> bool {
        if !registry.can_remove_filter(&id, &shared.get_id()) {
            return false;
        }

        let was_enabled = shared.filters.is_filter_enabled(&id);
        registry.remove_filter(&id);
        shared.unapply_filter(registry, &id);

        // Removing a disabled or unapplied definition does not change the
        // active backend pipeline, so only enabled rows require a re-sync.
        if was_enabled {
            self.dispatch_sync_commands(shared, actions, registry, SearchSyncTarget::Filter);
        }

        true
    }

    fn toggle_search_value_definition(
        &self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut FilterRegistry,
        id: Uuid,
    ) {
        let was_enabled = shared.filters.is_search_value_enabled(&id);

        // Library rows represent session membership, not the enabled flag.
        if shared.filters.is_search_value_applied(&id) {
            shared.unapply_search_value(registry, &id);
        } else {
            shared.apply_search_value(registry, id);
        }

        if was_enabled || shared.filters.is_search_value_applied(&id) {
            self.dispatch_sync_commands(shared, actions, registry, SearchSyncTarget::SearchValue);
        }
    }

    fn delete_search_value_definition(
        &self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut FilterRegistry,
        id: Uuid,
    ) -> bool {
        if !registry.can_remove_search_value(&id, &shared.get_id()) {
            return false;
        }

        let was_enabled = shared.filters.is_search_value_enabled(&id);
        registry.remove_search_value(&id);
        shared.unapply_search_value(registry, &id);

        // Chart/search-value sync is needed only when the removed definition
        // was contributing to the active extraction pipeline.
        if was_enabled {
            self.dispatch_sync_commands(shared, actions, registry, SearchSyncTarget::SearchValue);
        }

        true
    }

    /// Preserves the existing explicit sync model by dispatching the same
    /// session commands the old library surface used after a library action.
    fn dispatch_sync_commands(
        &self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &FilterRegistry,
        target: SearchSyncTarget,
    ) {
        shared
            .sync_search_pipelines(registry, target)
            .into_iter()
            .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
    }

    /// Renders a full-width name filter input and returns its edit response.
    fn render_name_filter_input(ui: &mut Ui, hint_text: &str, query: &mut String) -> Response {
        let response = ui.add(
            TextEdit::singleline(query)
                .hint_text(hint_text)
                .desired_width(f32::INFINITY),
        );
        ui.add_space(5.0);
        response
    }

    /// Renders one library definition row with a single full-width hit target.
    fn render_library_row<FRender, FContext>(
        &self,
        ui: &mut Ui,
        is_applied: bool,
        toggle_action: PendingDefinitionAction,
        render_ui: FRender,
        context_menu_ui: FContext,
    ) -> Option<PendingDefinitionAction>
    where
        FRender: FnOnce(&mut Ui, &mut Option<PendingDefinitionAction>),
        FContext: FnOnce(&mut Ui, &mut Option<PendingDefinitionAction>),
    {
        let mut action = None;
        const ITEM_ROW_HEIGHT: f32 = 36.0;
        let desired_width = (ui.available_width() - 10.0).max(0.0);
        let desired_size = vec2(desired_width, ITEM_ROW_HEIGHT);
        let (_, item_response) = ui.allocate_exact_size(desired_size, Sense::click());
        item_response.context_menu(|ui| context_menu_ui(ui, &mut action));

        ui.scope_builder(
            UiBuilder::new()
                .max_rect(item_response.rect)
                .layout(Layout::left_to_right(Align::Center)),
            |ui| {
                let visuals = ui.visuals();
                let mut frame = Frame::group(ui.style())
                    .fill(visuals.faint_bg_color)
                    .inner_margin(Margin::symmetric(8, 4));
                if is_applied {
                    frame = frame
                        .fill(visuals.widgets.active.bg_fill)
                        .stroke(visuals.selection.stroke);
                }
                frame.show(ui, |ui| render_ui(ui, &mut action));
            },
        );

        if item_response
            .on_hover_cursor(egui::CursorIcon::PointingHand)
            .clicked()
        {
            action = Some(toggle_action);
        }

        action
    }

    fn render_filter_display_row(ui: &mut Ui, row: &FilterRowView<'_>) {
        Sides::new().shrink_left().truncate().show(
            ui,
            |ui| {
                let text = if row.applied {
                    RichText::new(row.text).strong()
                } else {
                    RichText::new(row.text)
                };
                ui.label(text);
            },
            |ui| {
                Self::render_read_only_filter_flag(
                    ui,
                    icons::regular::ASTERISK,
                    row.applied,
                    row.flags.regex,
                    "Regular Expression",
                    row.regex_enable_eligibility,
                );
                Self::render_read_only_filter_flag(
                    ui,
                    icons::regular::TEXT_T,
                    row.applied,
                    row.flags.word,
                    "Match Whole Word",
                    &ValidationEligibility::Eligible,
                );
                Self::render_read_only_filter_flag(
                    ui,
                    icons::regular::TEXT_AA,
                    row.applied,
                    !row.flags.ignore_case,
                    "Match Case",
                    &ValidationEligibility::Eligible,
                );
            },
        );
    }

    fn render_search_value_display_row(ui: &mut Ui, row: &SearchValueRowView<'_>) {
        // Sides used to ensure we have same visuals on both filter and search values.
        Sides::new().shrink_left().truncate().show(
            ui,
            |ui| {
                let text = if row.applied {
                    RichText::new(row.text).strong()
                } else {
                    RichText::new(row.text)
                };
                ui.label(text);
            },
            |_ui| {},
        );
    }

    fn render_read_only_filter_flag(
        ui: &mut Ui,
        icon: &str,
        highlighted: bool,
        active: bool,
        tooltip: &str,
        eligibility: &ValidationEligibility,
    ) {
        let text_color = if highlighted && active {
            ui.visuals().text_color()
        } else {
            ui.visuals().weak_text_color()
        };
        let response = ui.label(RichText::new(icon).size(14.0).color(text_color));
        match eligibility {
            ValidationEligibility::Eligible => {
                response.on_hover_ui(|ui| {
                    ui.set_max_width(ui.spacing().tooltip_width);

                    ui.label(format!("{tooltip}: {}", if active { "On" } else { "Off" }));
                });
            }
            ValidationEligibility::Ineligible { reason } => {
                response.on_hover_ui(|ui| {
                    ui.set_max_width(ui.spacing().tooltip_width);

                    ui.label(format!(
                        "{tooltip}: {}. {reason}",
                        if active { "On" } else { "Off" }
                    ));
                });
            }
        };
    }
}

impl DefinitionQueryState {
    /// Refreshes the cached UUID set when the query or catalog revision changes.
    fn update_with_revision(
        &mut self,
        revision: u64,
        query_changed: bool,
        recompute_matches: impl FnOnce(&mut SubstringMatcher) -> Option<FxHashSet<Uuid>>,
    ) {
        if query_changed {
            self.matcher.build_query(self.query.trim());
        }

        if query_changed || self.cached_revision != revision {
            self.matching_ids = recompute_matches(&mut self.matcher);
            self.cached_revision = revision;
        }
    }

    /// Returns `true` when the row should stay visible for the current query.
    fn matches(&self, id: &Uuid) -> bool {
        // `None` means no active query, so all rows remain visible.
        self.matching_ids
            .as_ref()
            .is_none_or(|matching_ids| matching_ids.contains(id))
    }
}

fn collect_matching_filter_ids(
    matcher: &mut SubstringMatcher,
    registry: &FilterRegistry,
) -> Option<FxHashSet<Uuid>> {
    if !matcher.has_query() {
        return None;
    }

    Some(
        registry
            .filters_map()
            .iter()
            .filter_map(|(id, def)| matcher.matches(def.filter.value.as_str()).then_some(*id))
            .collect(),
    )
}

fn collect_matching_search_value_ids(
    matcher: &mut SubstringMatcher,
    registry: &FilterRegistry,
) -> Option<FxHashSet<Uuid>> {
    if !matcher.has_query() {
        return None;
    }

    Some(
        registry
            .search_value_map()
            .iter()
            .filter_map(|(id, def)| matcher.matches(def.filter.value.as_str()).then_some(*id))
            .collect(),
    )
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use tokio::{runtime::Runtime, sync::mpsc};
    use uuid::Uuid;

    use super::*;

    use crate::{
        host::{
            common::parsers::ParserNames,
            ui::registry::filters::{FilterDefinition, SearchValueDefinition},
        },
        session::{
            command::SessionCommand,
            types::ObserveOperation,
            ui::{SessionInfo, definitions::schema},
        },
    };

    use stypes::{FileFormat, ObserveOrigin};

    fn new_library() -> (LibraryUI, mpsc::Receiver<SessionCommand>) {
        let (cmd_tx, cmd_rx) = mpsc::channel(8);
        (LibraryUI::new(cmd_tx), cmd_rx)
    }

    fn new_shared() -> SessionShared {
        let session_id = Uuid::new_v4();
        let origin = ObserveOrigin::File(
            "source".to_owned(),
            FileFormat::Text,
            PathBuf::from("source.log"),
        );
        let observe_op = ObserveOperation::new(Uuid::new_v4(), origin);
        let session_info = SessionInfo {
            id: session_id,
            title: "test".to_owned(),
            parser: ParserNames::Text,
        };

        let schema = schema::from_parser(session_info.parser);
        SessionShared::new(session_info, observe_op, schema.as_ref())
    }

    fn new_actions(runtime: &Runtime) -> UiActions {
        UiActions::new(runtime.handle().clone())
    }

    fn add_filter_definition(registry: &mut FilterRegistry, value: &str) -> Uuid {
        let definition = FilterDefinition::new(
            processor::search::filter::SearchFilter::plain(value).ignore_case(true),
        );
        let id = definition.id;
        registry.add_filter(definition);
        id
    }

    fn add_search_value_definition(registry: &mut FilterRegistry, value: &str) -> Uuid {
        let definition = SearchValueDefinition::new(
            processor::search::filter::SearchFilter::plain(value)
                .regex(true)
                .ignore_case(true),
        );
        let id = definition.id;
        registry.add_search_value(definition);
        id
    }

    fn build_matcher(query: &str) -> SubstringMatcher {
        let mut matcher = SubstringMatcher::default();
        matcher.build_query(query.trim());
        matcher
    }

    #[test]
    fn empty_query_matches_all() {
        let mut matcher = build_matcher("");
        assert!(matcher.matches("status=ok"));

        let mut matcher = build_matcher("   ");
        assert!(matcher.matches("status=ok"));
    }

    #[test]
    fn empty_query_cache_is_none() {
        let mut registry = FilterRegistry::default();
        add_filter_definition(&mut registry, "status=ok");

        assert!(collect_matching_filter_ids(&mut build_matcher("   "), &registry).is_none());
        assert!(collect_matching_search_value_ids(&mut build_matcher("   "), &registry).is_none());
    }

    #[test]
    fn query_matches_case_insensitively() {
        let mut matcher = build_matcher("status");
        assert!(matcher.matches("Status=Ok"));

        let mut matcher = build_matcher("DUR");
        assert!(matcher.matches("duration=(\\d+)"));
    }

    #[test]
    fn filter_query_cache_collects_matching_ids() {
        let mut registry = FilterRegistry::default();
        let matching_id = add_filter_definition(&mut registry, "Status=Ok");
        let non_matching_id = add_filter_definition(&mut registry, "warn");
        let matching_ids =
            collect_matching_filter_ids(&mut build_matcher(" status "), &registry).unwrap();

        assert!(matching_ids.contains(&matching_id));
        assert!(!matching_ids.contains(&non_matching_id));
    }

    #[test]
    fn search_value_query_cache_collects_matching_ids() {
        let mut registry = FilterRegistry::default();
        let matching_id = add_search_value_definition(&mut registry, "duration=(\\d+)");
        let non_matching_id = add_search_value_definition(&mut registry, "latency=(\\d+)");
        let matching_ids =
            collect_matching_search_value_ids(&mut build_matcher(" DUR "), &registry).unwrap();

        assert!(matching_ids.contains(&matching_id));
        assert!(!matching_ids.contains(&non_matching_id));
    }

    #[test]
    fn query_rejects_non_matches() {
        let mut matcher = build_matcher("warn");
        assert!(!matcher.matches("status=ok"));
    }

    #[test]
    fn query_state_refreshes_on_revision_change() {
        let mut state = DefinitionQueryState {
            query: "warn".to_owned(),
            ..DefinitionQueryState::default()
        };
        let mut registry = FilterRegistry::default();
        let first_id = add_filter_definition(&mut registry, "warn");

        state.update_with_revision(registry.filter_definitions_revision(), true, |matcher| {
            collect_matching_filter_ids(matcher, &registry)
        });
        assert_eq!(
            state.matching_ids.as_ref(),
            Some(&FxHashSet::from_iter([first_id]))
        );

        let second_id = add_filter_definition(&mut registry, "warning");
        state.update_with_revision(registry.filter_definitions_revision(), false, |matcher| {
            collect_matching_filter_ids(matcher, &registry)
        });

        assert_eq!(
            state.matching_ids.as_ref(),
            Some(&FxHashSet::from_iter([first_id, second_id]))
        );

        state.query = "   ".to_owned();
        state.update_with_revision(registry.filter_definitions_revision(), true, |matcher| {
            collect_matching_filter_ids(matcher, &registry)
        });
        assert!(state.matching_ids.is_none());
    }

    #[test]
    fn toggle_filter_applies_and_syncs() {
        let runtime = Runtime::new().unwrap();
        let (library, mut cmd_rx) = new_library();
        let mut shared = new_shared();
        let mut actions = new_actions(&runtime);
        let mut registry = FilterRegistry::default();
        let filter_id = add_filter_definition(&mut registry, "status=ok");

        library.toggle_filter_definition(&mut shared, &mut actions, &mut registry, filter_id);

        assert!(shared.filters.is_filter_enabled(&filter_id));
        match cmd_rx.try_recv() {
            Ok(SessionCommand::ApplySearchFilter { filters, .. }) => {
                assert_eq!(filters.len(), 1);
                assert_eq!(filters[0].value, "status=ok");
            }
            other => panic!("expected ApplySearchFilter command, got {other:?}"),
        }
    }

    #[test]
    fn disabled_filter_toggle_unapplies() {
        let runtime = Runtime::new().unwrap();
        let (library, mut cmd_rx) = new_library();
        let mut shared = new_shared();
        let mut actions = new_actions(&runtime);
        let mut registry = FilterRegistry::default();
        let filter_id = add_filter_definition(&mut registry, "status=ok");
        shared
            .filters
            .apply_filter_with_state(&mut registry, filter_id, false);

        library.toggle_filter_definition(&mut shared, &mut actions, &mut registry, filter_id);

        assert!(!shared.filters.is_filter_applied(&filter_id));
        assert!(cmd_rx.try_recv().is_err());
    }

    #[test]
    fn deleting_enabled_filter_syncs() {
        let runtime = Runtime::new().unwrap();
        let (library, mut cmd_rx) = new_library();
        let mut shared = new_shared();
        let mut actions = new_actions(&runtime);
        let mut registry = FilterRegistry::default();
        let filter_id = add_filter_definition(&mut registry, "status=ok");
        shared.filters.apply_filter(&mut registry, filter_id);

        assert!(library.delete_filter_definition(
            &mut shared,
            &mut actions,
            &mut registry,
            filter_id
        ));

        assert!(!shared.filters.is_filter_applied(&filter_id));
        assert!(registry.get_filter(&filter_id).is_none());
        match cmd_rx.try_recv() {
            Ok(SessionCommand::DropSearch { operation_id }) => {
                assert_eq!(operation_id, None);
            }
            other => panic!("expected DropSearch command, got {other:?}"),
        }
    }

    #[test]
    fn deleting_disabled_filter_skips_sync() {
        let runtime = Runtime::new().unwrap();
        let (library, mut cmd_rx) = new_library();
        let mut shared = new_shared();
        let mut actions = new_actions(&runtime);
        let mut registry = FilterRegistry::default();
        let filter_id = add_filter_definition(&mut registry, "status=ok");
        shared
            .filters
            .apply_filter_with_state(&mut registry, filter_id, false);

        assert!(library.delete_filter_definition(
            &mut shared,
            &mut actions,
            &mut registry,
            filter_id
        ));

        assert!(!shared.filters.is_filter_applied(&filter_id));
        assert!(cmd_rx.try_recv().is_err());
    }

    #[test]
    fn toggle_chart_applies_and_syncs() {
        let runtime = Runtime::new().unwrap();
        let (library, mut cmd_rx) = new_library();
        let mut shared = new_shared();
        let mut actions = new_actions(&runtime);
        let mut registry = FilterRegistry::default();
        let value_id = add_search_value_definition(&mut registry, "duration=(\\d+)");

        library.toggle_search_value_definition(&mut shared, &mut actions, &mut registry, value_id);

        assert!(shared.filters.is_search_value_enabled(&value_id));
        match cmd_rx.try_recv() {
            Ok(SessionCommand::ApplySearchValuesFilter { filters, .. }) => {
                assert_eq!(filters, vec!["duration=(\\d+)".to_owned()]);
            }
            other => panic!("expected ApplySearchValuesFilter command, got {other:?}"),
        }
    }

    #[test]
    fn disabled_chart_toggle_unapplies() {
        let runtime = Runtime::new().unwrap();
        let (library, mut cmd_rx) = new_library();
        let mut shared = new_shared();
        let mut actions = new_actions(&runtime);
        let mut registry = FilterRegistry::default();
        let value_id = add_search_value_definition(&mut registry, "duration=(\\d+)");
        shared
            .filters
            .apply_search_value_with_state(&mut registry, value_id, false);

        library.toggle_search_value_definition(&mut shared, &mut actions, &mut registry, value_id);

        assert!(!shared.filters.is_search_value_applied(&value_id));
        assert!(cmd_rx.try_recv().is_err());
    }

    #[test]
    fn deleting_enabled_chart_syncs() {
        let runtime = Runtime::new().unwrap();
        let (library, mut cmd_rx) = new_library();
        let mut shared = new_shared();
        let mut actions = new_actions(&runtime);
        let mut registry = FilterRegistry::default();
        let value_id = add_search_value_definition(&mut registry, "duration=(\\d+)");
        shared.filters.apply_search_value(&mut registry, value_id);

        assert!(library.delete_search_value_definition(
            &mut shared,
            &mut actions,
            &mut registry,
            value_id
        ));

        assert!(!shared.filters.is_search_value_applied(&value_id));
        assert!(registry.get_search_value(&value_id).is_none());
        match cmd_rx.try_recv() {
            Ok(SessionCommand::DropSearchValues { operation_id }) => {
                assert_eq!(operation_id, None);
            }
            other => panic!("expected DropSearchValues command, got {other:?}"),
        }
    }

    #[test]
    fn shared_filter_cannot_be_deleted() {
        let runtime = Runtime::new().unwrap();
        let (library, mut cmd_rx) = new_library();
        let mut shared = new_shared();
        let mut actions = new_actions(&runtime);
        let mut registry = FilterRegistry::default();
        let filter_id = add_filter_definition(&mut registry, "status=ok");
        shared.filters.apply_filter(&mut registry, filter_id);
        registry.apply_filter_to_session(filter_id, Uuid::new_v4());

        assert!(!library.delete_filter_definition(
            &mut shared,
            &mut actions,
            &mut registry,
            filter_id
        ));

        assert!(shared.filters.is_filter_applied(&filter_id));
        assert!(registry.get_filter(&filter_id).is_some());
        assert!(cmd_rx.try_recv().is_err());
    }
}
