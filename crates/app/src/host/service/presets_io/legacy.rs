//! Legacy preset import for Chipmunk V3 TypeScript exports.
//!
//! Legacy documents use nested stringified JSON envelopes. Decoded collections
//! become presets; filter entries map to filters, and chart entries map to
//! search values.
//!
//! Legacy export shape. Both `content` fields are stringified JSON.
//! ```json
//! [
//!   { "content": "{\"c\":[{\"content\":\"{...collection json...}\"}]}" }
//! ]
//! ```
//! Decoded collection payload:
//! ```json
//! {
//!   "n": "Errors",
//!   "e": [
//!     { "filters": "{...filter json...}" },
//!     { "charts": "{...chart json...}" }
//!   ]
//! }
//! ```

use std::{collections::BTreeMap, io::Error as IoError};

use processor::search::filter::SearchFilter;
use serde::Deserialize;
use serde_json::{Error as JsonError, Value};
use uuid::Uuid;

use crate::{
    common::validation::{validate_filter, validate_search_value_filter},
    host::ui::registry::presets::Preset,
};

use super::{ImportWarning, LegacyEntryKind};

/// Legacy wrapper object whose payload was stored as stringified JSON.
#[derive(Debug, Deserialize)]
struct LegacyEnvelope {
    content: String,
}

/// Legacy top-level collection container read from an envelope payload.
#[derive(Debug, Deserialize)]
struct LegacyCollections {
    c: Option<Vec<LegacyEnvelope>>,
}

/// Result of translating one legacy collection into a preset or a skip reason.
enum LegacyCollectionOutcome {
    Preset {
        /// Imported preset built from the legacy collection.
        preset: Preset,
        /// Per-entry legacy notes collected while building the preset.
        warnings: Vec<ImportWarning>,
    },
    Skip {
        /// Legacy collection name when one was present in the payload.
        collection_name: Option<String>,
        /// Summary of why the collection could not produce a preset.
        skip_message: String,
        /// Per-entry legacy notes collected before the collection was skipped.
        warnings: Vec<ImportWarning>,
    },
}

/// Parses the legacy top-level export array into runtime presets and warnings.
pub fn parse_legacy_from_value(
    items: Vec<Value>,
) -> Result<(Vec<Preset>, Vec<ImportWarning>), String> {
    // Legacy export shape:
    // [
    //   {
    //     "content": "{\"c\":[{\"content\":\"{...collection json...}\"}]}"
    //   }
    // ]
    //
    // Please refer to export/imports tests for legacy export samples.
    let envelopes: Vec<LegacyEnvelope> = serde_json::from_value(Value::Array(items))
        .map_err(|err| format!("invalid legacy preset export: {err}"))?;
    let mut presets = Vec::new();
    let mut warnings = Vec::new();
    let mut found_collections = false;

    for envelope in envelopes {
        let collections: LegacyCollections = match serde_json::from_str(&envelope.content) {
            Ok(collections) => collections,
            Err(_) => {
                warnings.push(ImportWarning::LegacyCollectionSkipped {
                    collection_name: None,
                    reason: "invalid JSON".to_owned(),
                });
                continue;
            }
        };
        let Some(collections) = collections.c else {
            continue;
        };
        found_collections = true;

        for collection in collections {
            match parse_legacy_collection(&collection.content) {
                Ok(LegacyCollectionOutcome::Preset {
                    preset,
                    warnings: local,
                }) => {
                    let mut local = local;
                    presets.push(preset);
                    warnings.append(&mut local);
                }
                Ok(LegacyCollectionOutcome::Skip {
                    collection_name,
                    skip_message: reason,
                    warnings: local,
                }) => {
                    warnings.extend(local);
                    warnings.push(ImportWarning::LegacyCollectionSkipped {
                        collection_name,
                        reason,
                    });
                }
                Err(_) => {
                    let warning = ImportWarning::LegacyCollectionSkipped {
                        collection_name: None,
                        reason: "invalid JSON".to_owned(),
                    };
                    warnings.push(warning);
                }
            }
        }
    }

    if !found_collections {
        return Err("legacy preset export is missing collections".to_owned());
    }

    Ok((presets, warnings))
}

fn parse_legacy_collection(content: &str) -> Result<LegacyCollectionOutcome, JsonError> {
    let value: Value = serde_json::from_str(content)?;
    let collection_name = value.get("n").and_then(Value::as_str).map(str::to_owned);
    let Some(name) = collection_name.clone() else {
        let outcome = LegacyCollectionOutcome::Skip {
            collection_name: None,
            skip_message: "missing name".to_owned(),
            warnings: Vec::new(),
        };
        return Ok(outcome);
    };
    if name.trim().is_empty() || name == "-" {
        let outcome = LegacyCollectionOutcome::Skip {
            collection_name: Some(name),
            skip_message: "missing name".to_owned(),
            warnings: Vec::new(),
        };
        return Ok(outcome);
    }

    let entries = value
        .get("e")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut filters = Vec::new();
    let mut search_values = Vec::new();
    let mut warnings = Vec::new();
    let mut ignored_bookmarks = 0;
    let mut invalid_filters = 0;
    let mut invalid_charts = 0;
    let mut unsupported_counts = BTreeMap::<String, usize>::new();

    // Legacy exports do not reliably distinguish preset exports from direct
    // filter/chart exports, so any named collection with filter/chart entries
    // is treated as an importable preset.
    for entry in entries {
        let Some(entry_map) = entry.as_object() else {
            continue;
        };
        let Some((entry_kind, payload)) = entry_map.iter().next() else {
            continue;
        };
        let Some(payload) = payload.as_str() else {
            *unsupported_counts.entry(entry_kind.clone()).or_default() += 1;
            continue;
        };

        match entry_kind.as_str() {
            "filters" => match parse_legacy_filter(payload) {
                Ok(filter) => filters.push(filter),
                Err(_) => invalid_filters += 1,
            },
            "charts" => match parse_legacy_chart(payload) {
                Ok(search_value) => search_values.push(search_value),
                Err(_) => invalid_charts += 1,
            },
            "bookmark" => ignored_bookmarks += 1,
            other => *unsupported_counts.entry(other.to_owned()).or_default() += 1,
        }
    }

    if ignored_bookmarks > 0 {
        warnings.push(ImportWarning::LegacyEntryIgnored {
            preset_name: name.clone(),
            entry_kind: LegacyEntryKind::Bookmark,
            count: ignored_bookmarks,
        });
    }
    if invalid_filters > 0 {
        warnings.push(ImportWarning::LegacyEntryIgnored {
            preset_name: name.clone(),
            entry_kind: LegacyEntryKind::InvalidFilter,
            count: invalid_filters,
        });
    }
    if invalid_charts > 0 {
        warnings.push(ImportWarning::LegacyEntryIgnored {
            preset_name: name.clone(),
            entry_kind: LegacyEntryKind::InvalidChart,
            count: invalid_charts,
        });
    }
    for (kind, count) in unsupported_counts {
        warnings.push(ImportWarning::LegacyEntryIgnored {
            preset_name: name.clone(),
            entry_kind: LegacyEntryKind::Unsupported(kind),
            count,
        });
    }

    if filters.is_empty() && search_values.is_empty() {
        let outcome = LegacyCollectionOutcome::Skip {
            collection_name: Some(name),
            skip_message: "no filters or charts to import".to_owned(),
            warnings,
        };
        return Ok(outcome);
    }

    let preset = Preset::with_default_state(Uuid::new_v4(), name, filters, search_values);
    let outcome = LegacyCollectionOutcome::Preset { preset, warnings };

    Ok(outcome)
}

fn parse_legacy_filter(payload: &str) -> Result<SearchFilter, JsonError> {
    let value: Value = serde_json::from_str(payload)?;
    let filter = value
        .get("filter")
        .and_then(Value::as_object)
        .ok_or_else(|| JsonError::io(IoError::other("missing filter")))?;
    let text = filter
        .get("filter")
        .and_then(Value::as_str)
        .ok_or_else(|| JsonError::io(IoError::other("missing filter text")))?;
    let flags = filter
        .get("flags")
        .and_then(Value::as_object)
        .ok_or_else(|| JsonError::io(IoError::other("missing flags")))?;
    let regex = flags.get("reg").and_then(Value::as_bool).unwrap_or(false);
    let word = flags.get("word").and_then(Value::as_bool).unwrap_or(false);
    let cases = flags.get("cases").and_then(Value::as_bool).unwrap_or(false);

    let filter = SearchFilter::plain(text)
        .regex(regex)
        .word(word)
        .ignore_case(!cases);
    if !validate_filter(&filter).is_eligible() {
        return Err(JsonError::io(IoError::other("invalid legacy filter")));
    }

    Ok(filter)
}

fn parse_legacy_chart(payload: &str) -> Result<SearchFilter, JsonError> {
    let value: Value = serde_json::from_str(payload)?;
    let text = value
        .get("filter")
        .and_then(Value::as_str)
        .ok_or_else(|| JsonError::io(IoError::other("missing chart filter")))?;
    // Legacy chart entries are really regex-backed search values, not literal
    // filters, so they map to the search-value side of the native model.
    let filter = SearchFilter::plain(text).regex(true).ignore_case(true);
    if !validate_search_value_filter(&filter).is_eligible() {
        return Err(JsonError::io(IoError::other("invalid legacy chart")));
    }

    Ok(filter)
}

#[cfg(test)]
mod tests {
    use std::{fs, path::PathBuf};

    use processor::search::filter::SearchFilter;

    use crate::host::{
        message::ImportFormat,
        service::presets_io::{ImportWarning, LegacyEntryKind, import_named_presets},
    };

    fn regex(value: &str) -> SearchFilter {
        SearchFilter::plain(value).regex(true).ignore_case(true)
    }

    fn search_value_definitions(
        preset: &crate::host::ui::registry::presets::Preset,
    ) -> Vec<SearchFilter> {
        preset
            .search_values
            .iter()
            .map(|entry| entry.filter.clone())
            .collect()
    }

    fn fixture_text(name: &str) -> String {
        let path = fixture_dir().join(name);
        fs::read_to_string(path).expect("fixture should be readable")
    }

    fn fixture_dir() -> PathBuf {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        manifest_dir.join("testdata/presets_io")
    }

    #[test]
    fn imports_one_legacy_preset() {
        let report = import_named_presets(&fixture_text("one_preset_1.json")).unwrap();

        assert_eq!(report.format, ImportFormat::Legacy);
        assert_eq!(report.presets.len(), 1);
        let preset = &report.presets[0];
        assert_eq!(preset.name, "journalctl");
        assert_eq!(preset.filters.len(), 4);
        assert!(preset.search_values.is_empty());
    }

    #[test]
    fn imports_multiple_legacy_presets() {
        let report = import_named_presets(&fixture_text("multiple_presets_1.json")).unwrap();

        assert_eq!(report.format, ImportFormat::Legacy);
        assert_eq!(report.presets.len(), 2);
        assert_eq!(report.presets[0].name, "journalctl");
        assert_eq!(report.presets[1].name, "files *..dlt");
    }

    #[test]
    fn legacy_chart_only_becomes_search_value() {
        let report = import_named_presets(&fixture_text("preset_chart_only.json")).unwrap();

        let preset = &report.presets[0];
        assert!(preset.filters.is_empty());
        assert_eq!(search_value_definitions(preset), vec![regex("(\\d)")]);
    }

    #[test]
    fn legacy_filter_only_stays_filter_only() {
        let report = import_named_presets(&fixture_text("presets_filter_only.json")).unwrap();

        assert_eq!(report.presets.len(), 2);
        assert!(
            report
                .presets
                .iter()
                .all(|preset| preset.search_values.is_empty())
        );
    }

    #[test]
    fn legacy_filters_export_is_imported_as_preset() {
        let report = import_named_presets(&fixture_text("filters_1.json")).unwrap();

        assert_eq!(report.presets.len(), 1);
        let preset = &report.presets[0];
        assert_eq!(preset.name, "ping www.google.com");
        assert_eq!(preset.filters.len(), 6);
        assert_eq!(preset.search_values.len(), 1);
        assert!(report.warnings.iter().any(|warning| matches!(
            warning,
            ImportWarning::LegacyEntryIgnored {
                preset_name,
                entry_kind: LegacyEntryKind::Bookmark,
                count: 3,
            } if preset_name == "ping www.google.com"
        )));
    }

    #[test]
    fn legacy_duplicate_names_are_preserved() {
        let report = import_named_presets(&fixture_text("presets_same_name.json")).unwrap();

        assert_eq!(report.presets.len(), 3);
        assert_eq!(report.presets[0].name, "SameName");
        assert_eq!(report.presets[1].name, "SameName");
        assert_eq!(report.presets[2].name, "journalctl");
    }

    #[test]
    fn legacy_preserves_filter_flags() {
        let report = import_named_presets(&fixture_text("filters_1.json")).unwrap();

        let preset = &report.presets[0];
        let filters = preset
            .filters
            .iter()
            .map(|entry| &entry.filter)
            .collect::<Vec<_>>();
        assert!(!filters[0].is_regex());
        assert!(filters[1].is_regex());
        assert!(filters.iter().all(|filter| filter.is_ignore_case()));
    }

    #[test]
    fn legacy_fixture_alias_imports_same_definitions() {
        let first = import_named_presets(&fixture_text("filters_1.json")).unwrap();
        let second =
            import_named_presets(&fixture_text("same_as_filters_1_as_preset.json")).unwrap();

        assert_eq!(
            preset_snapshot(&first.presets),
            preset_snapshot(&second.presets)
        );
    }

    #[test]
    fn legacy_skips_invalid_chart_entry() {
        let chart_entry = serde_json::json!({
            "filter": "cpu=(.+)",
            "uuid": "chart",
            "active": true,
            "color": "#ffffff",
            "type": "Linear",
            "widths": { "line": 1, "point": 0 }
        });
        let collection = serde_json::json!({
            "n": "BrokenCharts",
            "e": [
                {
                    "charts": chart_entry.to_string()
                }
            ]
        });
        let collection_envelope = serde_json::json!({
            "c": [
                {
                    "uuid": "col",
                    "content": collection.to_string()
                }
            ]
        });
        let outer = serde_json::json!([
            {
                "uuid": "outer",
                "content": collection_envelope.to_string()
            }
        ]);

        let report = import_named_presets(&outer.to_string()).unwrap();

        assert!(report.presets.is_empty());
        assert!(report.warnings.iter().any(|warning| matches!(
            warning,
            ImportWarning::LegacyEntryIgnored {
                preset_name,
                entry_kind: LegacyEntryKind::InvalidChart,
                count: 1,
            } if preset_name == "BrokenCharts"
        )));
        assert!(report.warnings.iter().any(|warning| matches!(
            warning,
            ImportWarning::LegacyCollectionSkipped {
                collection_name: Some(name),
                ..
            } if name == "BrokenCharts"
        )));
    }

    fn preset_snapshot(
        presets: &[crate::host::ui::registry::presets::Preset],
    ) -> Vec<(String, Vec<SearchFilter>, Vec<SearchFilter>)> {
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

    fn filter_definitions(
        preset: &crate::host::ui::registry::presets::Preset,
    ) -> Vec<SearchFilter> {
        preset
            .filters
            .iter()
            .map(|entry| entry.filter.clone())
            .collect()
    }
}
