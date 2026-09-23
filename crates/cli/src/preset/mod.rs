//! Reading of Chipmunk preset documents exported by the GUI.
//!
//! Only the filter definitions of the first preset are relevant for the CLI:
//! colors, pinned state and chart definitions exist in the documents but never
//! take part in filtering. Everything that is skipped is reported back as a
//! [`PresetNote`] instead of being silently dropped.
//!
//! The supported documents are the versioned `chipmunk_named_presets` v1 and v2
//! exports. Legacy Chipmunk V3 TypeScript exports (a top-level JSON array) are
//! rejected; they have to be re-exported from the current GUI.

mod document;

use std::{
    fmt, fs,
    path::{Path, PathBuf},
};

use processor::search::filter::{SearchFilter, get_filter_error};

use document::{DocumentPreset, parse_presets};

/// Filters selected from a preset document together with the notes describing
/// everything the CLI ignored while reading it.
#[derive(Debug)]
pub struct PresetFilters {
    /// Name of the preset the filters were taken from.
    pub preset_name: String,
    /// Active filters, in document order.
    pub filters: Vec<SearchFilter>,
    /// Non-fatal notes to be reported to the user.
    pub notes: Vec<PresetNote>,
}

/// Non-fatal observations collected while reading a preset document.
#[derive(Debug, PartialEq, Eq)]
pub enum PresetNote {
    /// Document held more than one preset; only the first one is applied.
    IgnoredPresets {
        /// Names of the presets that were not applied.
        names: Vec<String>,
    },
    /// Filter rows that are switched off in the preset.
    DisabledFilters {
        /// Filter texts of the switched-off rows.
        values: Vec<String>,
    },
    /// Chart/search-value rows, which never take part in filtering.
    IgnoredSearchValues {
        /// Filter texts of the ignored chart rows.
        values: Vec<String>,
    },
}

/// Reasons a preset document cannot be used for filtering.
#[derive(Debug, thiserror::Error)]
pub enum PresetError {
    /// The preset file could not be read.
    #[error("Cannot read preset file '{}': {source}", .path.display())]
    Io {
        /// Path the CLI tried to read.
        path: PathBuf,
        /// Underlying file system error.
        source: std::io::Error,
    },
    /// The file content is not valid JSON, or does not match the shape of its
    /// document version.
    #[error("Preset file cannot be read as a preset document: {0}")]
    Json(#[from] serde_json::Error),
    /// The document is a legacy Chipmunk V3 export, which the CLI does not read.
    #[error(
        "Preset file is a legacy Chipmunk export. Import it in the Chipmunk GUI and export the preset again to get a supported document"
    )]
    LegacyExport,
    /// The document is not a preset document at all.
    #[error("Unsupported preset document kind: '{kind}'")]
    UnknownKind {
        /// Kind found in the document, empty when the field is missing.
        kind: String,
    },
    /// The document version is newer or older than what the CLI understands.
    #[error("Unsupported preset document version: {version}. Supported versions are 1 and 2")]
    UnsupportedVersion {
        /// Version found in the document, zero when the field is missing.
        version: u64,
    },
    /// An active filter cannot be used for matching.
    #[error("Invalid filter '{value}' in preset '{preset}': {reason}")]
    InvalidFilter {
        /// Name of the preset holding the filter.
        preset: String,
        /// Filter text as written in the document.
        value: String,
        /// Why the filter is unusable.
        reason: String,
    },
    /// The document is a preset document but holds no preset at all.
    #[error("Preset file holds no presets")]
    EmptyDocument,
    /// The selected preset provides nothing to match against.
    #[error("Preset '{preset}' has no active filters")]
    NoActiveFilters {
        /// Name of the selected preset.
        preset: String,
    },
}

/// Reads and normalizes the preset document at `path`.
pub fn load(path: &Path) -> Result<PresetFilters, PresetError> {
    let text = fs::read_to_string(path).map_err(|source| PresetError::Io {
        path: path.to_path_buf(),
        source,
    })?;

    parse(&text)
}

/// Reads the document and applies the first preset, reporting the rest as a note.
fn parse(text: &str) -> Result<PresetFilters, PresetError> {
    let mut presets = parse_presets(text)?.into_iter();
    let Some(preset) = presets.next() else {
        return Err(PresetError::EmptyDocument);
    };
    let ignored_presets: Vec<String> = presets.map(|preset| preset.name).collect();

    select_filters(preset, ignored_presets)
}

/// Splits the preset rows into the filters to apply and the notes to report.
fn select_filters(
    preset: DocumentPreset,
    ignored_presets: Vec<String>,
) -> Result<PresetFilters, PresetError> {
    let DocumentPreset {
        name,
        filters,
        search_values,
    } = preset;

    let mut active = Vec::with_capacity(filters.len());
    let mut disabled_values = Vec::new();
    for row in filters {
        if row.enabled {
            active.push(row.filter);
        } else {
            disabled_values.push(row.filter.value);
        }
    }

    for filter in &active {
        if let Some(reason) = filter_error(filter) {
            return Err(PresetError::InvalidFilter {
                preset: name,
                value: filter.value.clone(),
                reason,
            });
        }
    }

    if active.is_empty() {
        return Err(PresetError::NoActiveFilters { preset: name });
    }

    let mut notes = Vec::new();
    if !ignored_presets.is_empty() {
        notes.push(PresetNote::IgnoredPresets {
            names: ignored_presets,
        });
    }
    if !disabled_values.is_empty() {
        notes.push(PresetNote::DisabledFilters {
            values: disabled_values,
        });
    }
    if !search_values.is_empty() {
        let values = search_values
            .into_iter()
            .map(|filter| filter.value)
            .collect();
        notes.push(PresetNote::IgnoredSearchValues { values });
    }

    Ok(PresetFilters {
        preset_name: name,
        filters: active,
        notes,
    })
}

/// Mirrors the GUI filter validation: no empty text, and regex patterns compile.
fn filter_error(filter: &SearchFilter) -> Option<String> {
    if filter.value.is_empty() {
        return Some("filter text cannot be empty".to_owned());
    }

    get_filter_error(filter).map(|error| format!("invalid regex: {error}"))
}

impl fmt::Display for PresetNote {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::IgnoredPresets { names } => write!(
                f,
                "Preset document holds more than one preset; ignored: {}.",
                names.join(", ")
            ),
            Self::DisabledFilters { values } => {
                write!(f, "Ignored disabled filters: {}.", values.join(", "))
            }
            Self::IgnoredSearchValues { values } => write!(
                f,
                "Ignored search values, charts cannot filter: {}.",
                values.join(", ")
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{PresetError, PresetNote, load, parse};
    use processor::search::filter::SearchFilter;
    use std::path::PathBuf;

    fn fixture(rel_path: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../development/resources/presets")
            .join(rel_path)
    }

    fn plain(value: &str) -> SearchFilter {
        SearchFilter::plain(value).ignore_case(true)
    }

    fn regex(value: &str) -> SearchFilter {
        SearchFilter::plain(value).regex(true).ignore_case(true)
    }

    /// Builds a v2 document with the given filter rows, without the row metadata
    /// the CLI ignores.
    fn v2_document(filter_rows: &str) -> String {
        format!(
            r#"{{"kind":"chipmunk_named_presets","version":2,"presets":[{{"name":"Errors","filters":[{filter_rows}],"search_values":[]}}]}}"#
        )
    }

    #[test]
    fn v2_loads_enabled_filters_only() {
        let preset = load(&fixture("v2/basic.json")).unwrap();

        assert_eq!(preset.preset_name, "Errors");
        assert_eq!(preset.filters, vec![plain("error"), regex("warn(ing)?")]);
    }

    #[test]
    fn v2_reports_disabled_filters_and_search_values() {
        let preset = load(&fixture("v2/basic.json")).unwrap();

        assert_eq!(
            preset.notes,
            vec![
                PresetNote::DisabledFilters {
                    values: vec!["debug".to_owned()],
                },
                PresetNote::IgnoredSearchValues {
                    values: vec!["duration=(\\d+)".to_owned()],
                },
            ]
        );
    }

    #[test]
    fn v2_uses_first_preset_and_reports_rest() {
        let preset = load(&fixture("v2/multi_preset.json")).unwrap();

        assert_eq!(preset.preset_name, "Errors");
        assert_eq!(preset.filters, vec![plain("error")]);
        assert_eq!(
            preset.notes,
            vec![PresetNote::IgnoredPresets {
                names: vec!["Traffic".to_owned(), "Startup".to_owned()],
            }]
        );
    }

    #[test]
    fn v1_treats_all_filters_as_active() {
        let preset = load(&fixture("v1/basic.json")).unwrap();

        assert_eq!(preset.filters, vec![plain("error"), regex("warn(ing)?")]);
        assert_eq!(
            preset.notes,
            vec![PresetNote::IgnoredSearchValues {
                values: vec!["duration=(\\d+)".to_owned()],
            }]
        );
    }

    /// Chart rows never stand in for filters, so a chart-only preset cannot filter.
    #[test]
    fn reports_search_value_only_preset() {
        let error = load(&fixture("v2/search_values_only.json")).unwrap_err();

        assert!(matches!(error, PresetError::NoActiveFilters { .. }));
    }

    #[test]
    fn rejects_legacy_export() {
        let error = load(&fixture("legacy/one_preset_1.json")).unwrap_err();

        assert!(matches!(error, PresetError::LegacyExport));
    }

    #[test]
    fn validates_active_filters_only() {
        let document = v2_document(
            r#"{"filter":{"value":"(","is_regex":true,"ignore_case":true,"is_word":false},"enabled":false},
               {"filter":{"value":"error","is_regex":false,"ignore_case":true,"is_word":false},"enabled":true}"#,
        );

        let preset = parse(&document).unwrap();

        assert_eq!(preset.filters, vec![plain("error")]);
    }

    #[test]
    fn rejects_invalid_active_regex() {
        let document = v2_document(
            r#"{"filter":{"value":"(","is_regex":true,"ignore_case":true,"is_word":false},"enabled":true}"#,
        );

        let error = parse(&document).unwrap_err();

        assert!(matches!(error, PresetError::InvalidFilter { .. }));
    }

    #[test]
    fn rejects_empty_filter_value() {
        let document = v2_document(
            r#"{"filter":{"value":"","is_regex":false,"ignore_case":true,"is_word":false},"enabled":true}"#,
        );

        let error = parse(&document).unwrap_err();

        assert!(matches!(error, PresetError::InvalidFilter { .. }));
    }

    #[test]
    fn rejects_preset_without_active_filters() {
        let document = v2_document(
            r#"{"filter":{"value":"error","is_regex":false,"ignore_case":true,"is_word":false},"enabled":false}"#,
        );

        let error = parse(&document).unwrap_err();

        assert!(matches!(error, PresetError::NoActiveFilters { .. }));
    }
}
