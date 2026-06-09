//! Legacy history definition, collection, and state import.

use std::{collections::HashSet, path::Path};

use log::warn;
use serde_json::{Map, Value};

use processor::search::filter::SearchFilter;

use crate::host::{
    common::{
        colors::{StoredColorPair, StoredRgba},
        parsers::ParserNames,
    },
    ui::storage::recent::session::{
        RecentFilterSnapshot, RecentSearchValueSnapshot, RecentSessionSource,
        RecentSessionStateSnapshot,
    },
};

use super::{
    LegacyStorageEntry,
    actions::{
        MatchSource, bool_from_value, match_source_from_sources, normalize_path, parse_parser_name,
        parse_sources, parse_stream_match, path_from_object, supports_bookmarks,
    },
    history_collections_path, history_definitions_path, load_optional_entries,
};

/// Parsed legacy history data used to attach saved state to imported actions.
#[derive(Debug, Default)]
pub struct LegacyHistory {
    definitions: Vec<HistoryDefinition>,
    collections: Vec<HistoryCollection>,
}

/// Restorable legacy session identity: source shape plus parser kind.
#[derive(Debug)]
struct HistoryDefinition {
    uuid: String,
    source: MatchSource,
    parser: ParserNames,
}

/// Legacy saved state linked to one or more history definitions.
#[derive(Debug)]
struct HistoryCollection {
    relation_ids: HashSet<String>,
    last_used: u64,
    state: RecentSessionStateSnapshot,
    skipped_entries: usize,
}

/// Returns usable history definitions, skipping malformed or unsupported entries.
fn parse_history_definitions(entries: Vec<LegacyStorageEntry>) -> Vec<HistoryDefinition> {
    let mut definitions = Vec::new();

    for entry in entries {
        let content = match entry.content_json() {
            Ok(content) => content,
            Err(err) => {
                warn!("Skipping malformed legacy history definition content: {err}");
                continue;
            }
        };

        let Some(definition) = parse_history_definition(&entry.uuid, &content) else {
            warn!(
                "Skipping unsupported legacy history definition {}",
                entry.uuid
            );
            continue;
        };
        definitions.push(definition);
    }

    definitions
}

/// Parses one history definition, returning `None` when source or parser identity is unsupported.
fn parse_history_definition(uuid: &str, content: &Value) -> Option<HistoryDefinition> {
    let origin = content
        .pointer("/observe/origin")
        .or_else(|| content.get("origin"))
        .or_else(|| content.get("source"));
    let source = origin
        .and_then(|origin| parse_sources(origin).ok())
        .as_deref()
        .and_then(match_source_from_sources)
        .or_else(|| parse_definition_source(content))?;

    let parser = content
        .pointer("/observe/parser")
        .or_else(|| content.get("parser"))
        .or_else(|| content.get("parser_kind"))
        .or_else(|| content.get("parserKind"))
        .and_then(parse_parser_name)?;

    let definition = HistoryDefinition {
        uuid: uuid.to_owned(),
        source,
        parser,
    };

    Some(definition)
}

/// Extracts a matchable source from a definition, returning `None` for unsupported shapes.
fn parse_definition_source(content: &Value) -> Option<MatchSource> {
    if let Some(object) = content.as_object() {
        if let Some(path) = path_from_object(object) {
            let path = normalize_path(&path);
            return Some(MatchSource::Files(vec![path]));
        }

        if let Some(files) = object
            .get("files")
            .or_else(|| object.get("Concat"))
            .and_then(Value::as_array)
        {
            let paths = files
                .iter()
                .filter_map(parse_definition_path)
                .collect::<Vec<_>>();
            if !paths.is_empty() {
                return Some(MatchSource::Files(paths));
            }
        }
    }

    parse_stream_match(content)
}

/// Extracts one normalized definition path, returning `None` when no path is present.
fn parse_definition_path(value: &Value) -> Option<String> {
    if let Some(path) = value.as_str() {
        return Some(path.to_lowercase());
    }

    value
        .as_object()
        .and_then(path_from_object)
        .map(|path| normalize_path(&path))
}

/// Returns usable history collections, skipping malformed or unsupported entries.
fn parse_history_collections(entries: Vec<LegacyStorageEntry>) -> Vec<HistoryCollection> {
    let mut collections = Vec::new();

    for entry in entries {
        let content = match entry.content_json() {
            Ok(content) => content,
            Err(err) => {
                warn!("Skipping malformed legacy history collection content: {err}");
                continue;
            }
        };

        let Some(collection) = parse_history_collection(&content) else {
            warn!(
                "Skipping unsupported legacy history collection {}",
                entry.uuid
            );
            continue;
        };
        collections.push(collection);
    }

    collections
}

/// Parses one history collection, returning `None` when it has no related definitions.
fn parse_history_collection(content: &Value) -> Option<HistoryCollection> {
    let relation_ids = relation_ids(content);
    if relation_ids.is_empty() {
        return None;
    }

    let last_used = content.get("l").and_then(Value::as_u64).unwrap_or(0);
    let mut state = RecentSessionStateSnapshot::default();
    let skipped_entries = content
        .get("e")
        .map(|entries| parse_collection_entries(entries, &mut state))
        .unwrap_or(0);

    Some(HistoryCollection {
        relation_ids,
        last_used,
        state,
        skipped_entries,
    })
}

/// Returns all definition relation ids found in a history collection.
fn relation_ids(content: &Value) -> HashSet<String> {
    let mut ids = HashSet::new();
    let Some(object) = content.as_object() else {
        return ids;
    };

    for key in [
        "d",
        "definitions",
        "definition_uuids",
        "definitionUuids",
        "relations",
        "r",
    ] {
        if let Some(values) = object.get(key).and_then(Value::as_array) {
            ids.extend(values.iter().filter_map(Value::as_str).map(str::to_owned));
        }
    }

    for key in [
        "origin_definition_uuid",
        "originDefinitionUuid",
        "origin_definition",
        "originDefinition",
        "definition",
        "o",
    ] {
        if let Some(value) = object.get(key) {
            if let Some(id) = value.as_str() {
                ids.insert(id.to_owned());
            } else if let Some(id) = value.get("uuid").and_then(Value::as_str) {
                ids.insert(id.to_owned());
            }
        }
    }

    ids
}

/// Imports collection entries into state and returns the number of skipped entries.
fn parse_collection_entries(entries: &Value, state: &mut RecentSessionStateSnapshot) -> usize {
    if let Some(object) = entries.as_object() {
        return parse_collection_entry_object(object, state);
    }

    let Some(items) = entries.as_array() else {
        return 1;
    };

    items
        .iter()
        .map(|item| {
            if let Some(object) = item.as_object() {
                parse_collection_entry_object(object, state)
            } else {
                1
            }
        })
        .sum()
}

/// Imports one collection entry object into state and returns the number of skipped values.
fn parse_collection_entry_object(
    object: &Map<String, Value>,
    state: &mut RecentSessionStateSnapshot,
) -> usize {
    let mut skipped = 0usize;

    let entry_type = object.get("type").and_then(Value::as_str);
    for (key, value) in object {
        match key.as_str() {
            "filters" => skipped += parse_filters(value, true, &mut state.filters),
            "charts" => skipped += parse_charts(value, true, &mut state.search_values),
            "bookmark" | "bookmarks" => skipped += parse_bookmarks(value, &mut state.bookmarks),
            "disabled" => skipped += parse_disabled(value, state),
            "type" => {}
            _ => match entry_type {
                Some("filters") => skipped += parse_filters(value, true, &mut state.filters),
                Some("charts") => skipped += parse_charts(value, true, &mut state.search_values),
                Some("bookmark") => skipped += parse_bookmarks(value, &mut state.bookmarks),
                _ => {}
            },
        }
    }

    skipped
}

/// Imports filter entries into `output` and returns the number of skipped entries.
fn parse_filters(
    value: &Value,
    default_enabled: bool,
    output: &mut Vec<RecentFilterSnapshot>,
) -> usize {
    parse_one_or_many(value, |item| parse_filter(item, default_enabled), output)
}

/// Imports chart search-value entries into `output` and returns the number of skipped entries.
fn parse_charts(
    value: &Value,
    default_enabled: bool,
    output: &mut Vec<RecentSearchValueSnapshot>,
) -> usize {
    parse_one_or_many(value, |item| parse_chart(item, default_enabled), output)
}

/// Parses either one legacy entry or an array, returning the number of skipped items.
fn parse_one_or_many<T>(
    value: &Value,
    mut parse: impl FnMut(&Value) -> Option<T>,
    output: &mut Vec<T>,
) -> usize {
    if let Some(items) = value.as_array() {
        let initial_len = output.len();
        output.extend(items.iter().filter_map(&mut parse));
        items.len() - (output.len() - initial_len)
    } else if let Some(item) = parse(value) {
        output.push(item);
        0
    } else {
        1
    }
}

/// Parses one filter snapshot, returning `None` when filter text is missing.
fn parse_filter(value: &Value, default_enabled: bool) -> Option<RecentFilterSnapshot> {
    let filter_value = value.get("filter").unwrap_or(value);
    let text = if let Some(text) = filter_value.as_str() {
        text
    } else {
        filter_value
            .get("filter")
            .or_else(|| filter_value.get("text"))
            .and_then(Value::as_str)?
    };

    let reg = bool_from_value(filter_value.get("reg")).unwrap_or(false);
    let word = bool_from_value(filter_value.get("word")).unwrap_or(false);
    let cases = bool_from_value(filter_value.get("cases")).unwrap_or(false);
    let enabled = bool_from_value(value.get("active"))
        .or_else(|| bool_from_value(filter_value.get("active")))
        .unwrap_or(default_enabled);

    let colors =
        parse_legacy_filter_colors(value).or_else(|| parse_legacy_filter_colors(filter_value));

    let snapshot = RecentFilterSnapshot {
        filter: SearchFilter::plain(text)
            .regex(reg)
            .word(word)
            .ignore_case(!cases),
        enabled,
        colors,
    };

    Some(snapshot)
}

/// Parses one chart search-value snapshot, returning `None` when filter text is missing.
fn parse_chart(value: &Value, default_enabled: bool) -> Option<RecentSearchValueSnapshot> {
    let chart_value = value.get("chart").unwrap_or(value);
    let text = chart_value
        .get("filter")
        .or_else(|| chart_value.get("text"))
        .and_then(Value::as_str)
        .or_else(|| chart_value.as_str())?;
    let enabled = bool_from_value(value.get("active"))
        .or_else(|| bool_from_value(chart_value.get("active")))
        .unwrap_or(default_enabled);

    let color = parse_legacy_chart_color(value).or_else(|| parse_legacy_chart_color(chart_value));

    let snapshot = RecentSearchValueSnapshot {
        filter: SearchFilter::plain(text).regex(true).ignore_case(true),
        enabled,
        color,
    };

    Some(snapshot)
}

fn parse_legacy_filter_colors(value: &Value) -> Option<StoredColorPair> {
    let colors = value.get("colors")?.as_object()?;
    let fg = colors.get("color")?.as_str()?;
    let bg = colors.get("background")?.as_str()?;

    let color_pair = StoredColorPair {
        fg: parse_legacy_hex_rgba(fg)?,
        bg: parse_legacy_hex_rgba(bg)?,
    };

    Some(color_pair)
}

fn parse_legacy_chart_color(value: &Value) -> Option<StoredRgba> {
    let color = value.get("color")?.as_str()?;
    parse_legacy_hex_rgba(color)
}

/// Parses the only legacy color format this importer supports: `#RRGGBB`.
fn parse_legacy_hex_rgba(value: &str) -> Option<StoredRgba> {
    let bytes = value.as_bytes();
    if bytes.len() != 7 || bytes[0] != b'#' {
        return None;
    }

    let red = parse_hex_byte(&bytes[1..3])?;
    let green = parse_hex_byte(&bytes[3..5])?;
    let blue = parse_hex_byte(&bytes[5..7])?;

    Some([red, green, blue, 255])
}

fn parse_hex_byte(pair: &[u8]) -> Option<u8> {
    let [high, low] = pair else {
        return None;
    };
    let high = hex_value(*high)?;
    let low = hex_value(*low)?;

    Some((high << 4) | low)
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

/// Imports bookmark positions into `output` and returns the number of skipped entries.
fn parse_bookmarks(value: &Value, output: &mut Vec<u64>) -> usize {
    parse_one_or_many(
        value,
        |item| {
            item.as_u64()
                .or_else(|| item.get("position").and_then(Value::as_u64))
        },
        output,
    )
}

/// Imports disabled filters or charts into state and returns the number of skipped entries.
fn parse_disabled(value: &Value, state: &mut RecentSessionStateSnapshot) -> usize {
    if let Some(items) = value.as_array() {
        return items.iter().map(|item| parse_disabled(item, state)).sum();
    }

    let Some(object) = value.as_object() else {
        return 1;
    };

    let mut skipped = 0usize;
    if let Some(filters) = object.get("filters").or_else(|| object.get("filter")) {
        let first_added = state.filters.len();
        skipped += parse_filters(filters, false, &mut state.filters);
        for filter in &mut state.filters[first_added..] {
            filter.enabled = false;
        }
    }
    if let Some(charts) = object.get("charts").or_else(|| object.get("chart")) {
        let first_added = state.search_values.len();
        skipped += parse_charts(charts, false, &mut state.search_values);
        for chart in &mut state.search_values[first_added..] {
            chart.enabled = false;
        }
    }

    if skipped == 0
        && !object.contains_key("filters")
        && !object.contains_key("filter")
        && !object.contains_key("charts")
        && !object.contains_key("chart")
    {
        skipped = 1;
    }

    skipped
}

impl LegacyHistory {
    /// Loads optional legacy history files and returns usable parsed state.
    pub fn load(home_dir: &Path) -> Self {
        let definitions_path = history_definitions_path(home_dir);
        let definitions = match load_optional_entries(&definitions_path) {
            Ok(entries) => parse_history_definitions(entries),
            Err(err) => {
                warn!("Skipping malformed legacy history definitions: {err}");
                Vec::new()
            }
        };

        let collections_path = history_collections_path(home_dir);
        let collections = match load_optional_entries(&collections_path) {
            Ok(entries) => parse_history_collections(entries),
            Err(err) => {
                warn!("Skipping malformed legacy history collections: {err}");
                Vec::new()
            }
        };

        let skipped_entries = collections
            .iter()
            .map(|collection| collection.skipped_entries)
            .sum::<usize>();
        if skipped_entries > 0 {
            warn!("Skipped {skipped_entries} malformed legacy history entries");
        }

        Self {
            definitions,
            collections,
        }
    }

    /// Finds the newest matching collection state, or `None` when no definition matches.
    pub fn state_for(
        &self,
        sources: &[RecentSessionSource],
        parser: ParserNames,
    ) -> Option<RecentSessionStateSnapshot> {
        let source = match_source_from_sources(sources)?;
        let definition_ids = self
            .definitions
            .iter()
            .filter(|definition| definition.parser == parser && definition.source == source)
            .map(|definition| definition.uuid.as_str())
            .collect::<HashSet<_>>();

        if definition_ids.is_empty() {
            return None;
        }

        self.collections
            .iter()
            .filter(|collection| {
                collection
                    .relation_ids
                    .iter()
                    .any(|id| definition_ids.contains(id.as_str()))
            })
            .max_by_key(|collection| collection.last_used)
            .map(|collection| {
                let mut state = collection.state.clone();
                if !supports_bookmarks(sources) {
                    state.bookmarks.clear();
                }
                state
            })
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use serde_json::json;
    use stypes::{FileFormat, TCPTransportConfig, Transport};

    use super::*;

    /// Verifies that matching history returns the newest related collection state.
    #[test]
    fn maps_history_state_from_newest_matching_collection() {
        let sources = vec![RecentSessionSource::File {
            format: FileFormat::Text,
            path: PathBuf::from("/LOGS/App.log"),
        }];
        let history = LegacyHistory {
            definitions: vec![HistoryDefinition {
                uuid: String::from("definition-id"),
                source: MatchSource::Files(vec![String::from("/logs/app.log")]),
                parser: ParserNames::Text,
            }],
            collections: vec![
                HistoryCollection {
                    relation_ids: HashSet::from([String::from("definition-id")]),
                    last_used: 1,
                    state: RecentSessionStateSnapshot {
                        filters: vec![RecentFilterSnapshot {
                            filter: SearchFilter::plain("old"),
                            enabled: true,
                            colors: None,
                        }],
                        ..Default::default()
                    },
                    skipped_entries: 0,
                },
                HistoryCollection {
                    relation_ids: HashSet::from([String::from("definition-id")]),
                    last_used: 2,
                    state: parsed_state(json!({
                        "filters": [{
                            "filter": { "filter": "level=(warn|error)", "reg": true, "word": true, "cases": true },
                            "colors": { "color": "#010203", "background": "#040506" }
                        }],
                        "charts": [{ "filter": "cpu=(\\d+)", "color": "#070809" }],
                        "disabled": [
                            { "filter": { "filter": "disabled filter", "active": true } },
                            { "chart": { "filter": "disabled chart", "active": true } }
                        ],
                        "bookmark": [{ "position": 42 }]
                    })),
                    skipped_entries: 0,
                },
            ],
        };

        let state = history
            .state_for(&sources, ParserNames::Text)
            .expect("history should match");

        assert_eq!(state.filters.len(), 2);
        let imported_filter = state
            .filters
            .iter()
            .find(|filter| filter.filter.value == "level=(warn|error)")
            .expect("enabled filter should be imported");
        assert!(imported_filter.filter.is_regex());
        assert!(imported_filter.filter.is_word());
        assert!(!imported_filter.filter.is_ignore_case());
        assert!(imported_filter.enabled);
        let expected_colors = StoredColorPair {
            fg: [1, 2, 3, 255],
            bg: [4, 5, 6, 255],
        };
        assert_eq!(imported_filter.colors, Some(expected_colors));
        let disabled_filter = state
            .filters
            .iter()
            .find(|filter| filter.filter.value == "disabled filter")
            .expect("disabled filter should be imported");
        assert!(!disabled_filter.enabled);

        assert_eq!(state.search_values.len(), 2);
        let imported_chart = state
            .search_values
            .iter()
            .find(|chart| chart.filter.value == "cpu=(\\d+)")
            .expect("enabled chart should be imported");
        assert!(imported_chart.filter.is_regex());
        assert!(imported_chart.filter.is_ignore_case());
        assert!(imported_chart.enabled);
        assert_eq!(imported_chart.color, Some([7, 8, 9, 255]));
        let disabled_chart = state
            .search_values
            .iter()
            .find(|chart| chart.filter.value == "disabled chart")
            .expect("disabled chart should be imported");
        assert!(!disabled_chart.enabled);
        assert_eq!(state.bookmarks, vec![42]);
    }

    #[test]
    fn missing_or_invalid_colors_do_not_skip_entries() {
        let state = parsed_state(json!({
            "filters": [
                { "filter": { "filter": "missing colors" } },
                {
                    "filter": { "filter": "invalid colors" },
                    "colors": { "color": "#010203", "background": "not-a-color" }
                }
            ],
            "charts": [
                { "filter": "missing=(\\d+)" },
                { "filter": "invalid=(\\d+)", "color": "#123" }
            ],
        }));

        assert_eq!(state.filters.len(), 2);
        assert!(state.filters.iter().all(|filter| filter.colors.is_none()));
        assert_eq!(state.search_values.len(), 2);
        assert!(
            state
                .search_values
                .iter()
                .all(|chart| chart.color.is_none())
        );
    }

    /// Verifies that stream history returns state with bookmarks removed.
    #[test]
    fn does_not_attach_bookmarks_to_stream_history() {
        let sources = vec![RecentSessionSource::Stream {
            transport: Transport::TCP(TCPTransportConfig {
                bind_addr: String::from("127.0.0.1:5000"),
            }),
        }];
        let history = LegacyHistory {
            definitions: vec![HistoryDefinition {
                uuid: String::from("definition-id"),
                source: MatchSource::Tcp {
                    bind_addr: String::from("127.0.0.1:5000"),
                },
                parser: ParserNames::Text,
            }],
            collections: vec![HistoryCollection {
                relation_ids: HashSet::from([String::from("definition-id")]),
                last_used: 1,
                state: RecentSessionStateSnapshot {
                    bookmarks: vec![7],
                    ..Default::default()
                },
                skipped_entries: 0,
            }],
        };

        let state = history
            .state_for(&sources, ParserNames::Text)
            .expect("history should match");

        assert!(state.bookmarks.is_empty());
    }

    /// Verifies that unmatched history returns no state.
    #[test]
    fn leaves_history_empty_without_matching_definition() {
        let history = LegacyHistory {
            definitions: vec![HistoryDefinition {
                uuid: String::from("definition-id"),
                source: MatchSource::Files(vec![String::from("/logs/other.log")]),
                parser: ParserNames::Text,
            }],
            collections: vec![HistoryCollection {
                relation_ids: HashSet::from([String::from("definition-id")]),
                last_used: 1,
                state: RecentSessionStateSnapshot {
                    bookmarks: vec![7],
                    ..Default::default()
                },
                skipped_entries: 0,
            }],
        };
        let sources = vec![RecentSessionSource::File {
            format: FileFormat::Text,
            path: PathBuf::from("/logs/app.log"),
        }];

        assert!(history.state_for(&sources, ParserNames::Text).is_none());
    }

    /// Parses test entries into state and asserts that no entries were skipped.
    fn parsed_state(entries: Value) -> RecentSessionStateSnapshot {
        let mut state = RecentSessionStateSnapshot::default();
        let skipped = parse_collection_entries(&entries, &mut state);
        assert_eq!(skipped, 0);
        state
    }
}
