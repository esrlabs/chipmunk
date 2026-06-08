//! Preset application into the active session state.

use uuid::Uuid;

use crate::{
    host::ui::{
        UiActions,
        registry::{
            HostRegistry,
            filters::{FilterDefinition, FilterRegistry, SearchValueDefinition},
            presets::{PresetFilterEntry, PresetSearchValueEntry},
        },
    },
    session::ui::shared::{SearchSyncTarget, SessionShared},
};

use super::PresetsUI;

/// Result of applying a preset into the current session state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PresetApplyOutcome {
    /// No preset exists for the requested id.
    NotFound,
    /// The preset did not add or update session rows.
    NoChanges,
    /// The preset changed session rows, but active backend search inputs stayed unchanged.
    AppliedNoSync,
    /// The preset changed rows that require backend sync.
    Applied(SearchSyncTarget),
}

impl PresetsUI {
    /// Applies a preset to the session and dispatches required backend sync commands.
    pub fn apply_preset(
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

        let before_filters = shared
            .filters
            .enabled_filter_ids()
            .copied()
            .collect::<Vec<_>>();
        let before_search_values = shared
            .filters
            .enabled_search_value_ids()
            .copied()
            .collect::<Vec<_>>();

        let mut changed = false;
        for entry in filters {
            let PresetFilterEntry {
                filter,
                enabled,
                colors,
            } = entry;
            let filter_id = registry.filters.add_filter(FilterDefinition::new(filter));
            changed |=
                shared.set_filter_entry_state(&mut registry.filters, filter_id, enabled, colors);
        }

        for entry in search_values {
            let PresetSearchValueEntry {
                filter,
                enabled,
                color,
            } = entry;
            let value_id = registry
                .filters
                .add_search_value(SearchValueDefinition::new(filter));
            changed |= shared.set_search_value_entry_state(
                &mut registry.filters,
                value_id,
                enabled,
                color,
            );
        }

        let after_filters = shared
            .filters
            .enabled_filter_ids()
            .copied()
            .collect::<Vec<_>>();
        let after_search_values = shared
            .filters
            .enabled_search_value_ids()
            .copied()
            .collect::<Vec<_>>();

        let filters_changed = before_filters != after_filters;
        let search_values_changed = before_search_values != after_search_values;
        let outcome = match (filters_changed, search_values_changed) {
            (false, false) if changed => PresetApplyOutcome::AppliedNoSync,
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

    /// Sends backend sync commands for changed preset-applied search state.
    pub fn dispatch_sync_commands(
        &self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &FilterRegistry,
        target: SearchSyncTarget,
    ) {
        // Preset apply mutates session state first, then issues the same explicit
        // sync commands used by the rest of the search/filter UI.
        shared
            .sync_search(registry, target)
            .into_iter()
            .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use egui::Color32;
    use processor::search::filter::SearchFilter;
    use stypes::{FileFormat, ObserveOrigin};
    use tokio::{runtime::Runtime, sync::mpsc};
    use uuid::Uuid;

    use crate::{
        host::{
            command::HostCommand,
            common::{colors::ColorPair, parsers::ParserNames},
            ui::{
                UiActions,
                registry::{
                    HostRegistry,
                    filters::{FilterDefinition, FilterRegistry, SearchValueDefinition},
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

    fn drain_commands(cmd_rx: &mut mpsc::Receiver<SessionCommand>) -> Vec<SessionCommand> {
        let mut commands = Vec::new();
        while let Ok(command) = cmd_rx.try_recv() {
            commands.push(command);
        }
        commands
    }

    fn add_preset_with_entries(
        registry: &mut HostRegistry,
        name: &str,
        filters: Vec<PresetFilterEntry>,
        search_values: Vec<PresetSearchValueEntry>,
    ) -> Uuid {
        registry.presets.add_preset(name, filters, search_values)
    }

    fn filter_entry(value: &str, enabled: bool, colors: ColorPair) -> PresetFilterEntry {
        let filter = SearchFilter::plain(value).ignore_case(true);
        PresetFilterEntry::new(filter, enabled, colors)
    }

    fn search_value_entry(value: &str, enabled: bool, color: Color32) -> PresetSearchValueEntry {
        let filter = SearchFilter::plain(value).regex(true).ignore_case(true);
        PresetSearchValueEntry::new(filter, enabled, color)
    }

    fn filter_colors(fg: u8, bg: u8) -> ColorPair {
        ColorPair::new(Color32::from_gray(fg), Color32::from_gray(bg))
    }

    fn applied_filter_values(shared: &SessionShared, registry: &HostRegistry) -> Vec<String> {
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
            .collect()
    }

    fn applied_search_value_values(shared: &SessionShared, registry: &HostRegistry) -> Vec<String> {
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
            .collect()
    }

    #[test]
    fn apply_preset_overwrites_existing_rows_and_syncs() {
        let runtime = Runtime::new().unwrap();
        let (presets, mut cmd_rx, _) = new_presets();
        let mut shared = new_shared();
        let mut actions = new_actions(&runtime);
        let mut registry = HostRegistry::default();
        let filter_id = add_filter_definition(&mut registry.filters, "error");
        let value_id = add_search_value_definition(&mut registry.filters, "duration=(\\d+)");
        let filter_colors = filter_colors(10, 20);
        let search_value_color = Color32::from_rgb(30, 40, 50);
        let preset_id = add_preset_with_entries(
            &mut registry,
            "test",
            vec![filter_entry("error", true, filter_colors.clone())],
            vec![search_value_entry(
                "duration=(\\d+)",
                true,
                search_value_color,
            )],
        );

        shared.apply_filter_with_state(&mut registry.filters, filter_id, false);
        shared.apply_search_value_with_state(&mut registry.filters, value_id, false);

        let outcome = presets.apply_preset(&mut shared, &mut actions, &mut registry, preset_id);

        assert_eq!(outcome, PresetApplyOutcome::Applied(SearchSyncTarget::Both));
        assert_eq!(shared.filters.filter_entries.len(), 1);
        assert_eq!(shared.filters.search_value_entries.len(), 1);
        assert!(shared.filters.filter_entries[0].enabled);
        assert!(shared.filters.search_value_entries[0].enabled);
        assert_eq!(shared.filters.filter_entries[0].colors, filter_colors);
        assert_eq!(
            shared.filters.search_value_entries[0].color,
            search_value_color
        );
        assert_eq!(registry.filters.filters_map().len(), 1);
        assert_eq!(registry.filters.search_value_map().len(), 1);

        let commands = drain_commands(&mut cmd_rx);
        assert_eq!(commands.len(), 2);
    }

    #[test]
    fn apply_preset_adds_missing_rows_with_preset_state() {
        let runtime = Runtime::new().unwrap();
        let (presets, mut cmd_rx, _) = new_presets();
        let mut shared = new_shared();
        let mut actions = new_actions(&runtime);
        let mut registry = HostRegistry::default();
        let existing_filter_id = add_filter_definition(&mut registry.filters, "existing");
        let existing_value_id =
            add_search_value_definition(&mut registry.filters, "existing=(\\d+)");
        let existing_filter_colors = filter_colors(1, 2);
        let existing_value_color = Color32::from_rgb(1, 2, 3);
        let added_filter_colors = filter_colors(3, 4);
        let added_value_color = Color32::from_rgb(4, 5, 6);
        let preset_id = add_preset_with_entries(
            &mut registry,
            "test",
            vec![filter_entry("error", true, added_filter_colors.clone())],
            vec![search_value_entry(
                "duration=(\\d+)",
                false,
                added_value_color,
            )],
        );

        shared.set_filter_entry_state(
            &mut registry.filters,
            existing_filter_id,
            true,
            existing_filter_colors.clone(),
        );
        shared.set_search_value_entry_state(
            &mut registry.filters,
            existing_value_id,
            true,
            existing_value_color,
        );

        let outcome = presets.apply_preset(&mut shared, &mut actions, &mut registry, preset_id);

        assert_eq!(
            outcome,
            PresetApplyOutcome::Applied(SearchSyncTarget::Filter)
        );
        assert_eq!(
            applied_filter_values(&shared, &registry),
            vec!["existing".to_owned(), "error".to_owned()]
        );
        assert_eq!(
            applied_search_value_values(&shared, &registry),
            vec!["existing=(\\d+)".to_owned(), "duration=(\\d+)".to_owned()]
        );
        assert_eq!(
            shared.filters.filter_entries[0].colors,
            existing_filter_colors
        );
        assert_eq!(
            shared.filters.search_value_entries[0].color,
            existing_value_color
        );
        assert_eq!(shared.filters.filter_entries[1].colors, added_filter_colors);
        assert!(!shared.filters.search_value_entries[1].enabled);
        assert_eq!(
            shared.filters.search_value_entries[1].color,
            added_value_color
        );

        let commands = drain_commands(&mut cmd_rx);
        assert_eq!(commands.len(), 1);
        match &commands[0] {
            SessionCommand::ApplySearchFilter { filters, .. } => {
                assert_eq!(filters.len(), 2);
                assert_eq!(filters[0].value, "existing");
                assert_eq!(filters[1].value, "error");
            }
            other => panic!("expected ApplySearchFilter command, got {other:?}"),
        }
    }

    #[test]
    fn apply_preset_adds_disabled_rows_without_sync() {
        let runtime = Runtime::new().unwrap();
        let (presets, mut cmd_rx, _) = new_presets();
        let mut shared = new_shared();
        let mut actions = new_actions(&runtime);
        let mut registry = HostRegistry::default();
        let filter_colors = filter_colors(10, 20);
        let search_value_color = Color32::from_rgb(30, 40, 50);
        let preset_id = add_preset_with_entries(
            &mut registry,
            "test",
            vec![filter_entry("error", false, filter_colors.clone())],
            vec![search_value_entry(
                "duration=(\\d+)",
                false,
                search_value_color,
            )],
        );

        let revision = shared.recent_revision();

        let outcome = presets.apply_preset(&mut shared, &mut actions, &mut registry, preset_id);

        assert_eq!(outcome, PresetApplyOutcome::AppliedNoSync);
        assert!(shared.recent_revision() > revision);
        assert_eq!(shared.filters.filter_entries.len(), 1);
        assert_eq!(shared.filters.search_value_entries.len(), 1);
        assert!(!shared.filters.filter_entries[0].enabled);
        assert!(!shared.filters.search_value_entries[0].enabled);
        assert_eq!(shared.filters.filter_entries[0].colors, filter_colors);
        assert_eq!(
            shared.filters.search_value_entries[0].color,
            search_value_color
        );
        assert!(drain_commands(&mut cmd_rx).is_empty());
    }

    #[test]
    fn apply_preset_color_only_changes_do_not_sync() {
        let runtime = Runtime::new().unwrap();
        let (presets, mut cmd_rx, _) = new_presets();
        let mut shared = new_shared();
        let mut actions = new_actions(&runtime);
        let mut registry = HostRegistry::default();
        let filter_id = add_filter_definition(&mut registry.filters, "error");
        let value_id = add_search_value_definition(&mut registry.filters, "duration=(\\d+)");
        let filter_colors = filter_colors(70, 80);
        let search_value_color = Color32::from_rgb(90, 100, 110);
        let preset_id = add_preset_with_entries(
            &mut registry,
            "test",
            vec![filter_entry("error", true, filter_colors.clone())],
            vec![search_value_entry(
                "duration=(\\d+)",
                true,
                search_value_color,
            )],
        );

        shared.apply_filter(&mut registry.filters, filter_id);
        shared.apply_search_value(&mut registry.filters, value_id);
        let revision = shared.recent_revision();

        let outcome = presets.apply_preset(&mut shared, &mut actions, &mut registry, preset_id);

        assert_eq!(outcome, PresetApplyOutcome::AppliedNoSync);
        assert!(shared.recent_revision() > revision);
        assert!(shared.filters.filter_entries[0].enabled);
        assert!(shared.filters.search_value_entries[0].enabled);
        assert_eq!(shared.filters.filter_entries[0].colors, filter_colors);
        assert_eq!(
            shared.filters.search_value_entries[0].color,
            search_value_color
        );
        assert!(drain_commands(&mut cmd_rx).is_empty());
    }

    #[test]
    fn apply_preset_returns_no_changes_for_identical_state() {
        let runtime = Runtime::new().unwrap();
        let (presets, mut cmd_rx, _) = new_presets();
        let mut shared = new_shared();
        let mut actions = new_actions(&runtime);
        let mut registry = HostRegistry::default();
        let filter_id = add_filter_definition(&mut registry.filters, "error");
        let value_id = add_search_value_definition(&mut registry.filters, "duration=(\\d+)");
        let filter_colors = filter_colors(10, 20);
        let search_value_color = Color32::from_rgb(30, 40, 50);
        let preset_id = add_preset_with_entries(
            &mut registry,
            "test",
            vec![filter_entry("error", true, filter_colors.clone())],
            vec![search_value_entry(
                "duration=(\\d+)",
                true,
                search_value_color,
            )],
        );

        shared.set_filter_entry_state(&mut registry.filters, filter_id, true, filter_colors);
        shared.set_search_value_entry_state(
            &mut registry.filters,
            value_id,
            true,
            search_value_color,
        );
        let revision = shared.recent_revision();

        let outcome = presets.apply_preset(&mut shared, &mut actions, &mut registry, preset_id);

        assert_eq!(outcome, PresetApplyOutcome::NoChanges);
        assert_eq!(shared.recent_revision(), revision);
        assert!(drain_commands(&mut cmd_rx).is_empty());
    }

    #[test]
    fn apply_preset_duplicates_keep_first_position_and_last_state() {
        let runtime = Runtime::new().unwrap();
        let (presets, mut cmd_rx, _) = new_presets();
        let mut shared = new_shared();
        let mut actions = new_actions(&runtime);
        let mut registry = HostRegistry::default();
        let first_colors = filter_colors(1, 2);
        let last_colors = filter_colors(3, 4);
        let other_colors = filter_colors(5, 6);
        let first_value_color = Color32::from_rgb(1, 2, 3);
        let last_value_color = Color32::from_rgb(4, 5, 6);
        let other_value_color = Color32::from_rgb(7, 8, 9);
        let preset_id = add_preset_with_entries(
            &mut registry,
            "test",
            vec![
                filter_entry("dup", true, first_colors),
                filter_entry("other", false, other_colors.clone()),
                filter_entry("dup", false, last_colors.clone()),
            ],
            vec![
                search_value_entry("dup=(\\d+)", true, first_value_color),
                search_value_entry("other=(\\d+)", false, other_value_color),
                search_value_entry("dup=(\\d+)", false, last_value_color),
            ],
        );

        let outcome = presets.apply_preset(&mut shared, &mut actions, &mut registry, preset_id);

        assert_eq!(outcome, PresetApplyOutcome::AppliedNoSync);
        assert_eq!(
            applied_filter_values(&shared, &registry),
            vec!["dup".to_owned(), "other".to_owned()]
        );
        assert_eq!(
            applied_search_value_values(&shared, &registry),
            vec!["dup=(\\d+)".to_owned(), "other=(\\d+)".to_owned()]
        );
        assert!(!shared.filters.filter_entries[0].enabled);
        assert_eq!(shared.filters.filter_entries[0].colors, last_colors);
        assert!(!shared.filters.filter_entries[1].enabled);
        assert_eq!(shared.filters.filter_entries[1].colors, other_colors);
        assert!(!shared.filters.search_value_entries[0].enabled);
        assert_eq!(
            shared.filters.search_value_entries[0].color,
            last_value_color
        );
        assert!(!shared.filters.search_value_entries[1].enabled);
        assert_eq!(
            shared.filters.search_value_entries[1].color,
            other_value_color
        );
        assert_eq!(registry.filters.filters_map().len(), 2);
        assert_eq!(registry.filters.search_value_map().len(), 2);
        assert!(drain_commands(&mut cmd_rx).is_empty());
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
}
