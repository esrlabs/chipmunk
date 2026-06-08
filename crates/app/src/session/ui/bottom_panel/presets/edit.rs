//! Preset edit state and draft mutations.

use processor::search::filter::SearchFilter;
use uuid::Uuid;

use crate::host::ui::registry::{
    HostRegistry,
    presets::{Preset, PresetFilterEntry, PresetSearchValueEntry, PresetUpdateOutcome},
};

use super::PresetsUI;

/// Local draft state for the single preset card currently in edit mode.
#[derive(Debug, Clone)]
pub struct PresetEditState {
    /// Preset being edited.
    pub preset_id: Uuid,
    /// Editable preset name.
    pub draft_name: String,
    /// Editable filter row snapshots.
    pub draft_filters: Vec<PresetFilterEntry>,
    /// Editable chart/search-value row snapshots.
    pub draft_search_values: Vec<PresetSearchValueEntry>,
    /// Whether the next render should autofocus the draft name.
    pub first_render_frame: bool,
}

impl PresetsUI {
    /// Starts editing from the current stored preset snapshot.
    pub fn start_edit_from_preset(&mut self, preset: &Preset) {
        self.edit_state = Some(PresetEditState::from_preset(preset));
    }

    /// Saves the active preset edit draft when it matches the requested preset.
    pub fn save_edit(&mut self, registry: &mut HostRegistry, preset_id: Uuid) {
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

    /// Cancels the active preset edit draft when it matches the requested preset.
    pub fn cancel_edit(&mut self, preset_id: Uuid) {
        if self
            .edit_state
            .as_ref()
            .is_some_and(|state| state.preset_id == preset_id)
        {
            self.edit_state = None;
        }
    }

    /// Adds a filter row to the active edit draft.
    pub fn add_filter_to_draft(&mut self, preset_id: Uuid, filter: SearchFilter) -> bool {
        let Some(edit_state) = self.edit_state.as_mut() else {
            return false;
        };
        if edit_state.preset_id != preset_id
            || edit_state
                .draft_filters
                .iter()
                .any(|entry| entry.filter == filter)
        {
            return false;
        }

        let entry = PresetFilterEntry::with_next_color(filter, &edit_state.draft_filters);
        edit_state.draft_filters.push(entry);
        true
    }

    /// Adds a chart/search-value row to the active edit draft.
    pub fn add_search_value_to_draft(
        &mut self,
        preset_id: Uuid,
        search_value: SearchFilter,
    ) -> bool {
        let Some(edit_state) = self.edit_state.as_mut() else {
            return false;
        };
        if edit_state.preset_id != preset_id
            || edit_state
                .draft_search_values
                .iter()
                .any(|entry| entry.filter == search_value)
        {
            return false;
        }

        let entry =
            PresetSearchValueEntry::with_next_color(search_value, &edit_state.draft_search_values);
        edit_state.draft_search_values.push(entry);
        true
    }

    /// Toggles a filter row in the active edit draft.
    pub fn toggle_filter_in_draft(&mut self, preset_id: Uuid, index: usize) -> bool {
        let Some(edit_state) = self.edit_state.as_mut() else {
            return false;
        };
        if edit_state.preset_id != preset_id {
            return false;
        }

        let Some(entry) = edit_state.draft_filters.get_mut(index) else {
            return false;
        };
        entry.enabled = !entry.enabled;
        true
    }

    /// Toggles a chart/search-value row in the active edit draft.
    pub fn toggle_search_value_in_draft(&mut self, preset_id: Uuid, index: usize) -> bool {
        let Some(edit_state) = self.edit_state.as_mut() else {
            return false;
        };
        if edit_state.preset_id != preset_id {
            return false;
        }

        let Some(entry) = edit_state.draft_search_values.get_mut(index) else {
            return false;
        };
        entry.enabled = !entry.enabled;
        true
    }

    /// Removes a filter row from the active edit draft.
    pub fn remove_filter_from_draft(&mut self, preset_id: Uuid, index: usize) -> bool {
        let Some(edit_state) = self.edit_state.as_mut() else {
            return false;
        };
        if edit_state.preset_id != preset_id || index >= edit_state.draft_filters.len() {
            return false;
        }

        edit_state.draft_filters.remove(index);
        true
    }

    /// Removes a chart/search-value row from the active edit draft.
    pub fn remove_search_value_from_draft(&mut self, preset_id: Uuid, index: usize) -> bool {
        let Some(edit_state) = self.edit_state.as_mut() else {
            return false;
        };
        if edit_state.preset_id != preset_id || index >= edit_state.draft_search_values.len() {
            return false;
        }

        edit_state.draft_search_values.remove(index);
        true
    }

    /// Moves a filter row within the active edit draft.
    pub fn move_filter_in_draft(&mut self, preset_id: Uuid, from: usize, to: usize) -> bool {
        let Some(edit_state) = self.edit_state.as_mut() else {
            return false;
        };
        if edit_state.preset_id != preset_id {
            return false;
        }

        move_item(&mut edit_state.draft_filters, from, to)
    }

    /// Moves a chart/search-value row within the active edit draft.
    pub fn move_search_value_in_draft(&mut self, preset_id: Uuid, from: usize, to: usize) -> bool {
        let Some(edit_state) = self.edit_state.as_mut() else {
            return false;
        };
        if edit_state.preset_id != preset_id {
            return false;
        }

        move_item(&mut edit_state.draft_search_values, from, to)
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

impl PresetEditState {
    /// Creates an edit draft from a stored preset snapshot.
    pub fn from_preset(preset: &Preset) -> Self {
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
    use processor::search::filter::SearchFilter;
    use tokio::sync::mpsc;
    use uuid::Uuid;

    use crate::{
        host::{
            command::HostCommand,
            ui::registry::{
                HostRegistry,
                presets::{Preset, PresetFilterEntry, PresetSearchValueEntry},
            },
        },
        session::command::SessionCommand,
    };

    use super::*;

    fn new_presets() -> (
        PresetsUI,
        mpsc::Receiver<SessionCommand>,
        mpsc::Receiver<HostCommand>,
    ) {
        let (cmd_tx, cmd_rx) = mpsc::channel(8);
        let (host_cmd_tx, host_cmd_rx) = mpsc::channel(8);
        (PresetsUI::new(cmd_tx, host_cmd_tx), cmd_rx, host_cmd_rx)
    }

    fn filter_entries(filters: Vec<SearchFilter>) -> Vec<PresetFilterEntry> {
        Preset::with_default_state(Uuid::new_v4(), "preset".to_owned(), filters, vec![]).filters
    }

    fn search_value_entries(search_values: Vec<SearchFilter>) -> Vec<PresetSearchValueEntry> {
        Preset::with_default_state(Uuid::new_v4(), "preset".to_owned(), vec![], search_values)
            .search_values
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
    fn edit_switches_cards() {
        let (mut presets, _, _) = new_presets();
        let mut registry = HostRegistry::default();
        let first_id = add_preset_with_default_state(&mut registry, "first", vec![], vec![]);
        let second_id = add_preset_with_default_state(&mut registry, "second", vec![], vec![]);
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
        let preset_id = add_preset_with_default_state(
            &mut registry,
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
                .map(|entry| entry.filter.value.as_str())
                .collect::<Vec<_>>(),
            vec!["one", "three", "four", "two"]
        );
    }

    #[test]
    fn cancel_discards_draft() {
        let (mut presets, _, _) = new_presets();
        let mut registry = HostRegistry::default();
        let preset_id = add_preset_with_default_state(
            &mut registry,
            "first",
            vec![],
            vec![SearchFilter::plain("one")],
        );
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
    fn toggle_updates_draft_enabled_state() {
        let (mut presets, _, _) = new_presets();
        let mut registry = HostRegistry::default();
        let preset_id = add_preset_with_default_state(
            &mut registry,
            "first",
            vec![SearchFilter::plain("filter")],
            vec![SearchFilter::plain("chart")],
        );
        presets.start_edit_from_preset(registry.presets.get(&preset_id).unwrap());

        assert!(presets.toggle_filter_in_draft(preset_id, 0));
        assert!(presets.toggle_search_value_in_draft(preset_id, 0));

        let edit_state = presets.edit_state.as_ref().unwrap();
        assert!(!edit_state.draft_filters[0].enabled);
        assert!(!edit_state.draft_search_values[0].enabled);
    }

    #[test]
    fn save_commits_draft() {
        let (mut presets, _, _) = new_presets();
        let mut registry = HostRegistry::default();
        let first_id = add_preset_with_default_state(
            &mut registry,
            "first",
            vec![SearchFilter::plain("one").ignore_case(true)],
            vec![],
        );
        add_preset_with_default_state(&mut registry, "taken", vec![], vec![]);
        add_preset_with_default_state(&mut registry, "taken_2", vec![], vec![]);
        presets.start_edit_from_preset(registry.presets.get(&first_id).unwrap());
        let edit_state = presets.edit_state.as_mut().unwrap();
        edit_state.draft_name = "taken".to_owned();
        edit_state.draft_filters = filter_entries(vec![
            SearchFilter::plain("warn").ignore_case(true),
            SearchFilter::plain("error").ignore_case(true),
        ]);
        edit_state.draft_search_values = search_value_entries(vec![
            SearchFilter::plain("duration=(\\d+)")
                .regex(true)
                .ignore_case(true),
        ]);
        edit_state.draft_filters[1].enabled = false;
        edit_state.draft_search_values[0].enabled = false;

        presets.save_edit(&mut registry, first_id);

        let preset = registry.presets.get(&first_id).unwrap();
        assert_eq!(preset.name, "taken_3");
        assert_eq!(
            preset
                .filters
                .iter()
                .map(|entry| entry.filter.value.clone())
                .collect::<Vec<_>>(),
            vec!["warn".to_owned(), "error".to_owned()]
        );
        assert_eq!(
            preset
                .search_values
                .iter()
                .map(|entry| entry.filter.value.clone())
                .collect::<Vec<_>>(),
            vec!["duration=(\\d+)".to_owned()]
        );
        assert!(preset.filters[0].enabled);
        assert!(!preset.filters[1].enabled);
        assert!(!preset.search_values[0].enabled);
        assert!(presets.edit_state.is_none());
    }
}
