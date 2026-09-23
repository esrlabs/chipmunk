//! On-disk shapes of the versioned `chipmunk_named_presets` documents.
//!
//! Both supported versions are normalized into one [`DocumentPreset`], so the
//! loader never deals with version-specific rows. Fields the CLI does not use
//! (`pinned`, `colors`, `color`) are intentionally not declared: they stay in
//! the file and are skipped while reading.

use processor::search::filter::SearchFilter;
use serde::Deserialize;
use serde_json::Value;

use super::PresetError;

/// Preset content of any supported document version, with the version-specific
/// row shapes flattened.
#[derive(Debug)]
pub(super) struct DocumentPreset {
    /// Name the preset carries in the document.
    pub(super) name: String,
    /// Filter rows in document order.
    pub(super) filters: Vec<FilterRow>,
    /// Chart definitions, kept only to report them as ignored.
    pub(super) search_values: Vec<SearchFilter>,
}

/// Filter row of a v2 document, and the normalized row of every version.
#[derive(Debug, Deserialize)]
pub(super) struct FilterRow {
    /// Filter definition to match with.
    pub(super) filter: SearchFilter,
    /// Whether the row is switched on in the preset.
    pub(super) enabled: bool,
}

/// Chart row of a v2 document; only its definition is read.
#[derive(Deserialize)]
struct SearchValueRow {
    filter: SearchFilter,
}

/// Root of a v1 preset document.
#[derive(Deserialize)]
struct V1Document {
    presets: Vec<V1Preset>,
}

/// Preset of a v1 document, storing bare filter definitions.
#[derive(Deserialize)]
struct V1Preset {
    name: String,
    #[serde(default)]
    filters: Vec<SearchFilter>,
    #[serde(default)]
    search_values: Vec<SearchFilter>,
}

/// Root of a v2 preset document.
#[derive(Deserialize)]
struct V2Document {
    presets: Vec<V2Preset>,
}

/// Preset of a v2 document, storing filter and chart rows.
#[derive(Deserialize)]
struct V2Preset {
    name: String,
    #[serde(default)]
    filters: Vec<FilterRow>,
    #[serde(default)]
    search_values: Vec<SearchValueRow>,
}

/// Validates the document envelope and reads the presets of the matching version.
pub(super) fn parse_presets(text: &str) -> Result<Vec<DocumentPreset>, PresetError> {
    let root = match serde_json::from_str(text)? {
        // The legacy Chipmunk V3 export is the only preset document with an
        // array root, so the root shape alone identifies it.
        Value::Array(_) => return Err(PresetError::LegacyExport),
        Value::Object(root) => root,
        _ => {
            return Err(PresetError::UnknownKind {
                kind: String::new(),
            });
        }
    };

    /// Document kind every versioned preset export carries.
    const DOCUMENT_KIND: &str = "chipmunk_named_presets";

    let kind = root.get("kind").and_then(Value::as_str).unwrap_or_default();
    if kind != DOCUMENT_KIND {
        return Err(PresetError::UnknownKind {
            kind: kind.to_owned(),
        });
    }

    let version = root
        .get("version")
        .and_then(Value::as_u64)
        .unwrap_or_default();
    let root = Value::Object(root);
    let presets = match version {
        1 => {
            let document: V1Document = serde_json::from_value(root)?;
            document
                .presets
                .into_iter()
                .map(DocumentPreset::from)
                .collect()
        }
        2 => {
            let document: V2Document = serde_json::from_value(root)?;
            document
                .presets
                .into_iter()
                .map(DocumentPreset::from)
                .collect()
        }
        version => return Err(PresetError::UnsupportedVersion { version }),
    };

    Ok(presets)
}

impl From<V1Preset> for DocumentPreset {
    fn from(value: V1Preset) -> Self {
        Self {
            name: value.name,
            // V1 documents store no row state; every filter counts as active.
            filters: value
                .filters
                .into_iter()
                .map(|filter| FilterRow {
                    filter,
                    enabled: true,
                })
                .collect(),
            search_values: value.search_values,
        }
    }
}

impl From<V2Preset> for DocumentPreset {
    fn from(value: V2Preset) -> Self {
        Self {
            name: value.name,
            filters: value.filters,
            search_values: value
                .search_values
                .into_iter()
                .map(|row| row.filter)
                .collect(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{PresetError, parse_presets};

    #[test]
    fn rejects_unknown_kind() {
        let error =
            parse_presets(r#"{"kind":"something_else","version":2,"presets":[]}"#).unwrap_err();

        assert!(matches!(error, PresetError::UnknownKind { .. }));
    }

    #[test]
    fn rejects_unsupported_version() {
        let error = parse_presets(r#"{"kind":"chipmunk_named_presets","version":3,"presets":[]}"#)
            .unwrap_err();

        assert!(matches!(
            error,
            PresetError::UnsupportedVersion { version: 3 }
        ));
    }
}
