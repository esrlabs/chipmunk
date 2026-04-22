use egui::{Align, Frame, Layout, Margin, RichText, ScrollArea, Ui, UiBuilder, Widget, vec2};
use processor::search::filter::SearchFilter;
use rustc_hash::FxHashSet;
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::{
    common::{
        phosphor::icons,
        ui::{buttons, substring_matcher::SubstringMatcher, visibility_tracker::VisibilityTracker},
    },
    host::{
        command::{ExportPresetsParam, HostCommand},
        common::ui_utls::sized_singleline_text_edit,
        notification::AppNotification,
        ui::{
            UiActions,
            actions::{FileDialogFilter, FileDialogOptions},
            registry::{
                HostRegistry,
                filters::{FilterDefinition, SearchValueDefinition},
                presets::{Preset, PresetUpdateOutcome},
            },
        },
    },
    session::{
        command::SessionCommand,
        ui::shared::{SearchSyncTarget, SessionShared},
    },
};

use query::collect_matching_preset_ids;

mod query;
mod render;

const IMPORT_PRESETS_DIALOG_ID: &str = "import_presets";
const EXPORT_PRESETS_DIALOG_ID: &str = "export_presets";
const PRESETS_EXPORT_FILE_NAME: &str = "chipmunk-presets.json";

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
}

/// Cached name-filter state keyed by the preset catalog revision.
#[derive(Debug, Default)]
struct PresetQueryState {
    query: String,
    matcher: SubstringMatcher,
    // `None` means the query is empty and every preset stays visible.
    matching_ids: Option<rustc_hash::FxHashSet<Uuid>>,
    cached_revision: u64,
}

/// Render-time metadata for a single editable preset row.
#[derive(Debug, Clone, Copy)]
struct PresetItemRow<'a> {
    label: &'a str,
    index: usize,
    len: usize,
}

/// Logical sections shared by preset browse and edit rendering.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PresetBrowseSection {
    Filter,
    SearchValue,
}

/// Local draft state for the single preset card currently in edit mode.
#[derive(Debug, Clone)]
struct PresetEditState {
    preset_id: Uuid,
    draft_name: String,
    draft_filters: Vec<SearchFilter>,
    draft_search_values: Vec<SearchFilter>,
    // Used to autofocus the draft name exactly once when entering edit mode.
    first_render_frame: bool,
}

/// Persistent selection for the temporary export-only interaction mode.
#[derive(Debug, Clone)]
struct ExportSelectionState {
    selected_ids: FxHashSet<Uuid>,
    cached_revision: u64,
}

/// Result of applying a preset into the current session state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PresetApplyOutcome {
    NotFound,
    NoChanges,
    Applied(SearchSyncTarget),
}

/// Deferred UI intents emitted while rendering preset cards.
#[derive(Debug, Clone)]
enum PresetAction {
    SaveEdit(Uuid),
    CancelEdit(Uuid),
    Apply(Uuid),
    Delete(Uuid),
    ToggleExportSelection(Uuid),
    AddFilter(Uuid, SearchFilter),
    AddSearchValue(Uuid, SearchFilter),
    RemoveFilter(Uuid, usize),
    RemoveSearchValue(Uuid, usize),
    MoveFilter(Uuid, usize, usize),
    MoveSearchValue(Uuid, usize, usize),
}

impl PresetsUI {
    pub fn new(cmd_tx: Sender<SessionCommand>, host_cmd_tx: Sender<HostCommand>) -> Self {
        Self {
            cmd_tx,
            host_cmd_tx,
            query_state: PresetQueryState::default(),
            query_visibility: VisibilityTracker::default(),
            edit_state: None,
            export_state: None,
        }
    }

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
                        self.create_preset_from_session(shared, registry);
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
                                .filters(preset_file_filters()),
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
                        self.render_preset_card(preset, registry, ui, &mut pending_action);
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

    fn render_export_overlay(
        &mut self,
        actions: &mut UiActions,
        registry: &HostRegistry,
        view_rect: egui::Rect,
        ui: &mut Ui,
    ) {
        let can_select_filtered = self.has_visible_presets(registry);
        let selected_count = self.selected_export_count();
        let overlay_rect = view_rect.shrink2(vec2(6.0, 4.0));
        let mut overlay_ui = ui.new_child(
            UiBuilder::new()
                .max_rect(overlay_rect)
                .layout(Layout::bottom_up(Align::RIGHT)),
        );

        let visuals = overlay_ui.visuals();
        Frame::new()
            .fill(visuals.panel_fill)
            .stroke(visuals.window_stroke)
            .corner_radius(visuals.widgets.inactive.corner_radius)
            .inner_margin(Margin::symmetric(6, 4))
            .show(&mut overlay_ui, |ui| {
                ui.horizontal(|ui| {
                    let button_size = vec2(100.0, 20.0);

                    let cancel = buttons::bottom_panel("Cancel")
                        .min_size(button_size)
                        .ui(ui)
                        .on_hover_text("Exit export mode");

                    if cancel.clicked() {
                        self.cancel_export_mode();
                    }

                    let export_btn = buttons::bottom_panel(format!("Export ({selected_count})"))
                        .min_size(button_size);

                    if ui
                        .add_enabled(selected_count > 0, export_btn)
                        .on_disabled_hover_text("Select at least one preset to export")
                        .on_hover_text("Export the selected named presets")
                        .clicked()
                    {
                        actions.file_dialog.save_file(
                            EXPORT_PRESETS_DIALOG_ID,
                            FileDialogOptions::new()
                                .title("Export Presets")
                                .file_name(PRESETS_EXPORT_FILE_NAME)
                                .filters(preset_file_filters()),
                        );
                    }

                    let clear_btn = buttons::bottom_panel("Clear").min_size(button_size);
                    if ui
                        .add_enabled(selected_count > 0, clear_btn)
                        .on_disabled_hover_text("All export selections are already cleared")
                        .on_hover_text("Clear all selected presets")
                        .clicked()
                    {
                        self.clear_export_selection();
                    }

                    let select_all = buttons::bottom_panel("Select All").min_size(button_size);
                    if ui
                        .add_enabled(can_select_filtered, select_all)
                        .on_disabled_hover_text("No presets match the current filter")
                        .on_hover_text("Select all filtered")
                        .clicked()
                    {
                        self.select_filtered_for_export(registry);
                    }
                });
            });
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

    fn sync_export_state(&mut self, registry: &HostRegistry) {
        let Some(export_state) = self.export_state.as_mut() else {
            return;
        };

        let revision = registry.presets.definitions_revision();
        if export_state.cached_revision == revision {
            return;
        }

        export_state
            .selected_ids
            .retain(|preset_id| registry.presets.get(preset_id).is_some());
        export_state.cached_revision = revision;

        if registry.presets.presets().is_empty() {
            self.export_state = None;
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

    fn dispatch_import_request(&self, actions: &mut UiActions, path: std::path::PathBuf) -> bool {
        actions.try_send_command(&self.host_cmd_tx, HostCommand::ImportPresets(path))
    }

    fn dispatch_export_request(
        &self,
        actions: &mut UiActions,
        registry: &HostRegistry,
        path: std::path::PathBuf,
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

        actions.try_send_command(
            &self.host_cmd_tx,
            HostCommand::ExportPresets(Box::new(ExportPresetsParam { path, presets })),
        )
    }

    fn is_editing(&self, preset_id: Uuid) -> bool {
        self.edit_state
            .as_ref()
            .is_some_and(|state| state.preset_id == preset_id)
    }

    fn is_exporting(&self) -> bool {
        self.export_state.is_some()
    }

    fn is_selected_for_export(&self, preset_id: Uuid) -> bool {
        self.export_state
            .as_ref()
            .is_some_and(|state| state.selected_ids.contains(&preset_id))
    }

    fn selected_export_count(&self) -> usize {
        self.export_state
            .as_ref()
            .map_or(0, |state| state.selected_ids.len())
    }

    fn has_visible_presets(&self, registry: &HostRegistry) -> bool {
        registry
            .presets
            .presets()
            .iter()
            .any(|preset| self.query_state.matches(&preset.id))
    }

    fn start_export_mode(&mut self, registry: &HostRegistry) {
        self.export_state = Some(ExportSelectionState {
            selected_ids: registry
                .presets
                .presets()
                .iter()
                .map(|preset| preset.id)
                .collect(),
            cached_revision: registry.presets.definitions_revision(),
        });
    }

    fn cancel_export_mode(&mut self) {
        self.export_state = None;
    }

    fn clear_export_selection(&mut self) {
        let Some(export_state) = self.export_state.as_mut() else {
            return;
        };

        export_state.selected_ids.clear();
    }

    fn select_filtered_for_export(&mut self, registry: &HostRegistry) {
        let selected_ids = registry
            .presets
            .presets()
            .iter()
            .filter_map(|preset| self.query_state.matches(&preset.id).then_some(preset.id))
            .collect();

        let Some(export_state) = self.export_state.as_mut() else {
            return;
        };

        export_state.selected_ids = selected_ids;
    }

    fn toggle_export_selection(&mut self, preset_id: Uuid) {
        let Some(export_state) = self.export_state.as_mut() else {
            return;
        };

        if !export_state.selected_ids.remove(&preset_id) {
            export_state.selected_ids.insert(preset_id);
        }
    }

    fn start_edit_from_preset(&mut self, preset: &Preset) {
        self.edit_state = Some(PresetEditState::from_preset(preset));
    }

    fn save_edit(&mut self, registry: &mut HostRegistry, preset_id: Uuid) {
        let Some(edit_state) = self.edit_state.as_ref() else {
            return;
        };
        if edit_state.preset_id != preset_id {
            return;
        }

        let draft_name = edit_state.draft_name.clone();
        let draft_filters = edit_state.draft_filters.clone();
        let draft_search_values = edit_state.draft_search_values.clone();
        match registry.presets.update_preset(
            preset_id,
            draft_name,
            draft_filters,
            draft_search_values,
        ) {
            PresetUpdateOutcome::NotFound => self.sync_edit_state(registry),
            PresetUpdateOutcome::Unchanged | PresetUpdateOutcome::Updated { .. } => {
                self.edit_state = None;
            }
        }
    }

    fn cancel_edit(&mut self, preset_id: Uuid) {
        if self
            .edit_state
            .as_ref()
            .is_some_and(|state| state.preset_id == preset_id)
        {
            self.edit_state = None;
        }
    }

    fn add_filter_to_draft(&mut self, preset_id: Uuid, filter: SearchFilter) -> bool {
        let Some(edit_state) = self.edit_state.as_mut() else {
            return false;
        };
        if edit_state.preset_id != preset_id || edit_state.draft_filters.contains(&filter) {
            return false;
        }

        edit_state.draft_filters.push(filter);
        true
    }

    fn add_search_value_to_draft(&mut self, preset_id: Uuid, search_value: SearchFilter) -> bool {
        let Some(edit_state) = self.edit_state.as_mut() else {
            return false;
        };
        if edit_state.preset_id != preset_id
            || edit_state.draft_search_values.contains(&search_value)
        {
            return false;
        }

        edit_state.draft_search_values.push(search_value);
        true
    }

    fn remove_filter_from_draft(&mut self, preset_id: Uuid, index: usize) -> bool {
        let Some(edit_state) = self.edit_state.as_mut() else {
            return false;
        };
        if edit_state.preset_id != preset_id || index >= edit_state.draft_filters.len() {
            return false;
        }

        edit_state.draft_filters.remove(index);
        true
    }

    fn remove_search_value_from_draft(&mut self, preset_id: Uuid, index: usize) -> bool {
        let Some(edit_state) = self.edit_state.as_mut() else {
            return false;
        };
        if edit_state.preset_id != preset_id || index >= edit_state.draft_search_values.len() {
            return false;
        }

        edit_state.draft_search_values.remove(index);
        true
    }

    fn move_filter_in_draft(&mut self, preset_id: Uuid, from: usize, to: usize) -> bool {
        let Some(edit_state) = self.edit_state.as_mut() else {
            return false;
        };
        if edit_state.preset_id != preset_id {
            return false;
        }

        move_item(&mut edit_state.draft_filters, from, to)
    }

    fn move_search_value_in_draft(&mut self, preset_id: Uuid, from: usize, to: usize) -> bool {
        let Some(edit_state) = self.edit_state.as_mut() else {
            return false;
        };
        if edit_state.preset_id != preset_id {
            return false;
        }

        move_item(&mut edit_state.draft_search_values, from, to)
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

    fn create_preset_from_session(
        &mut self,
        shared: &SessionShared,
        registry: &mut HostRegistry,
    ) -> Uuid {
        registry
            .presets
            .add_preset_from_session(shared, &registry.filters)
    }

    fn apply_preset(
        &self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut HostRegistry,
        preset_id: Uuid,
    ) -> PresetApplyOutcome {
        let Some((filters, search_values)) = registry
            .presets
            .get(&preset_id)
            .map(|preset| (preset.filters.clone(), preset.search_values.clone()))
        else {
            return PresetApplyOutcome::NotFound;
        };

        // Materialize preset semantics through the normal registry/session path.
        // Existing applied rows, including disabled ones, are left as-is because
        // dedupe reuses their ids and the applied check skips re-applying them.
        let mut changed_filters = false;
        for filter in filters {
            let filter_id = registry.filters.add_filter(FilterDefinition::new(filter));
            if shared.filters.is_filter_applied(&filter_id) {
                continue;
            }

            shared.apply_filter(&mut registry.filters, filter_id);
            changed_filters = true;
        }

        let mut changed_search_values = false;
        for search_value in search_values {
            let value_id = registry
                .filters
                .add_search_value(SearchValueDefinition::new(search_value));
            if shared.filters.is_search_value_applied(&value_id) {
                continue;
            }

            shared.apply_search_value(&mut registry.filters, value_id);
            changed_search_values = true;
        }

        let outcome = match (changed_filters, changed_search_values) {
            (false, false) => PresetApplyOutcome::NoChanges,
            (true, false) => PresetApplyOutcome::Applied(SearchSyncTarget::Filter),
            (false, true) => PresetApplyOutcome::Applied(SearchSyncTarget::SearchValue),
            (true, true) => PresetApplyOutcome::Applied(SearchSyncTarget::Both),
        };

        if let PresetApplyOutcome::Applied(target) = outcome {
            self.dispatch_sync_commands(shared, actions, &registry.filters, target);
        }

        outcome
    }

    fn dispatch_sync_commands(
        &self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &crate::host::ui::registry::filters::FilterRegistry,
        target: SearchSyncTarget,
    ) {
        // Preset apply mutates session state first, then issues the same explicit
        // sync commands used by the rest of the search/filter UI.
        shared
            .sync_search_pipelines(registry, target)
            .into_iter()
            .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
    }
}

fn move_item<T>(items: &mut Vec<T>, from: usize, to: usize) -> bool {
    if from >= items.len() || to >= items.len() || from == to {
        return false;
    }

    let item = items.remove(from);
    items.insert(to, item);
    true
}

fn can_create_preset_from_session(shared: &SessionShared) -> bool {
    // Capture snapshots the full session items, not just enabled ones.
    !shared.filters.filter_entries.is_empty() || !shared.filters.search_value_entries.is_empty()
}

fn preset_file_filters() -> Vec<FileDialogFilter> {
    vec![FileDialogFilter::new("JSON", vec!["json".to_owned()])]
}

impl PresetEditState {
    fn from_preset(preset: &Preset) -> Self {
        Self {
            preset_id: preset.id,
            draft_name: preset.name.clone(),
            draft_filters: preset.filters.clone(),
            draft_search_values: preset.search_values.clone(),
            first_render_frame: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use tokio::{runtime::Runtime, sync::mpsc};
    use uuid::Uuid;

    use super::*;
    use crate::{
        host::{
            command::HostCommand,
            common::parsers::ParserNames,
            ui::registry::{
                HostRegistry,
                filters::{FilterDefinition, SearchValueDefinition},
            },
        },
        session::{command::SessionCommand, types::ObserveOperation, ui::SessionInfo},
    };
    use stypes::{FileFormat, ObserveOrigin};

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
        };

        SessionShared::new(session_info, observe_op)
    }

    fn new_actions(runtime: &Runtime) -> UiActions {
        UiActions::new(runtime.handle().clone())
    }

    fn add_filter_definition(
        registry: &mut crate::host::ui::registry::filters::FilterRegistry,
        value: &str,
    ) -> Uuid {
        let definition = FilterDefinition::new(SearchFilter::plain(value).ignore_case(true));
        let id = definition.id;
        registry.add_filter(definition);
        id
    }

    fn add_search_value_definition(
        registry: &mut crate::host::ui::registry::filters::FilterRegistry,
        value: &str,
    ) -> Uuid {
        let definition =
            SearchValueDefinition::new(SearchFilter::plain(value).regex(true).ignore_case(true));
        let id = definition.id;
        registry.add_search_value(definition);
        id
    }

    fn drain_commands(cmd_rx: &mut mpsc::Receiver<SessionCommand>) -> Vec<SessionCommand> {
        let mut commands = Vec::new();
        while let Ok(command) = cmd_rx.try_recv() {
            commands.push(command);
        }
        commands
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

        let preset_id = presets.create_preset_from_session(&shared, &mut registry);

        assert!(presets.edit_state.is_none());
        assert!(registry.presets.get(&preset_id).is_some());
    }

    #[test]
    fn export_mode_selects_all() {
        let (mut presets, _, _) = new_presets();
        let mut registry = HostRegistry::default();
        let first_id = registry.presets.add_preset("first", vec![], vec![]);
        let second_id = registry.presets.add_preset("second", vec![], vec![]);

        presets.start_export_mode(&registry);

        assert!(presets.is_exporting());
        assert_eq!(presets.selected_export_count(), 2);
        assert!(presets.is_selected_for_export(first_id));
        assert!(presets.is_selected_for_export(second_id));
    }

    #[test]
    fn export_mode_prunes_deleted() {
        let (mut presets, _, _) = new_presets();
        let mut registry = HostRegistry::default();
        let first_id = registry.presets.add_preset("first", vec![], vec![]);
        let second_id = registry.presets.add_preset("second", vec![], vec![]);
        presets.start_export_mode(&registry);

        assert!(registry.presets.remove_preset(second_id));
        presets.sync_export_state(&registry);

        assert!(presets.is_selected_for_export(first_id));
        assert!(!presets.is_selected_for_export(second_id));
        assert_eq!(presets.selected_export_count(), 1);
    }

    #[test]
    fn select_filtered_replaces_selection() {
        let (mut presets, _, _) = new_presets();
        let mut registry = HostRegistry::default();
        let error_id = registry.presets.add_preset("Errors", vec![], vec![]);
        let warn_id = registry.presets.add_preset("Warnings", vec![], vec![]);
        let other_error_id = registry.presets.add_preset("Error Group", vec![], vec![]);
        presets.start_export_mode(&registry);
        presets.query_state.query = "error".to_owned();
        presets.query_state.update_with_revision(
            registry.presets.definitions_revision(),
            true,
            |matcher| collect_matching_preset_ids(matcher, &registry),
        );

        presets.select_filtered_for_export(&registry);

        assert!(presets.is_selected_for_export(error_id));
        assert!(!presets.is_selected_for_export(warn_id));
        assert!(presets.is_selected_for_export(other_error_id));
        assert_eq!(presets.selected_export_count(), 2);
    }

    #[test]
    fn select_filtered_uses_all_when_empty() {
        let (mut presets, _, _) = new_presets();
        let mut registry = HostRegistry::default();
        let first_id = registry.presets.add_preset("Errors", vec![], vec![]);
        let second_id = registry.presets.add_preset("Warnings", vec![], vec![]);
        presets.start_export_mode(&registry);
        presets.toggle_export_selection(first_id);

        presets.select_filtered_for_export(&registry);

        assert!(presets.is_selected_for_export(first_id));
        assert!(presets.is_selected_for_export(second_id));
        assert_eq!(presets.selected_export_count(), 2);
    }

    #[test]
    fn clear_selection_empties_export_state() {
        let (mut presets, _, _) = new_presets();
        let mut registry = HostRegistry::default();
        let first_id = registry.presets.add_preset("Errors", vec![], vec![]);
        presets.start_export_mode(&registry);

        presets.clear_export_selection();

        assert!(!presets.is_selected_for_export(first_id));
        assert_eq!(presets.selected_export_count(), 0);
    }

    #[test]
    fn delete_clears_editor() {
        let (mut presets, _, _) = new_presets();
        let mut registry = HostRegistry::default();
        let preset_id = registry.presets.add_preset("first", vec![], vec![]);
        presets.start_edit_from_preset(registry.presets.get(&preset_id).unwrap());

        assert!(presets.delete_preset(&mut registry, preset_id));

        assert!(presets.edit_state.is_none());
    }

    #[test]
    fn edit_switches_cards() {
        let (mut presets, _, _) = new_presets();
        let mut registry = HostRegistry::default();
        let first_id = registry.presets.add_preset("first", vec![], vec![]);
        let second_id = registry.presets.add_preset("second", vec![], vec![]);
        presets.start_edit_from_preset(registry.presets.get(&first_id).unwrap());
        presets.edit_state.as_mut().unwrap().draft_name = "draft".to_owned();

        presets.start_edit_from_preset(registry.presets.get(&second_id).unwrap());

        let edit_state = presets.edit_state.as_ref().unwrap();
        assert_eq!(edit_state.preset_id, second_id);
        assert_eq!(edit_state.draft_name, "second");
    }

    #[test]
    fn move_filter_repositions_item() {
        let (mut presets, _, _) = new_presets();
        let mut registry = HostRegistry::default();
        let preset_id = registry.presets.add_preset(
            "first",
            vec![
                SearchFilter::plain("one"),
                SearchFilter::plain("two"),
                SearchFilter::plain("three"),
                SearchFilter::plain("four"),
            ],
            vec![],
        );
        presets.start_edit_from_preset(registry.presets.get(&preset_id).unwrap());

        assert!(presets.move_filter_in_draft(preset_id, 1, 3));

        let edit_state = presets.edit_state.as_ref().unwrap();
        assert_eq!(
            edit_state
                .draft_filters
                .iter()
                .map(|filter| filter.value.as_str())
                .collect::<Vec<_>>(),
            vec!["one", "three", "four", "two"]
        );
    }

    #[test]
    fn cancel_discards_draft() {
        let (mut presets, _, _) = new_presets();
        let mut registry = HostRegistry::default();
        let preset_id =
            registry
                .presets
                .add_preset("first", vec![], vec![SearchFilter::plain("one")]);
        presets.start_edit_from_preset(registry.presets.get(&preset_id).unwrap());
        let edit_state = presets.edit_state.as_mut().unwrap();
        edit_state.draft_name = "changed".to_owned();
        edit_state.draft_search_values.clear();

        presets.cancel_edit(preset_id);

        assert!(presets.edit_state.is_none());
        let preset = registry.presets.get(&preset_id).unwrap();
        assert_eq!(preset.name, "first");
        assert_eq!(preset.search_values.len(), 1);
    }

    #[test]
    fn save_commits_draft() {
        let (mut presets, _, _) = new_presets();
        let mut registry = HostRegistry::default();
        let first_id = registry.presets.add_preset(
            "first",
            vec![SearchFilter::plain("one").ignore_case(true)],
            vec![],
        );
        registry.presets.add_preset("taken", vec![], vec![]);
        registry.presets.add_preset("taken_2", vec![], vec![]);
        presets.start_edit_from_preset(registry.presets.get(&first_id).unwrap());
        let edit_state = presets.edit_state.as_mut().unwrap();
        edit_state.draft_name = "taken".to_owned();
        edit_state.draft_filters = vec![
            SearchFilter::plain("warn").ignore_case(true),
            SearchFilter::plain("error").ignore_case(true),
        ];
        edit_state.draft_search_values = vec![
            SearchFilter::plain("duration=(\\d+)")
                .regex(true)
                .ignore_case(true),
        ];

        presets.save_edit(&mut registry, first_id);

        let preset = registry.presets.get(&first_id).unwrap();
        assert_eq!(preset.name, "taken_3");
        assert_eq!(
            preset
                .filters
                .iter()
                .map(|filter| filter.value.clone())
                .collect::<Vec<_>>(),
            vec!["warn".to_owned(), "error".to_owned()]
        );
        assert_eq!(
            preset
                .search_values
                .iter()
                .map(|filter| filter.value.clone())
                .collect::<Vec<_>>(),
            vec!["duration=(\\d+)".to_owned()]
        );
        assert!(presets.edit_state.is_none());
    }

    #[test]
    fn apply_preset_skips_existing_rows() {
        let runtime = Runtime::new().unwrap();
        let (presets, mut cmd_rx, _) = new_presets();
        let mut shared = new_shared();
        let mut actions = new_actions(&runtime);
        let mut registry = HostRegistry::default();
        let filter_id = add_filter_definition(&mut registry.filters, "error");
        let value_id = add_search_value_definition(&mut registry.filters, "duration=(\\d+)");

        shared
            .filters
            .apply_filter_with_state(&mut registry.filters, filter_id, false);
        shared
            .filters
            .apply_search_value_with_state(&mut registry.filters, value_id, false);
        let original_filter_colors = shared.filters.filter_entries[0].colors.clone();
        let original_value_color = shared.filters.search_value_entries[0].color;
        let preset_id = registry.presets.add_preset(
            "test",
            vec![
                registry
                    .filters
                    .get_filter(&filter_id)
                    .unwrap()
                    .filter
                    .clone(),
                registry
                    .filters
                    .get_filter(&filter_id)
                    .unwrap()
                    .filter
                    .clone(),
            ],
            vec![
                registry
                    .filters
                    .get_search_value(&value_id)
                    .unwrap()
                    .filter
                    .clone(),
                registry
                    .filters
                    .get_search_value(&value_id)
                    .unwrap()
                    .filter
                    .clone(),
            ],
        );

        let outcome = presets.apply_preset(&mut shared, &mut actions, &mut registry, preset_id);

        assert_eq!(outcome, PresetApplyOutcome::NoChanges);
        assert_eq!(shared.filters.filter_entries.len(), 1);
        assert_eq!(shared.filters.search_value_entries.len(), 1);
        assert!(!shared.filters.filter_entries[0].enabled);
        assert!(!shared.filters.search_value_entries[0].enabled);
        assert_eq!(
            shared.filters.filter_entries[0].colors,
            original_filter_colors
        );
        assert_eq!(
            shared.filters.search_value_entries[0].color,
            original_value_color
        );
        assert_eq!(registry.filters.filters_map().len(), 1);
        assert_eq!(registry.filters.search_value_map().len(), 1);
        assert!(drain_commands(&mut cmd_rx).is_empty());
    }

    #[test]
    fn apply_preset_appends_and_syncs() {
        let runtime = Runtime::new().unwrap();
        let (presets, mut cmd_rx, _) = new_presets();
        let mut shared = new_shared();
        let mut actions = new_actions(&runtime);
        let mut registry = HostRegistry::default();
        let existing_filter_id = add_filter_definition(&mut registry.filters, "existing");
        let preset_id = registry.presets.add_preset(
            "test",
            vec![
                SearchFilter::plain("existing").ignore_case(true),
                SearchFilter::plain("error").ignore_case(true),
            ],
            vec![
                SearchFilter::plain("duration=(\\d+)")
                    .regex(true)
                    .ignore_case(true),
                SearchFilter::plain("latency=(\\d+)")
                    .regex(true)
                    .ignore_case(true),
            ],
        );
        shared
            .filters
            .apply_filter(&mut registry.filters, existing_filter_id);

        let outcome = presets.apply_preset(&mut shared, &mut actions, &mut registry, preset_id);

        assert_eq!(outcome, PresetApplyOutcome::Applied(SearchSyncTarget::Both));
        assert_eq!(
            shared
                .filters
                .filter_entries
                .iter()
                .map(|item| {
                    registry
                        .filters
                        .get_filter(&item.id)
                        .unwrap()
                        .filter
                        .value
                        .clone()
                })
                .collect::<Vec<_>>(),
            vec!["existing".to_owned(), "error".to_owned()]
        );
        assert_eq!(
            shared
                .filters
                .search_value_entries
                .iter()
                .map(|item| {
                    registry
                        .filters
                        .get_search_value(&item.id)
                        .unwrap()
                        .filter
                        .value
                        .clone()
                })
                .collect::<Vec<_>>(),
            vec!["duration=(\\d+)".to_owned(), "latency=(\\d+)".to_owned()]
        );

        let commands = drain_commands(&mut cmd_rx);
        assert_eq!(commands.len(), 2);
        match &commands[0] {
            SessionCommand::ApplySearchFilter { filters, .. } => {
                assert_eq!(filters.len(), 2);
                assert_eq!(filters[0].value, "existing");
                assert_eq!(filters[1].value, "error");
            }
            other => panic!("expected ApplySearchFilter command, got {other:?}"),
        }
        match &commands[1] {
            SessionCommand::ApplySearchValuesFilter { filters, .. } => {
                assert_eq!(
                    filters,
                    &vec!["duration=(\\d+)".to_owned(), "latency=(\\d+)".to_owned()]
                );
            }
            other => panic!("expected ApplySearchValuesFilter command, got {other:?}"),
        }
    }

    #[test]
    fn apply_preset_handles_missing_id() {
        let runtime = Runtime::new().unwrap();
        let (presets, mut cmd_rx, _) = new_presets();
        let mut shared = new_shared();
        let mut actions = new_actions(&runtime);
        let mut registry = HostRegistry::default();

        let outcome =
            presets.apply_preset(&mut shared, &mut actions, &mut registry, Uuid::new_v4());

        assert_eq!(outcome, PresetApplyOutcome::NotFound);
        assert!(drain_commands(&mut cmd_rx).is_empty());
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
        registry.presets.add_preset(
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
                    params.presets[0].filters,
                    vec![SearchFilter::plain("error").ignore_case(true)]
                );
                assert_eq!(
                    params.presets[0].search_values,
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
        let first_id =
            registry
                .presets
                .add_preset("Errors", vec![SearchFilter::plain("error")], vec![]);
        registry
            .presets
            .add_preset("Warnings", vec![SearchFilter::plain("warn")], vec![]);
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
