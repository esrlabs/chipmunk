//! Service-side import and export for named preset documents.
//!
//! This module owns the versioned on-disk JSON schema, parses the legacy export
//! shape for backward compatibility, and validates imported filters before the
//! UI applies them into the runtime preset registry.

mod legacy;
mod v1;
mod v2;

use std::fmt;

use serde_json::Value;

use processor::search::filter::SearchFilter;

use crate::{
    common::validation::{ValidationEligibility, validate_filter, validate_search_value_filter},
    host::{message::ImportFormat, ui::registry::presets::Preset},
};

/// Document kind written during serialization and required during import to
/// recognize preset files.
pub const DOCUMENT_KIND: &str = "chipmunk_named_presets";

/// Document version written during serialization and checked during import for
/// schema compatibility.
pub const DOCUMENT_VERSION: u8 = 2;

/// Result returned after parsing a preset file successfully.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportReport {
    /// Format detected from the document root shape.
    pub format: ImportFormat,
    /// Imported preset snapshots with fresh runtime ids.
    pub presets: Vec<Preset>,
    /// Non-fatal warnings collected during import.
    pub warnings: Vec<ImportWarning>,
}

/// Non-fatal issues collected while translating a legacy preset export.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ImportWarning {
    /// A legacy collection could not be converted into a preset.
    LegacyCollectionSkipped {
        /// Legacy collection name when one was available.
        collection_name: Option<String>,
        /// Reason the collection could not be imported.
        reason: String,
    },
    /// A legacy collection entry was ignored while its preset was imported.
    LegacyEntryIgnored {
        /// Preset name associated with the ignored entry.
        preset_name: String,
        /// Kind of legacy entry that was ignored.
        entry_kind: LegacyEntryKind,
        /// Number of ignored entries of this kind.
        count: usize,
    },
}

/// Legacy entry kind that was ignored during translation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LegacyEntryKind {
    /// Bookmark entry.
    Bookmark,
    /// Filter entry that could not be parsed or validated.
    InvalidFilter,
    /// Chart entry that could not be parsed or validated.
    InvalidChart,
    /// Legacy entry object key that was not recognized.
    Unsupported(String),
}

/// Validate then serializes a preset snapshot into the versioned named-presets
/// JSON document.
pub fn serialize_named_presets(presets: Vec<Preset>) -> Result<String, String> {
    v2::serialize_presets(presets)
}

/// Parses a versioned preset document or a supported legacy export.
///
/// Returned presets already have fresh runtime ids assigned so the UI can hand
/// them to the registry import path directly.
pub fn import_named_presets(text: &str) -> Result<ImportReport, String> {
    let value = parse_root_value(text)?;
    let (format, presets, warnings) = match value {
        Value::Object(root) => {
            let (format, presets) = parse_versioned_document(root)?;
            (format, presets, Vec::new())
        }
        Value::Array(items) => {
            let (presets, warnings) = legacy::parse_legacy_from_value(items)?;
            (ImportFormat::Legacy, presets, warnings)
        }
        _ => return Err("preset document root must be an object or array".to_owned()),
    };

    let report = ImportReport {
        format,
        presets,
        warnings,
    };

    Ok(report)
}

fn parse_root_value(text: &str) -> Result<Value, String> {
    let trimmed = text.trim_start();
    serde_json::from_str(text).map_err(|err| {
        // The legacy export uses a top-level array while the versioned format uses
        // an object, so the first non-whitespace token is enough to classify
        // syntax failures for the user-facing error.
        if trimmed.starts_with('[') {
            format!("invalid legacy preset export: {err}")
        } else {
            format!("invalid preset document: {err}")
        }
    })
}

fn parse_versioned_document(
    root: serde_json::Map<String, Value>,
) -> Result<(ImportFormat, Vec<Preset>), String> {
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

    match version {
        1 => {
            let presets = v1::parse_document(root)?;
            Ok((ImportFormat::Version1, presets))
        }
        DOCUMENT_VERSION => {
            let presets = v2::parse_document(root)?;
            Ok((ImportFormat::Version2, presets))
        }
        _ => Err(format!("unsupported preset document version: {version}")),
    }
}

/// Validates that a preset name is usable in versioned imports and exports.
pub fn validate_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("preset name cannot be blank".to_owned());
    }
    Ok(())
}

/// Validates a filter row for a named preset.
pub fn validate_filter_entry(preset_name: &str, filter: &SearchFilter) -> Result<(), String> {
    match validate_filter(filter) {
        ValidationEligibility::Eligible => Ok(()),
        ValidationEligibility::Ineligible { reason } => Err(format!(
            "invalid filter in preset '{preset_name}': {reason}"
        )),
    }
}

/// Validates a search-value row for a named preset.
pub fn validate_search_value_entry(preset_name: &str, filter: &SearchFilter) -> Result<(), String> {
    match validate_search_value_filter(filter) {
        ValidationEligibility::Eligible => Ok(()),
        ValidationEligibility::Ineligible { reason } => Err(format!(
            "invalid search value in preset '{preset_name}': {reason}"
        )),
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
    use super::*;

    #[test]
    fn rejects_unsupported_document_kind() {
        import_named_presets(r#"{"kind":"wrong","version":2,"presets":[]}"#).unwrap_err();
    }

    #[test]
    fn rejects_unsupported_document_version() {
        import_named_presets(r#"{"kind":"chipmunk_named_presets","version":3,"presets":[]}"#)
            .unwrap_err();
    }

    #[test]
    fn import_rejects_object_without_document_kind() {
        import_named_presets(r#"{"presets":[]}"#).unwrap_err();
    }
}
