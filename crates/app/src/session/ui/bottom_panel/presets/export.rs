//! Preset export mode selection and overlay rendering.

use egui::{Align, Frame, Layout, Margin, Rect, Ui, UiBuilder, Widget, vec2};
use rustc_hash::FxHashSet;
use uuid::Uuid;

use crate::{
    common::ui::buttons,
    host::ui::{
        UiActions,
        actions::{FileDialogFilter, FileDialogOptions},
        registry::HostRegistry,
    },
};

use super::{EXPORT_PRESETS_DIALOG_ID, PRESETS_EXPORT_FILE_NAME, PresetsUI};

/// Persistent selection for the temporary export-only interaction mode.
#[derive(Debug, Clone)]
pub struct ExportSelectionState {
    /// Presets currently selected for export.
    pub selected_ids: FxHashSet<Uuid>,
    /// Preset catalog revision represented by the selection.
    pub cached_revision: u64,
}

impl PresetsUI {
    /// Renders the export-mode selection controls over the preset list.
    pub fn render_export_overlay(
        &mut self,
        actions: &mut UiActions,
        registry: &HostRegistry,
        view_rect: Rect,
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
                                .filters(vec![FileDialogFilter::new(
                                    "JSON (*.json)",
                                    vec!["json".to_owned()],
                                )]),
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

    /// Prunes export selection state after preset catalog changes.
    pub fn sync_export_state(&mut self, registry: &HostRegistry) {
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

    /// Returns whether the panel is in export selection mode.
    pub fn is_exporting(&self) -> bool {
        self.export_state.is_some()
    }

    /// Returns whether a preset is selected for export.
    pub fn is_selected_for_export(&self, preset_id: Uuid) -> bool {
        self.export_state
            .as_ref()
            .is_some_and(|state| state.selected_ids.contains(&preset_id))
    }

    /// Returns the number of presets selected for export.
    pub fn selected_export_count(&self) -> usize {
        self.export_state
            .as_ref()
            .map_or(0, |state| state.selected_ids.len())
    }

    /// Returns whether any presets match the current query filter.
    pub fn has_visible_presets(&self, registry: &HostRegistry) -> bool {
        registry
            .presets
            .presets()
            .iter()
            .any(|preset| self.query_state.matches(&preset.id))
    }

    /// Enters export mode with all current presets selected.
    pub fn start_export_mode(&mut self, registry: &HostRegistry) {
        let selected_ids = registry
            .presets
            .presets()
            .iter()
            .map(|preset| preset.id)
            .collect();
        let export_state = ExportSelectionState {
            selected_ids,
            cached_revision: registry.presets.definitions_revision(),
        };
        self.export_state = Some(export_state);
    }

    /// Exits export mode and discards its selection state.
    pub fn cancel_export_mode(&mut self) {
        self.export_state = None;
    }

    /// Clears all export selections.
    pub fn clear_export_selection(&mut self) {
        let Some(export_state) = self.export_state.as_mut() else {
            return;
        };

        export_state.selected_ids.clear();
    }

    /// Selects all presets visible under the current query filter.
    pub fn select_filtered_for_export(&mut self, registry: &HostRegistry) {
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

    /// Toggles whether a preset is selected for export.
    pub fn toggle_export_selection(&mut self, preset_id: Uuid) {
        let Some(export_state) = self.export_state.as_mut() else {
            return;
        };

        if !export_state.selected_ids.remove(&preset_id) {
            export_state.selected_ids.insert(preset_id);
        }
    }
}

#[cfg(test)]
mod tests {
    use processor::search::filter::SearchFilter;
    use tokio::sync::mpsc;
    use uuid::Uuid;

    use crate::{
        host::{
            command::HostCommand,
            ui::registry::{HostRegistry, presets::Preset},
        },
        session::command::SessionCommand,
    };

    use super::*;
    use crate::session::ui::bottom_panel::presets::query::collect_matching_preset_ids;

    fn new_presets() -> (
        PresetsUI,
        mpsc::Receiver<SessionCommand>,
        mpsc::Receiver<HostCommand>,
    ) {
        let (cmd_tx, cmd_rx) = mpsc::channel(8);
        let (host_cmd_tx, host_cmd_rx) = mpsc::channel(8);
        (PresetsUI::new(cmd_tx, host_cmd_tx), cmd_rx, host_cmd_rx)
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

    #[test]
    fn export_mode_selects_all() {
        let (mut presets, _, _) = new_presets();
        let mut registry = HostRegistry::default();
        let first_id = add_preset_with_default_state(&mut registry, "first", vec![], vec![]);
        let second_id = add_preset_with_default_state(&mut registry, "second", vec![], vec![]);

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
        let first_id = add_preset_with_default_state(&mut registry, "first", vec![], vec![]);
        let second_id = add_preset_with_default_state(&mut registry, "second", vec![], vec![]);
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
        let error_id = add_preset_with_default_state(&mut registry, "Errors", vec![], vec![]);
        let warn_id = add_preset_with_default_state(&mut registry, "Warnings", vec![], vec![]);
        let other_error_id =
            add_preset_with_default_state(&mut registry, "Error Group", vec![], vec![]);
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
        let first_id = add_preset_with_default_state(&mut registry, "Errors", vec![], vec![]);
        let second_id = add_preset_with_default_state(&mut registry, "Warnings", vec![], vec![]);
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
        let first_id = add_preset_with_default_state(&mut registry, "Errors", vec![], vec![]);
        presets.start_export_mode(&registry);

        presets.clear_export_selection();

        assert!(!presets.is_selected_for_export(first_id));
        assert_eq!(presets.selected_export_count(), 0);
    }
}
