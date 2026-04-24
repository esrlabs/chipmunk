use std::borrow::Cow;

use crate::{host::ui::registry::filters::FilterRegistry, session::ui::SessionShared};
use processor::search::filter::SearchFilter;

use uuid::Uuid;

/// Host-level registry for named preset snapshots captured from session filters and charts.
#[derive(Debug, Default, Clone)]
pub struct PresetRegistry {
    presets: Vec<Preset>,
    /// Monotonic catalog revision used by UI caches keyed on preset structure.
    definitions_revision: u64,
}

/// Preset definition with copied semantic content.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Preset {
    pub id: Uuid,
    pub name: String,
    pub filters: Vec<SearchFilter>,
    pub search_values: Vec<SearchFilter>,
}

/// Result of applying a preset edit request.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PresetUpdateOutcome {
    NotFound,
    Unchanged,
    Updated {
        /// Final stored name after uniqueness normalization.
        name: String,
    },
}

/// Result of importing a batch of presets into the registry.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct PresetImportSummary {
    pub renamed_items: usize,
}

impl PresetRegistry {
    pub fn presets(&self) -> &[Preset] {
        &self.presets
    }

    /// Monotonic catalog revision used by UI caches keyed on preset structure.
    pub fn definitions_revision(&self) -> u64 {
        self.definitions_revision
    }

    fn unique_preset_name<'a>(&self, base_name: &'a str, skip_id: Option<Uuid>) -> Cow<'a, str> {
        if !self
            .presets
            .iter()
            .any(|preset| Some(preset.id) != skip_id && preset.name == base_name)
        {
            return Cow::Borrowed(base_name);
        }

        let mut suffix = 2;
        loop {
            let candidate = format!("{base_name}_{suffix}");
            if !self
                .presets
                .iter()
                .any(|preset| Some(preset.id) != skip_id && preset.name == candidate)
            {
                return Cow::Owned(candidate);
            }
            suffix += 1;
        }
    }

    pub fn get(&self, id: &Uuid) -> Option<&Preset> {
        self.presets.iter().find(|preset| preset.id == *id)
    }

    pub fn add_preset(
        &mut self,
        name: impl Into<String>,
        filters: Vec<SearchFilter>,
        search_values: Vec<SearchFilter>,
    ) -> Uuid {
        let name = name.into();
        let name = self.unique_preset_name(&name, None).into_owned();
        let preset = Preset {
            id: Uuid::new_v4(),
            name,
            filters,
            search_values,
        };
        let id = preset.id;
        self.presets.push(preset);
        self.definitions_revision += 1;
        id
    }

    fn import_preset(&mut self, mut preset: Preset) -> bool {
        debug_assert!(
            self.presets.iter().all(|existing| existing.id != preset.id),
            "Imported preset ids should be unique across the registry"
        );

        let stored_name = self.unique_preset_name(&preset.name, Some(preset.id));
        let was_renamed = preset.name != stored_name.as_ref();
        preset.name = stored_name.into_owned();

        self.presets.push(preset);
        self.definitions_revision += 1;

        was_renamed
    }

    /// Imports presets and reports how many were renamed for uniqueness.
    pub fn import_presets(&mut self, presets: Vec<Preset>) -> PresetImportSummary {
        let renamed_items = presets
            .into_iter()
            .map(|preset| usize::from(self.import_preset(preset)))
            .sum::<usize>();

        PresetImportSummary { renamed_items }
    }

    pub fn add_preset_from_session(
        &mut self,
        shared: &SessionShared,
        registry: &FilterRegistry,
    ) -> Uuid {
        let filters = shared
            .filters
            .filter_entries
            .iter()
            .filter_map(|item| registry.get_filter(&item.id))
            .map(|def| def.filter.clone())
            .collect();
        let search_values = shared
            .filters
            .search_value_entries
            .iter()
            .filter_map(|item| registry.get_search_value(&item.id))
            .map(|def| def.filter.clone())
            .collect();

        self.add_preset(shared.get_info().title.clone(), filters, search_values)
    }

    pub fn update_preset(
        &mut self,
        id: Uuid,
        requested_name: impl Into<String>,
        filters: Vec<SearchFilter>,
        search_values: Vec<SearchFilter>,
    ) -> PresetUpdateOutcome {
        let requested_name = requested_name.into();
        let Some(index) = self.presets.iter().position(|preset| preset.id == id) else {
            return PresetUpdateOutcome::NotFound;
        };

        let next_name = self.unique_preset_name(&requested_name, Some(id));
        let preset = &mut self.presets[index];
        if preset.name == next_name.as_ref()
            && preset.filters == filters
            && preset.search_values == search_values
        {
            return PresetUpdateOutcome::Unchanged;
        }

        let next_name = next_name.into_owned();
        preset.name = next_name.clone();
        preset.filters = filters;
        preset.search_values = search_values;
        self.definitions_revision += 1;

        PresetUpdateOutcome::Updated { name: next_name }
    }

    pub fn remove_preset(&mut self, id: Uuid) -> bool {
        let Some(index) = self.presets.iter().position(|preset| preset.id == id) else {
            return false;
        };

        self.presets.remove(index);
        self.definitions_revision += 1;
        true
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use stypes::{FileFormat, ObserveOrigin};

    use crate::{
        host::{
            common::parsers::ParserNames,
            ui::registry::filters::{FilterDefinition, RegistryEditOutcome, SearchValueDefinition},
        },
        session::{
            types::ObserveOperation,
            ui::{SessionInfo, definitions::schema},
        },
    };

    use super::*;

    fn plain(value: &str) -> SearchFilter {
        SearchFilter::plain(value).ignore_case(true)
    }

    fn regex(value: &str) -> SearchFilter {
        SearchFilter::plain(value).regex(true).ignore_case(true)
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
    fn defaults_empty() {
        let registry = PresetRegistry::default();

        assert!(registry.presets().is_empty());
        assert_eq!(registry.definitions_revision(), 0);
    }

    #[test]
    fn add_keeps_order() {
        let mut registry = PresetRegistry::default();
        let first_id = registry.add_preset("First", vec![plain("one")], vec![]);
        let second_id = registry.add_preset("Second", vec![plain("two")], vec![]);

        assert_eq!(registry.presets()[0].id, first_id);
        assert_eq!(registry.presets()[1].id, second_id);
        assert_eq!(registry.definitions_revision(), 2);
    }

    #[test]
    fn keeps_filter_duplicates() {
        let mut registry = PresetRegistry::default();
        let preset_id = registry.add_preset(
            "Errors",
            vec![plain("error"), plain("warn"), plain("error"), plain("warn")],
            vec![],
        );

        assert_eq!(
            registry.get(&preset_id).unwrap().filters,
            vec![plain("error"), plain("warn"), plain("error"), plain("warn")]
        );
    }

    #[test]
    fn keeps_search_value_duplicates() {
        let mut registry = PresetRegistry::default();
        let preset_id = registry.add_preset(
            "Durations",
            vec![],
            vec![
                regex("duration=(\\d+)"),
                regex("latency=(\\d+)"),
                regex("duration=(\\d+)"),
            ],
        );

        assert_eq!(
            registry.get(&preset_id).unwrap().search_values,
            vec![
                regex("duration=(\\d+)"),
                regex("latency=(\\d+)"),
                regex("duration=(\\d+)")
            ]
        );
    }

    #[test]
    fn duplicates_stay_per_list() {
        let mut registry = PresetRegistry::default();
        let preset_id = registry.add_preset(
            "Shared Value",
            vec![plain("error"), plain("error")],
            vec![plain("error"), plain("error")],
        );
        let preset = registry.get(&preset_id).unwrap();

        assert_eq!(preset.filters, vec![plain("error"), plain("error")]);
        assert_eq!(preset.search_values, vec![plain("error"), plain("error")]);
    }

    #[test]
    fn identical_presets_both_store() {
        let mut registry = PresetRegistry::default();
        let first_id = registry.add_preset(
            "Errors",
            vec![plain("error")],
            vec![regex("duration=(\\d+)")],
        );
        let second_id = registry.add_preset(
            "Errors",
            vec![plain("error")],
            vec![regex("duration=(\\d+)")],
        );

        assert_ne!(first_id, second_id);
        assert_eq!(registry.presets().len(), 2);
    }

    #[test]
    fn keeps_base_name_free() {
        let mut registry = PresetRegistry::default();
        registry.add_preset("Errors_2", vec![plain("error")], vec![]);

        let preset_id = registry.add_preset("Errors", vec![plain("warn")], vec![]);

        assert_eq!(registry.get(&preset_id).unwrap().name, "Errors");
    }

    #[test]
    fn appends_second_suffix() {
        let mut registry = PresetRegistry::default();
        registry.add_preset("Errors", vec![plain("error")], vec![]);

        let preset_id = registry.add_preset("Errors", vec![plain("warn")], vec![]);

        assert_eq!(registry.get(&preset_id).unwrap().name, "Errors_2");
    }

    #[test]
    fn import_keeps_provided_id() {
        let mut registry = PresetRegistry::default();
        let preset = Preset {
            id: Uuid::new_v4(),
            name: "Imported".to_owned(),
            filters: vec![plain("error")],
            search_values: vec![],
        };
        let imported_id = preset.id;

        let was_renamed = registry.import_preset(preset);

        assert_eq!(registry.presets()[0].id, imported_id);
        assert!(!was_renamed);
    }

    #[test]
    fn import_renames_colliding_name() {
        let mut registry = PresetRegistry::default();
        registry.add_preset("Errors", vec![plain("warn")], vec![]);

        let imported_id = Uuid::new_v4();
        let was_renamed = registry.import_preset(Preset {
            id: imported_id,
            name: "Errors".to_owned(),
            filters: vec![plain("error")],
            search_values: vec![],
        });

        assert!(was_renamed);
        assert_eq!(registry.get(&imported_id).unwrap().name, "Errors_2");
    }

    #[test]
    fn import_batch_preserves_order() {
        let mut registry = PresetRegistry::default();
        let presets = vec![
            Preset {
                id: Uuid::new_v4(),
                name: "Same".to_owned(),
                filters: vec![plain("one")],
                search_values: vec![],
            },
            Preset {
                id: Uuid::new_v4(),
                name: "Same".to_owned(),
                filters: vec![plain("two")],
                search_values: vec![],
            },
            Preset {
                id: Uuid::new_v4(),
                name: "Third".to_owned(),
                filters: vec![plain("three")],
                search_values: vec![],
            },
        ];

        let summary = registry.import_presets(presets);

        assert_eq!(summary.renamed_items, 1);
        assert_eq!(registry.presets()[0].name, "Same");
        assert_eq!(registry.presets()[1].name, "Same_2");
        assert_eq!(registry.presets()[2].name, "Third");
    }

    #[test]
    fn import_advances_revision_per_preset() {
        let mut registry = PresetRegistry::default();

        registry.import_presets(vec![
            Preset {
                id: Uuid::new_v4(),
                name: "First".to_owned(),
                filters: vec![plain("one")],
                search_values: vec![],
            },
            Preset {
                id: Uuid::new_v4(),
                name: "Second".to_owned(),
                filters: vec![plain("two")],
                search_values: vec![],
            },
        ]);

        assert_eq!(registry.definitions_revision(), 2);
    }

    #[test]
    fn skips_taken_suffixes() {
        let mut registry = PresetRegistry::default();
        registry.add_preset("Errors", vec![plain("error")], vec![]);
        registry.add_preset("Errors_2", vec![plain("warn")], vec![]);

        let preset_id = registry.add_preset("Errors", vec![plain("info")], vec![]);

        assert_eq!(registry.get(&preset_id).unwrap().name, "Errors_3");
    }

    #[test]
    fn remove_preset_keeps_other_order() {
        let mut registry = PresetRegistry::default();
        let first_id = registry.add_preset("First", vec![plain("one")], vec![]);
        let second_id = registry.add_preset("Second", vec![plain("two")], vec![]);
        let third_id = registry.add_preset("Third", vec![plain("three")], vec![]);

        assert!(registry.remove_preset(second_id));

        assert_eq!(
            registry
                .presets()
                .iter()
                .map(|preset| preset.id)
                .collect::<Vec<_>>(),
            vec![first_id, third_id]
        );
    }

    #[test]
    fn filter_snapshot_is_not_link() {
        let shared = new_shared();
        let session_id = shared.get_id();
        let mut filters_registry = FilterRegistry::default();
        let mut preset_registry = PresetRegistry::default();
        let filter_id = add_filter_definition(&mut filters_registry, "error");

        filters_registry.apply_filter_to_session(filter_id, session_id);
        let preset_id = preset_registry.add_preset(
            "Errors",
            vec![
                filters_registry
                    .get_filter(&filter_id)
                    .unwrap()
                    .filter
                    .clone(),
            ],
            vec![],
        );

        let outcome = filters_registry.edit_filter_for_session(
            filter_id,
            session_id,
            SearchFilter::plain("warn").ignore_case(true),
        );

        assert_eq!(outcome, RegistryEditOutcome::EditedInPlace);
        assert_eq!(
            filters_registry.get_filter(&filter_id).unwrap().filter,
            plain("warn")
        );
        assert_eq!(
            preset_registry.get(&preset_id).unwrap().filters,
            vec![plain("error")]
        );
    }

    #[test]
    fn search_value_snapshot_is_not_link() {
        let shared = new_shared();
        let session_id = shared.get_id();
        let mut filters_registry = FilterRegistry::default();
        let mut preset_registry = PresetRegistry::default();
        let value_id = add_search_value_definition(&mut filters_registry, "duration=(\\d+)");

        filters_registry.apply_search_value_to_session(value_id, session_id);
        let preset_id = preset_registry.add_preset(
            "Durations",
            vec![],
            vec![
                filters_registry
                    .get_search_value(&value_id)
                    .unwrap()
                    .filter
                    .clone(),
            ],
        );

        let outcome = filters_registry.edit_search_value_for_session(
            value_id,
            session_id,
            SearchFilter::plain("latency=(\\d+)")
                .regex(true)
                .ignore_case(true),
        );

        assert_eq!(outcome, RegistryEditOutcome::EditedInPlace);
        assert_eq!(
            filters_registry.get_search_value(&value_id).unwrap().filter,
            regex("latency=(\\d+)")
        );
        assert_eq!(
            preset_registry.get(&preset_id).unwrap().search_values,
            vec![regex("duration=(\\d+)")]
        );
    }

    #[test]
    fn update_preset_replaces_all_fields() {
        let mut registry = PresetRegistry::default();
        let preset_id = registry.add_preset(
            "Errors",
            vec![plain("error")],
            vec![regex("duration=(\\d+)")],
        );

        let outcome = registry.update_preset(
            preset_id,
            "Warnings",
            vec![plain("warn"), plain("info")],
            vec![regex("latency=(\\d+)")],
        );

        assert_eq!(
            outcome,
            PresetUpdateOutcome::Updated {
                name: "Warnings".to_owned(),
            }
        );
        assert_eq!(
            registry.get(&preset_id).unwrap(),
            &Preset {
                id: preset_id,
                name: "Warnings".to_owned(),
                filters: vec![plain("warn"), plain("info")],
                search_values: vec![regex("latency=(\\d+)")],
            }
        );
        assert_eq!(registry.definitions_revision(), 2);
    }

    #[test]
    fn update_preset_keeps_same_data() {
        let mut registry = PresetRegistry::default();
        let preset_id = registry.add_preset(
            "Errors",
            vec![plain("error")],
            vec![regex("duration=(\\d+)")],
        );

        let outcome = registry.update_preset(
            preset_id,
            "Errors",
            vec![plain("error")],
            vec![regex("duration=(\\d+)")],
        );

        assert_eq!(outcome, PresetUpdateOutcome::Unchanged);
        assert_eq!(registry.get(&preset_id).unwrap().name, "Errors");
        assert_eq!(registry.definitions_revision(), 1);
    }

    #[test]
    fn update_preset_uses_unique_name() {
        let mut registry = PresetRegistry::default();
        let first_id = registry.add_preset("First", vec![plain("one")], vec![]);
        registry.add_preset("Taken", vec![plain("two")], vec![]);
        registry.add_preset("Taken_2", vec![plain("three")], vec![]);

        let outcome = registry.update_preset(first_id, "Taken", vec![plain("one")], vec![]);

        assert_eq!(
            outcome,
            PresetUpdateOutcome::Updated {
                name: "Taken_3".to_owned(),
            }
        );
        assert_eq!(registry.get(&first_id).unwrap().name, "Taken_3");
        assert_eq!(registry.definitions_revision(), 4);
    }

    #[test]
    fn update_preset_handles_missing_id() {
        let mut registry = PresetRegistry::default();

        let outcome = registry.update_preset(
            Uuid::new_v4(),
            "Missing",
            vec![plain("one")],
            vec![regex("duration=(\\d+)")],
        );

        assert_eq!(outcome, PresetUpdateOutcome::NotFound);
        assert_eq!(registry.definitions_revision(), 0);
    }

    #[test]
    fn remove_preset_advances_revision() {
        let mut registry = PresetRegistry::default();
        let preset_id = registry.add_preset("Errors", vec![plain("one")], vec![]);

        assert!(registry.remove_preset(preset_id));
        assert_eq!(registry.definitions_revision(), 2);
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

        let preset_id = preset_registry.add_preset_from_session(&shared, &filters_registry);
        let preset = preset_registry.get(&preset_id).unwrap();

        assert_eq!(preset.name, "test");
        assert_eq!(
            preset.filters,
            vec![
                filters_registry
                    .get_filter(&first_filter_id)
                    .unwrap()
                    .filter
                    .clone(),
                filters_registry
                    .get_filter(&second_filter_id)
                    .unwrap()
                    .filter
                    .clone(),
            ]
        );
        assert_eq!(
            preset.search_values,
            vec![
                filters_registry
                    .get_search_value(&first_value_id)
                    .unwrap()
                    .filter
                    .clone(),
                filters_registry
                    .get_search_value(&second_value_id)
                    .unwrap()
                    .filter
                    .clone(),
            ]
        );
    }
}
