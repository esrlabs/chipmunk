//! Preset tab state and interactions for the session bottom panel.

use std::path::PathBuf;

use egui::{Align, Layout, RichText, ScrollArea, Ui, Widget, vec2};
use processor::search::filter::SearchFilter;
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::{
    common::{
        phosphor::icons,
        ui::{buttons, visibility_tracker::VisibilityTracker},
    },
    host::{
        command::{ExportPresetsParam, HostCommand},
        common::ui_utls::sized_singleline_text_edit,
        notification::AppNotification,
        ui::{
            UiActions,
            actions::{FileDialogFilter, FileDialogOptions},
            registry::HostRegistry,
        },
    },
    session::{command::SessionCommand, ui::shared::SessionShared},
};

use edit::PresetEditState;
use export::ExportSelectionState;
use query::{PresetQueryState, collect_matching_preset_ids};

mod apply;
mod edit;
mod export;
mod query;
mod render;

const IMPORT_PRESETS_DIALOG_ID: &str = "import_presets";
const EXPORT_PRESETS_DIALOG_ID: &str = "export_presets";
const PRESETS_EXPORT_FILE_NAME: &str = "chipmunk-presets.json";

/// Immediate-mode state for the presets tab surface.
#[derive(Debug)]
pub struct PresetsUI {
    cmd_tx: Sender<SessionCommand>,
    host_cmd_tx: Sender<HostCommand>,
    query_state: PresetQueryState,
    // Used to focus the preset filter when the presets tab becomes visible again.
    query_visibility: VisibilityTracker,
    edit_state: Option<PresetEditState>,
    export_state: Option<ExportSelectionState>,
    /// Newly captured preset card that should be brought into view once rendered.
    scroll_to_preset: Option<Uuid>,
}

/// Deferred UI intents emitted while rendering preset cards.
#[derive(Debug, Clone)]
pub enum PresetAction {
    /// Save the active edit draft for a preset.
    SaveEdit(Uuid),
    /// Cancel the active edit draft for a preset.
    CancelEdit(Uuid),
    /// Apply a preset to the current session.
    Apply(Uuid),
    /// Delete a preset.
    Delete(Uuid),
    /// Toggle whether a preset is included in the export selection.
    ToggleExportSelection(Uuid),
    /// Add a filter to a preset edit draft.
    AddFilter(Uuid, SearchFilter),
    /// Add a chart/search-value to a preset edit draft.
    AddSearchValue(Uuid, SearchFilter),
    /// Remove a filter from a preset edit draft.
    RemoveFilter(Uuid, usize),
    /// Remove a chart/search-value from a preset edit draft.
    RemoveSearchValue(Uuid, usize),
    /// Move a filter row within a preset edit draft.
    MoveFilter(Uuid, usize, usize),
    /// Move a chart/search-value row within a preset edit draft.
    MoveSearchValue(Uuid, usize, usize),
}

impl PresetsUI {
    /// Creates preset panel state wired to session and host command channels.
    pub fn new(cmd_tx: Sender<SessionCommand>, host_cmd_tx: Sender<HostCommand>) -> Self {
        Self {
            cmd_tx,
            host_cmd_tx,
            query_state: PresetQueryState::default(),
            query_visibility: VisibilityTracker::default(),
            edit_state: None,
            export_state: None,
            scroll_to_preset: None,
        }
    }

    /// Renders the preset panel and processes deferred UI actions.
    pub fn render_content(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut HostRegistry,
        ui: &mut Ui,
    ) {
        self.sync_edit_state(registry);
        self.sync_export_state(registry);
        self.handle_file_dialog_output(actions, registry);
        let view_rect = ui.max_rect();

        ui.allocate_ui_with_layout(
            vec2(ui.available_width(), 23.),
            Layout::right_to_left(Align::Center),
            |ui| {
                if self.is_exporting() {
                    ui.add_space(5.0);
                    ui.label(RichText::new("Export mode").strong());
                } else {
                    let icons_size = 16.0;

                    let can_create_preset = can_create_preset_from_session(shared);
                    if ui
                        .add_enabled(
                            can_create_preset,
                            buttons::bottom_panel_icon(
                                RichText::new(icons::regular::PLUS).size(icons_size),
                            ),
                        )
                        .on_hover_text("Add preset from session")
                        .clicked()
                    {
                        self.capture_preset(shared, registry);
                    }

                    let can_export_presets = !registry.presets.presets().is_empty();
                    let mut export_button = ui
                        .add_enabled(
                            can_export_presets && self.edit_state.is_none(),
                            buttons::bottom_panel_icon(
                                RichText::new(icons::regular::EXPORT).size(icons_size),
                            ),
                        )
                        .on_hover_text("Select named presets to export");

                    if self.edit_state.is_some() {
                        export_button = export_button
                            .on_disabled_hover_text("Finish preset editing before exporting");
                    }
                    if export_button.clicked() {
                        self.start_export_mode(registry);
                    }

                    if buttons::bottom_panel_icon(
                        RichText::new(icons::regular::DOWNLOAD_SIMPLE).size(icons_size),
                    )
                    .ui(ui)
                    .on_hover_text("Import named presets")
                    .clicked()
                    {
                        actions.file_dialog.pick_file(
                            IMPORT_PRESETS_DIALOG_ID,
                            FileDialogOptions::new()
                                .title("Import Presets")
                                .filters(vec![
                                    FileDialogFilter::new("JSON (*.json)", vec!["json".to_owned()]),
                                    FileDialogFilter::new("Text (*.txt)", vec!["txt".to_owned()]),
                                    FileDialogFilter::new("All files (*)", vec!["*".to_owned()]),
                                ]),
                        );
                    }
                }

                ui.with_layout(Layout::left_to_right(Align::Center), |ui| {
                    let focus_query = self.query_visibility.is_newly_visible(ui);
                    let query_response = sized_singleline_text_edit(
                        ui,
                        &mut self.query_state.query,
                        ui.available_size(),
                        7,
                    )
                    .hint_text("Filter presets by name")
                    .ui(ui);
                    if focus_query {
                        query_response.request_focus();
                    }

                    self.query_state.update_with_revision(
                        registry.presets.definitions_revision(),
                        query_response.changed(),
                        |matcher| collect_matching_preset_ids(matcher, registry),
                    );

                    ui.add_space(10.0);
                });
            },
        );
        ui.add_space(4.0);

        if registry.presets.presets().is_empty() {
            ui.label(
                RichText::new("No presets yet. Capture the current session to create one.").weak(),
            );
            return;
        }

        let mut pending_action = None;
        let mut any_visible = false;
        ScrollArea::vertical()
            .id_salt("presets_cards")
            // Enable on X => Scrollbar aligned on far right.
            // Disable on Y => Avoid infinite resize when no items to show
            // due to filters.
            .auto_shrink([false, true])
            .show(ui, |ui| {
                ui.horizontal_wrapped(|ui| {
                    for preset in registry.presets.presets() {
                        if !self.query_state.matches(&preset.id) {
                            continue;
                        }

                        any_visible = true;
                        let card_response =
                            self.render_preset_card(preset, registry, ui, &mut pending_action);
                        if self
                            .scroll_to_preset
                            .take_if(|target| *target == preset.id)
                            .is_some()
                        {
                            ui.scroll_to_rect(card_response.rect, Some(Align::BOTTOM));
                        }
                        ui.add_space(8.0);
                    }
                });
            });

        if !any_visible {
            ui.label(RichText::new("No presets match the current filter.").weak());
        }

        if self.is_exporting() {
            self.render_export_overlay(actions, registry, view_rect, ui);
        }

        if let Some(action) = pending_action {
            self.handle_preset_action(action, shared, actions, registry);
        }
    }

    fn handle_preset_action(
        &mut self,
        action: PresetAction,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut HostRegistry,
    ) {
        match action {
            PresetAction::SaveEdit(id) => self.save_edit(registry, id),
            PresetAction::CancelEdit(id) => self.cancel_edit(id),
            PresetAction::Apply(id) => {
                let _ = self.apply_preset(shared, actions, registry, id);
            }
            PresetAction::Delete(id) => {
                self.delete_preset(registry, id);
            }
            PresetAction::ToggleExportSelection(id) => self.toggle_export_selection(id),
            PresetAction::AddFilter(id, filter) => {
                self.add_filter_to_draft(id, filter);
            }
            PresetAction::AddSearchValue(id, filter) => {
                self.add_search_value_to_draft(id, filter);
            }
            PresetAction::RemoveFilter(id, index) => {
                self.remove_filter_from_draft(id, index);
            }
            PresetAction::RemoveSearchValue(id, index) => {
                self.remove_search_value_from_draft(id, index);
            }
            PresetAction::MoveFilter(id, from, to) => {
                self.move_filter_in_draft(id, from, to);
            }
            PresetAction::MoveSearchValue(id, from, to) => {
                self.move_search_value_in_draft(id, from, to);
            }
        }
    }

    fn sync_edit_state(&mut self, registry: &HostRegistry) {
        if self
            .edit_state
            .as_ref()
            .is_some_and(|state| registry.presets.get(&state.preset_id).is_none())
        {
            self.edit_state = None;
        }
    }

    fn handle_file_dialog_output(&mut self, actions: &mut UiActions, registry: &HostRegistry) {
        let Some((dialog_id, paths)) = actions
            .file_dialog
            .take_output_many(&[IMPORT_PRESETS_DIALOG_ID, EXPORT_PRESETS_DIALOG_ID])
        else {
            return;
        };

        match (dialog_id, paths.as_slice()) {
            (IMPORT_PRESETS_DIALOG_ID, [path]) => {
                self.dispatch_import_request(actions, path.clone());
            }
            (EXPORT_PRESETS_DIALOG_ID, [path]) => {
                if self.dispatch_export_request(actions, registry, path.clone()) {
                    self.cancel_export_mode();
                }
            }
            (_, []) => {}
            (IMPORT_PRESETS_DIALOG_ID, _) => actions.add_notification(AppNotification::UiError(
                "Preset import expects a single selected file.".into(),
            )),
            (EXPORT_PRESETS_DIALOG_ID, _) => actions.add_notification(AppNotification::UiError(
                "Preset export expects a single destination path.".into(),
            )),
            _ => unreachable!("only preset dialog ids are requested here"),
        }
    }

    fn dispatch_import_request(&self, actions: &mut UiActions, path: PathBuf) -> bool {
        actions.try_send_command(&self.host_cmd_tx, HostCommand::ImportPresets(path))
    }

    fn dispatch_export_request(
        &self,
        actions: &mut UiActions,
        registry: &HostRegistry,
        path: PathBuf,
    ) -> bool {
        let presets = match self.export_state.as_ref() {
            Some(export_state) => registry
                .presets
                .presets()
                .iter()
                .filter(|preset| export_state.selected_ids.contains(&preset.id))
                .cloned()
                .collect(),
            None => registry.presets.presets().to_vec(),
        };
        if presets.is_empty() {
            actions.add_notification(AppNotification::UiError(
                "Select at least one preset to export.".into(),
            ));
            return false;
        }

        let params = ExportPresetsParam { path, presets };
        actions.try_send_command(
            &self.host_cmd_tx,
            HostCommand::ExportPresets(Box::new(params)),
        )
    }

    fn is_editing(&self, preset_id: Uuid) -> bool {
        self.edit_state
            .as_ref()
            .is_some_and(|state| state.preset_id == preset_id)
    }

    fn delete_preset(&mut self, registry: &mut HostRegistry, preset_id: Uuid) -> bool {
        if !registry.presets.remove_preset(preset_id) {
            return false;
        }

        if self.is_editing(preset_id) {
            self.edit_state = None;
        }

        true
    }

    /// Captures the current session filters and charts as a named preset.
    pub fn capture_preset(&mut self, shared: &SessionShared, registry: &mut HostRegistry) -> Uuid {
        let preset_id = registry
            .presets
            .add_preset_from_session(shared, &registry.filters);
        self.scroll_to_preset = Some(preset_id);
        preset_id
    }
}

fn can_create_preset_from_session(shared: &SessionShared) -> bool {
    // Capture snapshots the full session items, not just enabled ones.
    !shared.filters.filter_entries.is_empty() || !shared.filters.search_value_entries.is_empty()
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use processor::search::filter::SearchFilter;
    use stypes::{FileFormat, ObserveOrigin};
    use tokio::{runtime::Runtime, sync::mpsc};
    use uuid::Uuid;

    use crate::{
        host::{
            command::HostCommand,
            common::parsers::ParserNames,
            ui::{
                UiActions,
                registry::{
                    HostRegistry,
                    filters::{FilterDefinition, FilterRegistry, SearchValueDefinition},
                    presets::Preset,
                },
            },
        },
        session::{command::SessionCommand, types::ObserveOperation, ui::SessionInfo},
    };

    use super::*;
    use crate::session::ui::definitions::schema::LogSchemaSpec;

    fn new_presets() -> (
        PresetsUI,
        mpsc::Receiver<SessionCommand>,
        mpsc::Receiver<HostCommand>,
    ) {
        let (cmd_tx, cmd_rx) = mpsc::channel(8);
        let (host_cmd_tx, host_cmd_rx) = mpsc::channel(8);
        (PresetsUI::new(cmd_tx, host_cmd_tx), cmd_rx, host_cmd_rx)
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
            raw_export_supported: false,
        };

        SessionShared::new(session_info, observe_op, LogSchemaSpec::Text)
    }

    fn new_actions(runtime: &Runtime) -> UiActions {
        UiActions::new(runtime.handle().clone())
    }

    fn add_filter_definition(registry: &mut FilterRegistry, value: &str) -> Uuid {
        let definition = FilterDefinition::new(SearchFilter::plain(value).ignore_case(true));
        let id = definition.id;
        registry.add_filter(definition);
        id
    }

    fn add_search_value_definition(registry: &mut FilterRegistry, value: &str) -> Uuid {
        let definition =
            SearchValueDefinition::new(SearchFilter::plain(value).regex(true).ignore_case(true));
        let id = definition.id;
        registry.add_search_value(definition);
        id
    }

    fn add_preset_with_default_state(
        registry: &mut HostRegistry,
        name: &str,
        filters: Vec<SearchFilter>,
        search_values: Vec<SearchFilter>,
    ) -> Uuid {
        let preset =
            Preset::with_default_state(Uuid::new_v4(), name.to_owned(), filters, search_values);
        registry
            .presets
            .add_preset(preset.name, preset.filters, preset.search_values)
    }

    fn drain_host_commands(host_cmd_rx: &mut mpsc::Receiver<HostCommand>) -> Vec<HostCommand> {
        let mut commands = Vec::new();
        while let Ok(command) = host_cmd_rx.try_recv() {
            commands.push(command);
        }
        commands
    }

    #[test]
    fn create_requires_session_items() {
        let mut shared = new_shared();
        let mut registry = HostRegistry::default();

        assert!(!can_create_preset_from_session(&shared));

        let filter_id = add_filter_definition(&mut registry.filters, "error");
        shared
            .filters
            .apply_filter(&mut registry.filters, filter_id);
        assert!(can_create_preset_from_session(&shared));

        shared
            .filters
            .unapply_filter(&mut registry.filters, &filter_id);
        assert!(!can_create_preset_from_session(&shared));

        let value_id = add_search_value_definition(&mut registry.filters, "duration=(\\d+)");
        shared
            .filters
            .apply_search_value(&mut registry.filters, value_id);
        assert!(can_create_preset_from_session(&shared));
    }

    #[test]
    fn create_stays_in_browse_mode() {
        let (mut presets, _, _) = new_presets();
        let shared = new_shared();
        let mut registry = HostRegistry::default();

        let preset_id = presets.capture_preset(&shared, &mut registry);

        assert!(presets.edit_state.is_none());
        assert_eq!(presets.scroll_to_preset, Some(preset_id));
        assert!(registry.presets.get(&preset_id).is_some());
    }

    #[test]
    fn delete_clears_editor() {
        let (mut presets, _, _) = new_presets();
        let mut registry = HostRegistry::default();
        let preset_id = add_preset_with_default_state(&mut registry, "first", vec![], vec![]);
        presets.start_edit_from_preset(registry.presets.get(&preset_id).unwrap());

        assert!(presets.delete_preset(&mut registry, preset_id));

        assert!(presets.edit_state.is_none());
    }

    #[test]
    fn dispatch_import_sends_host_command() {
        let runtime = Runtime::new().unwrap();
        let (presets, _, mut host_cmd_rx) = new_presets();
        let mut actions = new_actions(&runtime);
        let path = PathBuf::from("/tmp/import.json");

        assert!(presets.dispatch_import_request(&mut actions, path.clone()));

        let commands = drain_host_commands(&mut host_cmd_rx);
        assert_eq!(commands.len(), 1);
        match &commands[0] {
            HostCommand::ImportPresets(sent_path) => assert_eq!(sent_path, &path),
            other => panic!("expected ImportPresets command, got {other:?}"),
        }
    }

    #[test]
    fn dispatch_export_snapshots_registry() {
        let runtime = Runtime::new().unwrap();
        let (presets, _, mut host_cmd_rx) = new_presets();
        let mut actions = new_actions(&runtime);
        let mut registry = HostRegistry::default();
        add_preset_with_default_state(
            &mut registry,
            "Errors",
            vec![SearchFilter::plain("error").ignore_case(true)],
            vec![
                SearchFilter::plain("duration=(\\d+)")
                    .regex(true)
                    .ignore_case(true),
            ],
        );
        let path = PathBuf::from("/tmp/export.json");

        assert!(presets.dispatch_export_request(&mut actions, &registry, path.clone()));

        let commands = drain_host_commands(&mut host_cmd_rx);
        assert_eq!(commands.len(), 1);
        match &commands[0] {
            HostCommand::ExportPresets(params) => {
                assert_eq!(params.path, path);
                assert_eq!(params.presets.len(), 1);
                assert_eq!(params.presets[0].name, "Errors");
                assert_eq!(
                    params.presets[0]
                        .filters
                        .iter()
                        .map(|entry| entry.filter.clone())
                        .collect::<Vec<_>>(),
                    vec![SearchFilter::plain("error").ignore_case(true)]
                );
                assert_eq!(
                    params.presets[0]
                        .search_values
                        .iter()
                        .map(|entry| entry.filter.clone())
                        .collect::<Vec<_>>(),
                    vec![
                        SearchFilter::plain("duration=(\\d+)")
                            .regex(true)
                            .ignore_case(true)
                    ]
                );
            }
            other => panic!("expected ExportPresets command, got {other:?}"),
        }
    }

    #[test]
    fn dispatch_export_uses_selected_presets() {
        let runtime = Runtime::new().unwrap();
        let (mut presets, _, mut host_cmd_rx) = new_presets();
        let mut actions = new_actions(&runtime);
        let mut registry = HostRegistry::default();
        let first_id = add_preset_with_default_state(
            &mut registry,
            "Errors",
            vec![SearchFilter::plain("error")],
            vec![],
        );
        add_preset_with_default_state(
            &mut registry,
            "Warnings",
            vec![SearchFilter::plain("warn")],
            vec![],
        );
        let path = PathBuf::from("/tmp/export.json");
        presets.start_export_mode(&registry);
        presets.toggle_export_selection(first_id);

        assert!(presets.dispatch_export_request(&mut actions, &registry, path.clone()));

        let commands = drain_host_commands(&mut host_cmd_rx);
        assert_eq!(commands.len(), 1);
        match &commands[0] {
            HostCommand::ExportPresets(params) => {
                assert_eq!(params.path, path);
                assert_eq!(params.presets.len(), 1);
                assert_eq!(params.presets[0].name, "Warnings");
            }
            other => panic!("expected ExportPresets command, got {other:?}"),
        }
    }
}
