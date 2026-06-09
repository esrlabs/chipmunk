//! Current preset document serialization and import.
//!
//! Version 2 documents store named filter and search-value row snapshots,
//! including enabled state and colors.

use processor::search::filter::SearchFilter;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::host::{
    common::colors::{ColorPair, StoredColorPair, StoredRgba, color_from_rgba, color_to_rgba},
    ui::registry::presets::{Preset, PresetFilterEntry, PresetSearchValueEntry},
};

use super::{
    DOCUMENT_KIND, DOCUMENT_VERSION, validate_filter_entry, validate_name,
    validate_search_value_entry,
};

/// Preset payload stored in the current preset document.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct DocumentPreset {
    name: String,
    filters: Vec<DocumentFilterEntry>,
    search_values: Vec<DocumentSearchValueEntry>,
}

/// Filter row payload stored in the current preset document.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct DocumentFilterEntry {
    filter: SearchFilter,
    enabled: bool,
    colors: StoredColorPair,
}

/// Chart/search-value row payload stored in the current preset document.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct DocumentSearchValueEntry {
    filter: SearchFilter,
    enabled: bool,
    color: StoredRgba,
}

/// Versioned preset document stored on disk.
#[derive(Debug, Serialize, Deserialize)]
struct PresetDocument {
    kind: String,
    version: u8,
    presets: Vec<DocumentPreset>,
}

/// Serializes runtime presets into the v2 document format.
pub fn serialize_presets(presets: Vec<Preset>) -> Result<String, String> {
    // Runtime preset ids are intentionally ignored here because the file format
    // stores only named row snapshots.
    let presets = presets.into_iter().map(DocumentPreset::from).collect();

    serialize_document(presets)
}

fn serialize_document(presets: Vec<DocumentPreset>) -> Result<String, String> {
    presets.iter().try_for_each(validate_preset)?;

    let document = PresetDocument {
        kind: DOCUMENT_KIND.to_owned(),
        version: DOCUMENT_VERSION,
        presets,
    };

    serde_json::to_string_pretty(&document).map_err(|err| format!("invalid preset document: {err}"))
}

/// Parses a v2 document object into runtime presets.
pub fn parse_document(root: serde_json::Map<String, Value>) -> Result<Vec<Preset>, String> {
    let document: PresetDocument = serde_json::from_value(Value::Object(root))
        .map_err(|err| format!("invalid preset document: {err}"))?;
    document.presets.iter().try_for_each(validate_preset)?;
    let presets = document.presets.into_iter().map(Preset::from).collect();

    Ok(presets)
}

fn validate_preset(preset: &DocumentPreset) -> Result<(), String> {
    let DocumentPreset {
        name,
        filters,
        search_values,
    } = preset;

    validate_name(name)?;

    for entry in filters {
        let DocumentFilterEntry {
            filter,
            enabled: _,
            colors: _,
        } = entry;
        validate_filter_entry(name, filter)?;
    }

    for entry in search_values {
        let DocumentSearchValueEntry {
            filter,
            enabled: _,
            color: _,
        } = entry;
        validate_search_value_entry(name, filter)?;
    }

    Ok(())
}

impl From<Preset> for DocumentPreset {
    fn from(value: Preset) -> Self {
        Self {
            name: value.name,
            filters: value
                .filters
                .into_iter()
                .map(DocumentFilterEntry::from)
                .collect(),
            search_values: value
                .search_values
                .into_iter()
                .map(DocumentSearchValueEntry::from)
                .collect(),
        }
    }
}

impl From<PresetFilterEntry> for DocumentFilterEntry {
    fn from(value: PresetFilterEntry) -> Self {
        Self {
            filter: value.filter,
            enabled: value.enabled,
            colors: StoredColorPair::from(value.colors),
        }
    }
}

impl From<PresetSearchValueEntry> for DocumentSearchValueEntry {
    fn from(value: PresetSearchValueEntry) -> Self {
        Self {
            filter: value.filter,
            enabled: value.enabled,
            color: color_to_rgba(value.color),
        }
    }
}

impl From<DocumentPreset> for Preset {
    fn from(value: DocumentPreset) -> Self {
        Self {
            // Import always creates fresh runtime ids. Name collision handling is
            // deferred to the UI registry import path.
            id: Uuid::new_v4(),
            name: value.name,
            filters: value
                .filters
                .into_iter()
                .map(PresetFilterEntry::from)
                .collect(),
            search_values: value
                .search_values
                .into_iter()
                .map(PresetSearchValueEntry::from)
                .collect(),
        }
    }
}

impl From<DocumentFilterEntry> for PresetFilterEntry {
    fn from(value: DocumentFilterEntry) -> Self {
        Self::new(value.filter, value.enabled, ColorPair::from(value.colors))
    }
}

impl From<DocumentSearchValueEntry> for PresetSearchValueEntry {
    fn from(value: DocumentSearchValueEntry) -> Self {
        Self::new(value.filter, value.enabled, color_from_rgba(value.color))
    }
}

#[cfg(test)]
mod tests {
    use egui::Color32;
    use processor::search::filter::SearchFilter;
    use rustc_hash::FxHashSet;
    use uuid::Uuid;

    use crate::host::{
        common::colors::ColorPair,
        message::ImportFormat,
        service::presets_io::{import_named_presets, serialize_named_presets},
        ui::registry::presets::{Preset, PresetFilterEntry, PresetSearchValueEntry},
    };

    fn plain(value: &str) -> SearchFilter {
        SearchFilter::plain(value).ignore_case(true)
    }

    fn regex(value: &str) -> SearchFilter {
        SearchFilter::plain(value).regex(true).ignore_case(true)
    }

    fn preset(name: &str, filters: Vec<SearchFilter>, search_values: Vec<SearchFilter>) -> Preset {
        Preset::with_default_state(Uuid::new_v4(), name.to_owned(), filters, search_values)
    }

    fn preset_snapshot(presets: &[Preset]) -> Vec<(String, Vec<SearchFilter>, Vec<SearchFilter>)> {
        presets
            .iter()
            .map(|preset| {
                (
                    preset.name.clone(),
                    filter_definitions(preset),
                    search_value_definitions(preset),
                )
            })
            .collect()
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

    #[test]
    fn v2_round_trip_preserves_state() {
        let source = vec![Preset {
            id: Uuid::new_v4(),
            name: "Errors".to_owned(),
            filters: vec![PresetFilterEntry::new(
                plain("error"),
                false,
                ColorPair::new(
                    Color32::from_rgba_unmultiplied(1, 2, 3, 4),
                    Color32::from_rgba_unmultiplied(5, 6, 7, 8),
                ),
            )],
            search_values: vec![PresetSearchValueEntry::new(
                regex("duration=(\\d+)"),
                false,
                Color32::from_rgba_unmultiplied(9, 10, 11, 12),
            )],
        }];

        let json = serialize_named_presets(source.clone()).unwrap();
        let parsed = import_named_presets(&json).unwrap();

        assert!(json.contains("\"version\": 2"));
        assert_eq!(parsed.format, ImportFormat::Version2);
        assert_eq!(preset_snapshot(&parsed.presets), preset_snapshot(&source));
        assert!(!parsed.presets[0].filters[0].enabled);
        assert_eq!(
            parsed.presets[0].filters[0].colors,
            source[0].filters[0].colors
        );
        assert!(!parsed.presets[0].search_values[0].enabled);
        assert_eq!(
            parsed.presets[0].search_values[0].color,
            source[0].search_values[0].color
        );
    }

    #[test]
    fn rejects_blank_name() {
        import_named_presets(
            r#"{"kind":"chipmunk_named_presets","version":2,"presets":[{"name":"   ","filters":[],"search_values":[]}]}"#,
        )
        .unwrap_err();
    }

    #[test]
    fn rejects_invalid_filter() {
        import_named_presets(
            r#"{"kind":"chipmunk_named_presets","version":2,"presets":[{"name":"Broken","filters":[{"filter":{"value":"(","is_regex":true,"ignore_case":true,"is_word":false},"enabled":true,"colors":{"fg":[255,255,255,255],"bg":[0,0,0,255]}}],"search_values":[]}]}"#,
        )
        .unwrap_err();
    }

    #[test]
    fn rejects_invalid_search_value() {
        import_named_presets(
            r#"{"kind":"chipmunk_named_presets","version":2,"presets":[{"name":"Broken","filters":[],"search_values":[{"filter":{"value":"cpu=(.+)","is_regex":true,"ignore_case":true,"is_word":false},"enabled":true,"color":[255,255,255,255]}]}]}"#,
        )
        .unwrap_err();
    }

    #[test]
    fn export_never_uses_legacy_shape() {
        let presets = vec![preset(
            "Errors",
            vec![plain("error")],
            vec![regex("duration=(\\d+)")],
        )];

        let json = serialize_named_presets(presets).unwrap();

        assert!(json.contains("\"kind\": \"chipmunk_named_presets\""));
        assert!(json.contains("\"search_values\""));
        assert!(json.contains("\"is_regex\""));
        assert!(!json.contains("\"searchValues\""));
        assert!(!json.contains("\"content\""));
        assert!(!json.contains("\"uuid\""));
    }

    #[test]
    fn serialize_rejects_invalid_search_value() {
        let presets = vec![preset("Broken", vec![], vec![regex("cpu=(.+)")])];

        serialize_named_presets(presets).unwrap_err();
    }

    #[test]
    fn import_versioned_document_preserves_duplicate_names() {
        let json = r#"
        {
          "kind": "chipmunk_named_presets",
          "version": 2,
          "presets": [
            { "name": "Same", "filters": [], "search_values": [] },
            { "name": "Same", "filters": [], "search_values": [] }
          ]
        }
        "#;

        let report = import_named_presets(json).unwrap();

        assert_eq!(report.presets.len(), 2);
        assert_eq!(report.presets[0].name, "Same");
        assert_eq!(report.presets[1].name, "Same");
        let ids = report
            .presets
            .iter()
            .map(|preset| preset.id)
            .collect::<FxHashSet<_>>();
        assert_eq!(ids.len(), 2);
    }

    #[test]
    fn export_then_import_matches_definitions() {
        let source = vec![
            preset(
                "Errors",
                vec![plain("error"), plain("warn"), plain("error")],
                vec![
                    regex("duration=(\\d+)"),
                    regex("latency=(\\d+)"),
                    regex("duration=(\\d+)"),
                ],
            ),
            preset("Charts", vec![], vec![regex("temp=(\\d+)")]),
        ];

        let json = serialize_named_presets(source.clone()).unwrap();
        let report = import_named_presets(&json).unwrap();

        assert_eq!(preset_snapshot(&report.presets), preset_snapshot(&source));
    }
}
