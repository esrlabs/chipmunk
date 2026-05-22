//! Service-side import and export for named preset documents.
//!
//! This module owns the native on-disk JSON schema, parses the legacy export
//! shape for backward compatibility, and validates imported filters before the
//! UI applies them into the runtime preset registry.

use std::fmt;

use processor::search::filter::SearchFilter;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::{
    common::validation::{ValidationEligibility, validate_filter, validate_search_value_filter},
    host::ui::registry::presets::Preset,
};

/// Document kind written during serialization and required during import to
/// recognize preset files.
const DOCUMENT_KIND: &str = "chipmunk_named_presets";

/// Document version written during serialization and checked during import for
/// schema compatibility.
const DOCUMENT_VERSION: u8 = 1;

/// Semantic preset payload stored in the native preset document.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NamedPreset {
    pub name: String,
    pub filters: Vec<SearchFilter>,
    pub search_values: Vec<SearchFilter>,
}

/// Import source recognized by the preset parser.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImportFormat {
    Version1,
    // Legacy from Chipmunk V3 with typescript frontend.
    Legacy,
}

/// Result returned after parsing a preset file successfully.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportReport {
    pub format: ImportFormat,
    pub presets: Vec<Preset>,
    pub warnings: Vec<ImportWarning>,
}

/// Non-fatal issues collected while translating a legacy preset export.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ImportWarning {
    LegacyCollectionSkipped {
        collection_name: Option<String>,
        reason: String,
    },
    LegacyEntryIgnored {
        preset_name: String,
        entry_kind: LegacyEntryKind,
        count: usize,
    },
}

/// Legacy entry kind that was ignored during translation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LegacyEntryKind {
    Bookmark,
    InvalidFilter,
    InvalidChart,
    Unsupported(String),
}

/// Versioned preset document stored on disk.
#[derive(Debug, Serialize, Deserialize)]
struct Document {
    kind: String,
    version: u8,
    presets: Vec<NamedPreset>,
}

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
        preset: NamedPreset,
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

/// Validate then serializes a preset snapshot into the native named-presets
/// JSON document.
pub fn serialize_named_presets(presets: Vec<Preset>) -> Result<String, String> {
    // Runtime preset ids are intentionally ignored here because the file format
    // stores only semantic preset data.
    let presets = presets
        .into_iter()
        .map(|preset| NamedPreset {
            name: preset.name,
            filters: preset.filters,
            search_values: preset.search_values,
        })
        .collect::<Vec<_>>();

    serialize_document(presets)
}

fn serialize_document(presets: Vec<NamedPreset>) -> Result<String, String> {
    presets.iter().try_for_each(validate_named_preset)?;

    let document = Document {
        kind: DOCUMENT_KIND.to_owned(),
        version: DOCUMENT_VERSION,
        presets,
    };

    serde_json::to_string_pretty(&document)
        .map_err(|err| format!("invalid native preset document: {err}"))
}

/// Parses a native preset document or a supported legacy export.
///
/// Returned presets already have fresh runtime ids assigned so the UI can hand
/// them to the registry import path directly.
pub fn import_named_presets(text: &str) -> Result<ImportReport, String> {
    let value = parse_root_value(text)?;
    let (format, presets, warnings) = match value {
        Value::Object(root) => {
            let presets = parse_document_from_value(root)?;
            (ImportFormat::Version1, presets, Vec::new())
        }
        Value::Array(items) => {
            let (presets, warnings) = parse_legacy_from_value(items)?;
            (ImportFormat::Legacy, presets, warnings)
        }
        _ => return Err("preset document root must be an object or array".to_owned()),
    };

    Ok(ImportReport {
        format,
        presets: presets.into_iter().map(Preset::from).collect(),
        warnings,
    })
}

fn parse_root_value(text: &str) -> Result<Value, String> {
    let trimmed = text.trim_start();
    serde_json::from_str(text).map_err(|err| {
        // The legacy export uses a top-level array while the native format uses
        // an object, so the first non-whitespace token is enough to classify
        // syntax failures for the user-facing error.
        if trimmed.starts_with('[') {
            format!("invalid legacy preset export: {err}")
        } else {
            format!("invalid native preset document: {err}")
        }
    })
}

fn parse_document_from_value(
    root: serde_json::Map<String, Value>,
) -> Result<Vec<NamedPreset>, String> {
    let kind = root
        .get("kind")
        .and_then(Value::as_str)
        .ok_or_else(|| "unsupported preset document kind: ".to_owned())?;
    if kind != DOCUMENT_KIND {
        return Err(format!("unsupported preset document kind: {kind}"));
    }

    let version = root
        .get("version")
        .and_then(Value::as_u64)
        .ok_or_else(|| "unsupported preset document version: 0".to_owned())?;
    let version = u8::try_from(version).unwrap_or(u8::MAX);
    if version != DOCUMENT_VERSION {
        return Err(format!("unsupported preset document version: {version}"));
    }

    let document: Document = serde_json::from_value(Value::Object(root))
        .map_err(|err| format!("invalid native preset document: {err}"))?;
    document
        .presets
        .iter()
        .try_for_each(validate_named_preset)?;
    Ok(document.presets)
}

fn validate_named_preset(preset: &NamedPreset) -> Result<(), String> {
    if preset.name.trim().is_empty() {
        return Err("preset name cannot be blank".to_owned());
    }

    for filter in &preset.filters {
        match validate_filter(filter) {
            ValidationEligibility::Eligible => {}
            ValidationEligibility::Ineligible { reason } => {
                return Err(format!(
                    "invalid filter in preset '{}': {reason}",
                    preset.name
                ));
            }
        }
    }

    for search_value in &preset.search_values {
        match validate_search_value_filter(search_value) {
            ValidationEligibility::Eligible => {}
            ValidationEligibility::Ineligible { reason } => {
                return Err(format!(
                    "invalid search value in preset '{}': {reason}",
                    preset.name
                ));
            }
        }
    }

    Ok(())
}

fn parse_legacy_from_value(
    items: Vec<Value>,
) -> Result<(Vec<NamedPreset>, Vec<ImportWarning>), String> {
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
                Err(_) => warnings.push(ImportWarning::LegacyCollectionSkipped {
                    collection_name: None,
                    reason: "invalid JSON".to_owned(),
                }),
            }
        }
    }

    if !found_collections {
        return Err("legacy preset export is missing collections".to_owned());
    }

    Ok((presets, warnings))
}

fn parse_legacy_collection(content: &str) -> Result<LegacyCollectionOutcome, serde_json::Error> {
    let value: Value = serde_json::from_str(content)?;
    let collection_name = value.get("n").and_then(Value::as_str).map(str::to_owned);
    let Some(name) = collection_name.clone() else {
        return Ok(LegacyCollectionOutcome::Skip {
            collection_name: None,
            skip_message: "missing name".to_owned(),
            warnings: Vec::new(),
        });
    };
    if name.trim().is_empty() || name == "-" {
        return Ok(LegacyCollectionOutcome::Skip {
            collection_name: Some(name),
            skip_message: "missing name".to_owned(),
            warnings: Vec::new(),
        });
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
    let mut unsupported_counts = std::collections::BTreeMap::<String, usize>::new();

    // Legacy exports do not reliably distinguish preset exports from direct
    // filter/chart exports, so any named collection with semantic entries is
    // treated as an importable preset.
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
        return Ok(LegacyCollectionOutcome::Skip {
            collection_name: Some(name),
            skip_message: "no filters or charts to import".to_owned(),
            warnings,
        });
    }

    Ok(LegacyCollectionOutcome::Preset {
        preset: NamedPreset {
            name,
            filters,
            search_values,
        },
        warnings,
    })
}

fn parse_legacy_filter(payload: &str) -> Result<SearchFilter, serde_json::Error> {
    let value: Value = serde_json::from_str(payload)?;
    let filter = value
        .get("filter")
        .and_then(Value::as_object)
        .ok_or_else(|| serde_json::Error::io(std::io::Error::other("missing filter")))?;
    let text = filter
        .get("filter")
        .and_then(Value::as_str)
        .ok_or_else(|| serde_json::Error::io(std::io::Error::other("missing filter text")))?;
    let flags = filter
        .get("flags")
        .and_then(Value::as_object)
        .ok_or_else(|| serde_json::Error::io(std::io::Error::other("missing flags")))?;
    let regex = flags.get("reg").and_then(Value::as_bool).unwrap_or(false);
    let word = flags.get("word").and_then(Value::as_bool).unwrap_or(false);
    let cases = flags.get("cases").and_then(Value::as_bool).unwrap_or(false);

    let filter = SearchFilter::plain(text)
        .regex(regex)
        .word(word)
        .ignore_case(!cases);
    if !validate_filter(&filter).is_eligible() {
        return Err(serde_json::Error::io(std::io::Error::other(
            "invalid legacy filter",
        )));
    }

    Ok(filter)
}

fn parse_legacy_chart(payload: &str) -> Result<SearchFilter, serde_json::Error> {
    let value: Value = serde_json::from_str(payload)?;
    let text = value
        .get("filter")
        .and_then(Value::as_str)
        .ok_or_else(|| serde_json::Error::io(std::io::Error::other("missing chart filter")))?;
    // Legacy chart entries are really regex-backed search values, not literal
    // filters, so they map to the search-value side of the native model.
    let filter = SearchFilter::plain(text).regex(true).ignore_case(true);
    if !validate_search_value_filter(&filter).is_eligible() {
        return Err(serde_json::Error::io(std::io::Error::other(
            "invalid legacy chart",
        )));
    }

    Ok(filter)
}

impl From<NamedPreset> for Preset {
    fn from(value: NamedPreset) -> Self {
        Self {
            // Import always creates fresh runtime ids. Name collision handling is
            // deferred to the UI registry import path.
            id: Uuid::new_v4(),
            name: value.name,
            filters: value.filters,
            search_values: value.search_values,
        }
    }
}

impl fmt::Display for LegacyEntryKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Bookmark => f.write_str("bookmark"),
            Self::InvalidFilter => f.write_str("invalid filter"),
            Self::InvalidChart => f.write_str("invalid chart"),
            Self::Unsupported(kind) => f.write_str(kind),
        }
    }
}

impl fmt::Display for ImportWarning {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::LegacyCollectionSkipped {
                collection_name,
                reason,
            } => match collection_name {
                Some(name) => write!(f, "Skipped legacy collection '{name}': {reason}."),
                None => write!(f, "Skipped a legacy collection: {reason}."),
            },
            Self::LegacyEntryIgnored {
                preset_name,
                entry_kind,
                count,
            } => {
                let noun = if *count == 1 { "entry" } else { "entries" };
                write!(
                    f,
                    "Ignored {count} {entry_kind} {noun} while importing preset '{preset_name}'."
                )
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{fs, path::PathBuf};

    use rustc_hash::FxHashSet;

    use super::*;

    fn plain(value: &str) -> SearchFilter {
        SearchFilter::plain(value).ignore_case(true)
    }

    fn regex(value: &str) -> SearchFilter {
        SearchFilter::plain(value).regex(true).ignore_case(true)
    }

    fn preset(name: &str, filters: Vec<SearchFilter>, search_values: Vec<SearchFilter>) -> Preset {
        Preset {
            id: Uuid::new_v4(),
            name: name.to_owned(),
            filters,
            search_values,
        }
    }

    fn semantic_snapshot(
        presets: &[Preset],
    ) -> Vec<(String, Vec<SearchFilter>, Vec<SearchFilter>)> {
        presets
            .iter()
            .map(|preset| {
                (
                    preset.name.clone(),
                    preset.filters.clone(),
                    preset.search_values.clone(),
                )
            })
            .collect()
    }

    fn fixture_text(name: &str) -> String {
        let path = fixture_dir().join(name);
        fs::read_to_string(path).expect("fixture should be readable")
    }

    fn fixture_dir() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("testdata/presets_io")
    }

    fn parse_document(text: &str) -> Result<Vec<NamedPreset>, String> {
        let Value::Object(root) = parse_root_value(text)? else {
            return Err("preset document root must be an object or array".to_owned());
        };

        parse_document_from_value(root)
    }

    #[test]
    fn native_round_trip() {
        let document = vec![
            NamedPreset {
                name: "Errors".to_owned(),
                filters: vec![plain("error"), plain("warn"), plain("error")],
                search_values: vec![regex("duration=(\\d+)")],
            },
            NamedPreset {
                name: "Values".to_owned(),
                filters: vec![],
                search_values: vec![regex("latency=(\\d+)"), regex("latency=(\\d+)")],
            },
        ];
        let expected = document.clone();

        let json = serialize_document(document).unwrap();
        let parsed = parse_document(&json).unwrap();

        assert_eq!(parsed, expected);
    }

    #[test]
    fn native_rejects_kind() {
        parse_document(r#"{"kind":"wrong","version":1,"presets":[]}"#).unwrap_err();
    }

    #[test]
    fn native_rejects_version() {
        parse_document(r#"{"kind":"chipmunk_named_presets","version":2,"presets":[]}"#)
            .unwrap_err();
    }

    #[test]
    fn native_rejects_blank_name() {
        parse_document(
            r#"{"kind":"chipmunk_named_presets","version":1,"presets":[{"name":"   ","filters":[],"search_values":[]}]}"#,
        )
        .unwrap_err();
    }

    #[test]
    fn native_rejects_invalid_filter() {
        parse_document(
            r#"{"kind":"chipmunk_named_presets","version":1,"presets":[{"name":"Broken","filters":[{"value":"(","is_regex":true,"ignore_case":true,"is_word":false}],"search_values":[]}]}"#,
        )
        .unwrap_err();
    }

    #[test]
    fn native_rejects_invalid_search_value() {
        parse_document(
            r#"{"kind":"chipmunk_named_presets","version":1,"presets":[{"name":"Broken","filters":[],"search_values":[{"value":"cpu=(.+)","is_regex":true,"ignore_case":true,"is_word":false}]}]}"#,
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
        let document = vec![NamedPreset {
            name: "Broken".to_owned(),
            filters: vec![],
            search_values: vec![regex("cpu=(.+)")],
        }];

        serialize_document(document).unwrap_err();
    }

    #[test]
    fn import_new_document_keeps_duplicates() {
        let json = r#"
        {
          "kind": "chipmunk_named_presets",
          "version": 1,
          "presets": [
            {
              "name": "Errors",
              "filters": [
                { "value": "error", "is_regex": false, "ignore_case": true, "is_word": false },
                { "value": "error", "is_regex": false, "ignore_case": true, "is_word": false }
              ],
              "search_values": [
                { "value": "duration=(\\d+)", "is_regex": true, "ignore_case": true, "is_word": false },
                { "value": "duration=(\\d+)", "is_regex": true, "ignore_case": true, "is_word": false }
              ]
            }
          ]
        }
        "#;

        let report = import_named_presets(json).unwrap();
        let preset = &report.presets[0];

        assert_eq!(report.format, ImportFormat::Version1);
        assert_eq!(preset.filters, vec![plain("error"), plain("error")]);
        assert_eq!(
            preset.search_values,
            vec![regex("duration=(\\d+)"), regex("duration=(\\d+)")]
        );
    }

    #[test]
    fn import_new_document_preserves_duplicate_names() {
        let json = r#"
        {
          "kind": "chipmunk_named_presets",
          "version": 1,
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
    fn import_rejects_object_without_native_kind() {
        import_named_presets(r#"{"presets":[]}"#).unwrap_err();
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
        assert_eq!(preset.search_values, vec![regex("(\\d)")]);
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
        assert!(!preset.filters[0].is_regex());
        assert!(preset.filters[1].is_regex());
        assert!(preset.filters.iter().all(|filter| filter.is_ignore_case()));
    }

    #[test]
    fn export_then_import_matches_semantics() {
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

        assert_eq!(
            semantic_snapshot(&report.presets),
            semantic_snapshot(&source)
        );
    }

    #[test]
    fn legacy_fixture_alias_imports_same_semantics() {
        let first = import_named_presets(&fixture_text("filters_1.json")).unwrap();
        let second =
            import_named_presets(&fixture_text("same_as_filters_1_as_preset.json")).unwrap();

        assert_eq!(
            semantic_snapshot(&first.presets),
            semantic_snapshot(&second.presets)
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
        let outer = serde_json::json!([
            {
                "uuid": "outer",
                "content": serde_json::json!({
                    "c": [
                        {
                            "uuid": "col",
                            "content": collection.to_string()
                        }
                    ]
                })
                .to_string()
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
}
