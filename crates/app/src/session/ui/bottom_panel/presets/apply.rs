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

        // Materialize preset filters and charts through the normal registry/session path.
        // Existing applied rows, including disabled ones, are left as-is because
        // dedupe reuses their ids and the applied check skips re-applying them.
        let mut changed_filters = false;
        for entry in filters {
            let PresetFilterEntry {
                filter,
                enabled: _enabled,
                colors: _colors,
            } = entry;
            let filter_id = registry.filters.add_filter(FilterDefinition::new(filter));
            if shared.filters.is_filter_applied(&filter_id) {
                continue;
            }

            shared.apply_filter(&mut registry.filters, filter_id);
            changed_filters = true;
        }

        let mut changed_search_values = false;
        for entry in search_values {
            let PresetSearchValueEntry {
                filter,
                enabled: _enabled,
                color: _color,
            } = entry;
            let value_id = registry
                .filters
                .add_search_value(SearchValueDefinition::new(filter));
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

    fn drain_commands(cmd_rx: &mut mpsc::Receiver<SessionCommand>) -> Vec<SessionCommand> {
        let mut commands = Vec::new();
        while let Ok(command) = cmd_rx.try_recv() {
            commands.push(command);
        }
        commands
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
        let preset_filter = registry
            .filters
            .get_filter(&filter_id)
            .unwrap()
            .filter
            .clone();
        let preset_search_value = registry
            .filters
            .get_search_value(&value_id)
            .unwrap()
            .filter
            .clone();
        let preset_id = add_preset_with_default_state(
            &mut registry,
            "test",
            vec![preset_filter.clone(), preset_filter],
            vec![preset_search_value.clone(), preset_search_value],
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
        let preset_id = add_preset_with_default_state(
            &mut registry,
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
}
