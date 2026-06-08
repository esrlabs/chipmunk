//! Version 1 preset document import compatibility.
//!
//! Unlike v2, v1 stores only filter/search-value definitions. Row enabled
//! state and colors are not present, so conversion immediately applies runtime
//! default row state.
//!
//!
//! V1 import shape:
//! ```json
//! {
//!   "kind": "chipmunk_named_presets",
//!   "version": 1,
//!   "presets": [
//!     {
//!       "name": "...",
//!       "filters": [ { "value": "search", "is_regex": true, "ignore_case": true, "is_word": false } ],
//!       "search_values": [ { "value": "time=([\\d.]{1,})", "is_regex": true, "ignore_case": true, "is_word": false } ]
//!     }
//!   ]
//! }
//! ```

use processor::search::filter::SearchFilter;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::host::ui::registry::presets::Preset;

use super::{validate_filter_entry, validate_name, validate_search_value_entry};

/// Preset payload stored in v1 preset documents.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct DocumentPreset {
    name: String,
    filters: Vec<SearchFilter>,
    search_values: Vec<SearchFilter>,
}

#[derive(Debug, Serialize, Deserialize)]
struct PresetDocument {
    kind: String,
    version: u8,
    presets: Vec<DocumentPreset>,
}

/// Parses a v1 document object into runtime presets with default row state.
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

    for filter in filters {
        validate_filter_entry(name, filter)?;
    }

    for search_value in search_values {
        validate_search_value_entry(name, search_value)?;
    }

    Ok(())
}

impl From<DocumentPreset> for Preset {
    fn from(value: DocumentPreset) -> Self {
        Preset::with_default_state(
            Uuid::new_v4(),
            value.name,
            value.filters,
            value.search_values,
        )
    }
}

#[cfg(test)]
mod tests {
    use processor::search::filter::SearchFilter;

    use crate::host::{
        common::colors, message::ImportFormat, service::presets_io::import_named_presets,
        ui::registry::presets::Preset,
    };

    fn plain(value: &str) -> SearchFilter {
        SearchFilter::plain(value).ignore_case(true)
    }

    fn regex(value: &str) -> SearchFilter {
        SearchFilter::plain(value).regex(true).ignore_case(true)
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
    fn import_v1_document_uses_default_state() {
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
        assert!(report.warnings.is_empty());
        assert_eq!(
            filter_definitions(preset),
            vec![plain("error"), plain("error")]
        );
        assert!(preset.filters.iter().all(|entry| entry.enabled));
        assert_eq!(preset.filters[0].colors, colors::FILTER_HIGHLIGHT_COLORS[0]);
        assert_eq!(preset.filters[1].colors, colors::FILTER_HIGHLIGHT_COLORS[1]);
        assert_eq!(
            search_value_definitions(preset),
            vec![regex("duration=(\\d+)"), regex("duration=(\\d+)")]
        );
        assert!(preset.search_values.iter().all(|entry| entry.enabled));
        assert_eq!(preset.search_values[0].color, colors::search_value_color(0));
        assert_eq!(preset.search_values[1].color, colors::search_value_color(1));
    }
}
