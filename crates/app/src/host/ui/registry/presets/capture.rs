//! Session capture for named preset snapshots.

use uuid::Uuid;

use crate::{host::ui::registry::filters::FilterRegistry, session::ui::SessionShared};

use super::{PresetFilterEntry, PresetRegistry, PresetSearchValueEntry};

impl PresetRegistry {
    /// Captures the current session-applied filters and charts as a preset.
    pub fn add_preset_from_session(
        &mut self,
        shared: &SessionShared,
        registry: &FilterRegistry,
    ) -> Uuid {
        let filters = shared
            .filters
            .filter_entries
            .iter()
            .filter_map(|item| {
                registry.get_filter(&item.id).map(|def| {
                    PresetFilterEntry::new(def.filter.clone(), item.enabled, item.colors.clone())
                })
            })
            .collect();
        let search_values = shared
            .filters
            .search_value_entries
            .iter()
            .filter_map(|item| {
                registry.get_search_value(&item.id).map(|def| {
                    PresetSearchValueEntry::new(def.filter.clone(), item.enabled, item.color)
                })
            })
            .collect();

        self.add_preset(shared.get_info().title.clone(), filters, search_values)
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use processor::search::filter::SearchFilter;
    use stypes::{FileFormat, ObserveOrigin};
    use uuid::Uuid;

    use crate::{
        host::{
            common::parsers::ParserNames,
            ui::registry::filters::{FilterDefinition, FilterRegistry, SearchValueDefinition},
        },
        session::{types::ObserveOperation, ui::SessionInfo},
    };

    use super::*;
    use crate::session::ui::definitions::schema::LogSchemaSpec;

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

    #[test]
    fn captures_applied_session_state() {
        let mut shared = new_shared();
        let mut filters_registry = FilterRegistry::default();
        let mut preset_registry = PresetRegistry::default();
        let first_filter_id = add_filter_definition(&mut filters_registry, "error");
        let second_filter_id = add_filter_definition(&mut filters_registry, "warn");
        let first_value_id = add_search_value_definition(&mut filters_registry, "duration=(\\d+)");
        let second_value_id = add_search_value_definition(&mut filters_registry, "latency=(\\d+)");

        shared
            .filters
            .apply_filter(&mut filters_registry, first_filter_id);
        shared
            .filters
            .apply_filter_with_state(&mut filters_registry, second_filter_id, false);
        shared
            .filters
            .apply_search_value(&mut filters_registry, first_value_id);
        shared
            .filters
            .apply_search_value_with_state(&mut filters_registry, second_value_id, false);

        let expected_filter_entries = shared.filters.filter_entries.clone();
        let expected_search_value_entries = shared.filters.search_value_entries.clone();
        let preset_id = preset_registry.add_preset_from_session(&shared, &filters_registry);
        let preset = preset_registry.get(&preset_id).unwrap();

        assert_eq!(preset.name, "test");
        let first_filter = filters_registry
            .get_filter(&first_filter_id)
            .unwrap()
            .filter
            .clone();
        let second_filter = filters_registry
            .get_filter(&second_filter_id)
            .unwrap()
            .filter
            .clone();
        let expected_filters = vec![
            PresetFilterEntry::new(
                first_filter,
                expected_filter_entries[0].enabled,
                expected_filter_entries[0].colors.clone(),
            ),
            PresetFilterEntry::new(
                second_filter,
                expected_filter_entries[1].enabled,
                expected_filter_entries[1].colors.clone(),
            ),
        ];
        assert_eq!(preset.filters, expected_filters);

        let first_search_value = filters_registry
            .get_search_value(&first_value_id)
            .unwrap()
            .filter
            .clone();
        let second_search_value = filters_registry
            .get_search_value(&second_value_id)
            .unwrap()
            .filter
            .clone();
        let expected_search_values = vec![
            PresetSearchValueEntry::new(
                first_search_value,
                expected_search_value_entries[0].enabled,
                expected_search_value_entries[0].color,
            ),
            PresetSearchValueEntry::new(
                second_search_value,
                expected_search_value_entries[1].enabled,
                expected_search_value_entries[1].color,
            ),
        ];
        assert_eq!(preset.search_values, expected_search_values);
    }
}
