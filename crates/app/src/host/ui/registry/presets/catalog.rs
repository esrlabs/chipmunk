//! Preset catalog storage and mutation behavior.

use std::borrow::Cow;

use uuid::Uuid;

use super::{Preset, PresetFilterEntry, PresetSearchValueEntry};

/// Host-level registry for named preset snapshots captured from session filters and charts.
#[derive(Debug, Default, Clone)]
pub struct PresetRegistry {
    presets: Vec<Preset>,
    /// Monotonic catalog revision used by UI caches keyed on preset structure.
    definitions_revision: u64,
}

/// Result of applying a preset edit request.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PresetUpdateOutcome {
    /// No preset exists for the requested id.
    NotFound,
    /// The requested edit matched the stored preset.
    Unchanged,
    /// The preset was updated.
    Updated {
        /// Final stored name after uniqueness normalization.
        name: String,
    },
}

/// Result of importing a batch of presets into the registry.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct PresetImportSummary {
    /// Number of imported presets renamed to avoid collisions.
    pub renamed_items: usize,
}

impl PresetRegistry {
    /// Returns stored presets in display order.
    pub fn presets(&self) -> &[Preset] {
        &self.presets
    }

    /// Monotonic catalog revision used by UI caches keyed on preset structure.
    pub fn definitions_revision(&self) -> u64 {
        self.definitions_revision
    }

    fn unique_preset_name<'a>(&self, base_name: &'a str, skip_id: Option<Uuid>) -> Cow<'a, str> {
        if !self.presets.iter().any(|preset| {
            let Preset {
                id,
                name,
                filters: _,
                search_values: _,
            } = preset;
            Some(*id) != skip_id && name == base_name
        }) {
            return Cow::Borrowed(base_name);
        }

        let mut suffix = 2;
        loop {
            let candidate = format!("{base_name}_{suffix}");
            if !self.presets.iter().any(|preset| {
                let Preset {
                    id,
                    name,
                    filters: _,
                    search_values: _,
                } = preset;
                Some(*id) != skip_id && name == &candidate
            }) {
                return Cow::Owned(candidate);
            }
            suffix += 1;
        }
    }

    /// Returns a preset by id.
    pub fn get(&self, id: &Uuid) -> Option<&Preset> {
        self.presets.iter().find(|preset| preset.id == *id)
    }

    /// Adds a new preset and returns its generated id.
    pub fn add_preset(
        &mut self,
        name: impl Into<String>,
        filters: Vec<PresetFilterEntry>,
        search_values: Vec<PresetSearchValueEntry>,
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

    /// Updates an existing preset with the provided row snapshots.
    pub fn update_preset(
        &mut self,
        id: Uuid,
        requested_name: impl Into<String>,
        filters: Vec<PresetFilterEntry>,
        search_values: Vec<PresetSearchValueEntry>,
    ) -> PresetUpdateOutcome {
        let requested_name = requested_name.into();
        let Some(index) = self.presets.iter().position(|preset| preset.id == id) else {
            return PresetUpdateOutcome::NotFound;
        };

        let next_name = self.unique_preset_name(&requested_name, Some(id));
        let preset = &self.presets[index];
        let Preset {
            id: _,
            name,
            filters: stored_filters,
            search_values: stored_search_values,
        } = preset;
        if name == next_name.as_ref()
            && stored_filters == &filters
            && stored_search_values == &search_values
        {
            return PresetUpdateOutcome::Unchanged;
        }

        let next_name = next_name.into_owned();
        let preset = &mut self.presets[index];
        preset.name = next_name.clone();
        preset.filters = filters;
        preset.search_values = search_values;
        self.definitions_revision += 1;

        PresetUpdateOutcome::Updated { name: next_name }
    }

    /// Removes a preset by id and reports whether anything was removed.
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

    use processor::search::filter::SearchFilter;
    use stypes::{FileFormat, ObserveOrigin};
    use uuid::Uuid;

    use crate::{
        host::{
            common::parsers::ParserNames,
            ui::registry::filters::{
                FilterDefinition, FilterRegistry, RegistryEditOutcome, SearchValueDefinition,
            },
        },
        session::ui::SessionShared,
        session::{types::ObserveOperation, ui::SessionInfo},
    };

    use super::*;
    use crate::session::ui::definitions::schema::LogSchemaSpec;

    fn plain(value: &str) -> SearchFilter {
        SearchFilter::plain(value).ignore_case(true)
    }

    fn regex(value: &str) -> SearchFilter {
        SearchFilter::plain(value).regex(true).ignore_case(true)
    }

    fn runtime_preset(
        id: Uuid,
        name: &str,
        filters: Vec<SearchFilter>,
        search_values: Vec<SearchFilter>,
    ) -> Preset {
        Preset::with_default_state(id, name.to_owned(), filters, search_values)
    }

    fn add_preset_with_default_state(
        registry: &mut PresetRegistry,
        name: &str,
        filters: Vec<SearchFilter>,
        search_values: Vec<SearchFilter>,
    ) -> Uuid {
        registry.add_preset(
            name,
            filter_entries(filters),
            search_value_entries(search_values),
        )
    }

    fn filter_entries(filters: Vec<SearchFilter>) -> Vec<PresetFilterEntry> {
        Preset::with_default_state(Uuid::new_v4(), "preset".to_owned(), filters, vec![]).filters
    }

    fn search_value_entries(search_values: Vec<SearchFilter>) -> Vec<PresetSearchValueEntry> {
        Preset::with_default_state(Uuid::new_v4(), "preset".to_owned(), vec![], search_values)
            .search_values
    }

    fn filter_definitions(preset: &Preset) -> Vec<SearchFilter> {
        preset
            .filters
            .iter()
            .map(|entry| entry.filter.clone())
            .collect()
    }

    fn search_value_definitions(preset: &Preset) -> Vec<SearchFilter> {
        preset
            .search_values
            .iter()
            .map(|entry| entry.filter.clone())
            .collect()
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
        let first_id =
            add_preset_with_default_state(&mut registry, "First", vec![plain("one")], vec![]);
        let second_id =
            add_preset_with_default_state(&mut registry, "Second", vec![plain("two")], vec![]);

        assert_eq!(registry.presets()[0].id, first_id);
        assert_eq!(registry.presets()[1].id, second_id);
        assert_eq!(registry.definitions_revision(), 2);
    }

    #[test]
    fn keeps_filter_duplicates() {
        let mut registry = PresetRegistry::default();
        let preset_id = add_preset_with_default_state(
            &mut registry,
            "Errors",
            vec![plain("error"), plain("warn"), plain("error"), plain("warn")],
            vec![],
        );

        assert_eq!(
            filter_definitions(registry.get(&preset_id).unwrap()),
            vec![plain("error"), plain("warn"), plain("error"), plain("warn")]
        );
    }

    #[test]
    fn keeps_search_value_duplicates() {
        let mut registry = PresetRegistry::default();
        let preset_id = add_preset_with_default_state(
            &mut registry,
            "Durations",
            vec![],
            vec![
                regex("duration=(\\d+)"),
                regex("latency=(\\d+)"),
                regex("duration=(\\d+)"),
            ],
        );

        assert_eq!(
            search_value_definitions(registry.get(&preset_id).unwrap()),
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
        let preset_id = add_preset_with_default_state(
            &mut registry,
            "Shared Value",
            vec![plain("error"), plain("error")],
            vec![plain("error"), plain("error")],
        );
        let preset = registry.get(&preset_id).unwrap();

        assert_eq!(
            filter_definitions(preset),
            vec![plain("error"), plain("error")]
        );
        assert_eq!(
            search_value_definitions(preset),
            vec![plain("error"), plain("error")]
        );
    }

    #[test]
    fn identical_presets_both_store() {
        let mut registry = PresetRegistry::default();
        let first_id = add_preset_with_default_state(
            &mut registry,
            "Errors",
            vec![plain("error")],
            vec![regex("duration=(\\d+)")],
        );
        let second_id = add_preset_with_default_state(
            &mut registry,
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
        add_preset_with_default_state(&mut registry, "Errors_2", vec![plain("error")], vec![]);

        let preset_id =
            add_preset_with_default_state(&mut registry, "Errors", vec![plain("warn")], vec![]);

        assert_eq!(registry.get(&preset_id).unwrap().name, "Errors");
    }

    #[test]
    fn appends_second_suffix() {
        let mut registry = PresetRegistry::default();
        add_preset_with_default_state(&mut registry, "Errors", vec![plain("error")], vec![]);

        let preset_id =
            add_preset_with_default_state(&mut registry, "Errors", vec![plain("warn")], vec![]);

        assert_eq!(registry.get(&preset_id).unwrap().name, "Errors_2");
    }

    #[test]
    fn import_keeps_provided_id() {
        let mut registry = PresetRegistry::default();
        let preset = runtime_preset(Uuid::new_v4(), "Imported", vec![plain("error")], vec![]);
        let imported_id = preset.id;

        let was_renamed = registry.import_preset(preset);

        assert_eq!(registry.presets()[0].id, imported_id);
        assert!(!was_renamed);
    }

    #[test]
    fn import_renames_colliding_name() {
        let mut registry = PresetRegistry::default();
        add_preset_with_default_state(&mut registry, "Errors", vec![plain("warn")], vec![]);

        let imported_id = Uuid::new_v4();
        let was_renamed = registry.import_preset(runtime_preset(
            imported_id,
            "Errors",
            vec![plain("error")],
            vec![],
        ));

        assert!(was_renamed);
        assert_eq!(registry.get(&imported_id).unwrap().name, "Errors_2");
    }

    #[test]
    fn import_batch_preserves_order() {
        let mut registry = PresetRegistry::default();
        let presets = vec![
            runtime_preset(Uuid::new_v4(), "Same", vec![plain("one")], vec![]),
            runtime_preset(Uuid::new_v4(), "Same", vec![plain("two")], vec![]),
            runtime_preset(Uuid::new_v4(), "Third", vec![plain("three")], vec![]),
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
            runtime_preset(Uuid::new_v4(), "First", vec![plain("one")], vec![]),
            runtime_preset(Uuid::new_v4(), "Second", vec![plain("two")], vec![]),
        ]);

        assert_eq!(registry.definitions_revision(), 2);
    }

    #[test]
    fn skips_taken_suffixes() {
        let mut registry = PresetRegistry::default();
        add_preset_with_default_state(&mut registry, "Errors", vec![plain("error")], vec![]);
        add_preset_with_default_state(&mut registry, "Errors_2", vec![plain("warn")], vec![]);

        let preset_id =
            add_preset_with_default_state(&mut registry, "Errors", vec![plain("info")], vec![]);

        assert_eq!(registry.get(&preset_id).unwrap().name, "Errors_3");
    }

    #[test]
    fn remove_preset_keeps_other_order() {
        let mut registry = PresetRegistry::default();
        let first_id =
            add_preset_with_default_state(&mut registry, "First", vec![plain("one")], vec![]);
        let second_id =
            add_preset_with_default_state(&mut registry, "Second", vec![plain("two")], vec![]);
        let third_id =
            add_preset_with_default_state(&mut registry, "Third", vec![plain("three")], vec![]);

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
        let preset_id = add_preset_with_default_state(
            &mut preset_registry,
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
            filter_definitions(preset_registry.get(&preset_id).unwrap()),
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
        let preset_id = add_preset_with_default_state(
            &mut preset_registry,
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
            search_value_definitions(preset_registry.get(&preset_id).unwrap()),
            vec![regex("duration=(\\d+)")]
        );
    }

    #[test]
    fn update_preset_replaces_all_fields() {
        let mut registry = PresetRegistry::default();
        let preset_id = add_preset_with_default_state(
            &mut registry,
            "Errors",
            vec![plain("error")],
            vec![regex("duration=(\\d+)")],
        );

        let outcome = registry.update_preset(
            preset_id,
            "Warnings",
            filter_entries(vec![plain("warn"), plain("info")]),
            search_value_entries(vec![regex("latency=(\\d+)")]),
        );

        assert_eq!(
            outcome,
            PresetUpdateOutcome::Updated {
                name: "Warnings".to_owned(),
            }
        );
        assert_eq!(
            registry.get(&preset_id).unwrap(),
            &runtime_preset(
                preset_id,
                "Warnings",
                vec![plain("warn"), plain("info")],
                vec![regex("latency=(\\d+)")],
            )
        );
        assert_eq!(registry.definitions_revision(), 2);
    }

    #[test]
    fn update_preset_keeps_same_data() {
        let mut registry = PresetRegistry::default();
        let preset_id = add_preset_with_default_state(
            &mut registry,
            "Errors",
            vec![plain("error")],
            vec![regex("duration=(\\d+)")],
        );

        let outcome = registry.update_preset(
            preset_id,
            "Errors",
            filter_entries(vec![plain("error")]),
            search_value_entries(vec![regex("duration=(\\d+)")]),
        );

        assert_eq!(outcome, PresetUpdateOutcome::Unchanged);
        assert_eq!(registry.get(&preset_id).unwrap().name, "Errors");
        assert_eq!(registry.definitions_revision(), 1);
    }

    #[test]
    fn update_preset_uses_unique_name() {
        let mut registry = PresetRegistry::default();
        let first_id =
            add_preset_with_default_state(&mut registry, "First", vec![plain("one")], vec![]);
        add_preset_with_default_state(&mut registry, "Taken", vec![plain("two")], vec![]);
        add_preset_with_default_state(&mut registry, "Taken_2", vec![plain("three")], vec![]);

        let outcome = registry.update_preset(
            first_id,
            "Taken",
            filter_entries(vec![plain("one")]),
            vec![],
        );

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
            filter_entries(vec![plain("one")]),
            search_value_entries(vec![regex("duration=(\\d+)")]),
        );

        assert_eq!(outcome, PresetUpdateOutcome::NotFound);
        assert_eq!(registry.definitions_revision(), 0);
    }

    #[test]
    fn remove_preset_advances_revision() {
        let mut registry = PresetRegistry::default();
        let preset_id =
            add_preset_with_default_state(&mut registry, "Errors", vec![plain("one")], vec![]);

        assert!(registry.remove_preset(preset_id));
        assert_eq!(registry.definitions_revision(), 2);
    }
}
