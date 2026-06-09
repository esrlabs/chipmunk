//! Legacy history definition, collection, and state import.
//!
//! Chipmunk 3 stores history separately from recent actions. Recent actions contain the
//! source/parser to reopen, while history definitions and collections contain filters,
//! charts, bookmarks, and disabled search entries. The importer joins them by matching a
//! recent action to a history definition, then applying the newest related collection.
//!
//! The real Chipmunk 3 storage uses compact keys: `f` for file definitions, `c` for
//! concat definitions, `s` for stream definitions, `p` for parser names, and `e` for
//! collection entries. Collection entries also often store the actual filter/chart data
//! as nested JSON strings.
//!
//! This importer intentionally does not reproduce Chipmunk 3 checksum matching. It only
//! matches parser kind plus normalized paths or stream identities, without broad
//! basename/extension fallbacks. That keeps one-time startup import cheap and avoids
//! hashing large files or attaching history too broadly, but anonymized legacy file
//! definitions can miss otherwise valid filters until checksum matching is explicitly
//! added.

use std::{borrow::Cow, collections::HashSet, ops::Not, path::Path};

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
        parse_sources, parse_stream_match, path_from_object, process_cwd_to_match_string,
        supports_bookmarks,
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
        .or_else(|| content.get("p"))
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
        // Chipmunk 3 minified history definitions use compact source keys.
        if let Some(file) = object.get("f")
            && let Some(path) = parse_definition_path(file)
        {
            return Some(MatchSource::Files(vec![path]));
        }

        if let Some(files) = object.get("c").and_then(Value::as_array)
            && let Some(paths) = parse_definition_paths(files)
        {
            return Some(MatchSource::Files(paths));
        }

        if let Some(source) = object.get("s").and_then(parse_minified_stream_match) {
            return Some(source);
        }

        if let Some(path) = path_from_object(object) {
            let path = normalize_path(&path);
            return Some(MatchSource::Files(vec![path]));
        }

        if let Some(files) = object
            .get("files")
            .or_else(|| object.get("Concat"))
            .and_then(Value::as_array)
            && let Some(paths) = parse_definition_paths(files)
        {
            return Some(MatchSource::Files(paths));
        }
    }

    parse_stream_match(content)
}

/// Extracts a stream source from a compact Chipmunk 3 stream descriptor.
fn parse_minified_stream_match(value: &Value) -> Option<MatchSource> {
    // Legacy streams store a source kind plus two opaque identity strings. For current
    // native stream types, `ma` maps to the identity used for matching and `mi` is only
    // useful as process cwd.
    let object = value.as_object()?;
    let source = object.get("s").and_then(Value::as_str)?;
    let major = object.get("ma").and_then(Value::as_str).unwrap_or("");
    let minor = object.get("mi").and_then(Value::as_str).unwrap_or("");

    match source {
        "Process" if !major.is_empty() => Some(MatchSource::Process {
            command: major.to_owned(),
            cwd: process_cwd_to_match_string(minor),
        }),
        "TCP" if !major.is_empty() => Some(MatchSource::Tcp {
            bind_addr: major.to_owned(),
        }),
        "UDP" if !major.is_empty() => Some(MatchSource::Udp {
            bind_addr: major.to_owned(),
        }),
        "Serial" if !major.is_empty() => Some(MatchSource::Serial {
            path: Some(major.to_owned()),
        }),
        _ => None,
    }
}

/// Extracts all concat definition paths, rejecting partial or empty path lists.
fn parse_definition_paths(files: &[Value]) -> Option<Vec<String>> {
    let paths = files
        .iter()
        .map(parse_definition_path)
        .collect::<Option<Vec<_>>>()?;
    paths.is_empty().not().then_some(paths)
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
    let decoded = decode_json_string(entries);
    let entries = decoded.as_ref();

    if let Some(object) = entries.as_object() {
        return parse_collection_entry_object(object, state);
    }

    let Some(items) = entries.as_array() else {
        return 1;
    };

    items
        .iter()
        .map(|item| {
            let decoded = decode_json_string(item);
            if let Some(object) = decoded.as_ref().as_object() {
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
    let mut has_named_payload = false;
    for (key, value) in object {
        match key.as_str() {
            "filters" => {
                has_named_payload = true;
                skipped += parse_filters(value, true, &mut state.filters);
            }
            "charts" => {
                has_named_payload = true;
                skipped += parse_charts(value, true, &mut state.search_values);
            }
            "bookmark" | "bookmarks" => {
                has_named_payload = true;
                skipped += parse_bookmarks(value, &mut state.bookmarks);
            }
            "disabled" => {
                has_named_payload = true;
                skipped += parse_disabled(value, state);
            }
            _ => {}
        }
    }

    if !has_named_payload && let Some(entry_type) = entry_type {
        skipped += parse_typed_entry_object(entry_type, object, state);
    }

    skipped
}

/// Imports one typed collection entry envelope into state.
fn parse_typed_entry_object(
    entry_type: &str,
    object: &Map<String, Value>,
    state: &mut RecentSessionStateSnapshot,
) -> usize {
    match entry_type {
        "filters" => {
            if object.contains_key("filter") || object.contains_key("text") {
                let entry = Value::Object(object.clone());
                return parse_filters(&entry, true, &mut state.filters);
            }
            typed_entry_payload(object)
                .map(|value| parse_filters(value, true, &mut state.filters))
                .unwrap_or(0)
        }
        "charts" => {
            if object.contains_key("chart")
                || object.contains_key("filter")
                || object.contains_key("text")
            {
                let entry = Value::Object(object.clone());
                return parse_charts(&entry, true, &mut state.search_values);
            }
            typed_entry_payload(object)
                .map(|value| parse_charts(value, true, &mut state.search_values))
                .unwrap_or(0)
        }
        "bookmark" | "bookmarks" => {
            if object.contains_key("position") {
                let entry = Value::Object(object.clone());
                return parse_bookmarks(&entry, &mut state.bookmarks);
            }
            typed_entry_payload(object)
                .map(|value| parse_bookmarks(value, &mut state.bookmarks))
                .unwrap_or(0)
        }
        _ => 0,
    }
}

/// Returns the payload from a typed collection entry, ignoring envelope metadata.
fn typed_entry_payload(object: &Map<String, Value>) -> Option<&Value> {
    for key in ["value", "payload", "entry", "data"] {
        if let Some(value) = object.get(key) {
            return Some(value);
        }
    }

    let mut payload = None;
    for (key, value) in object {
        if is_typed_entry_metadata(key) {
            continue;
        }
        if payload.is_some() {
            return None;
        }
        payload = Some(value);
    }

    payload
}

fn is_typed_entry_metadata(key: &str) -> bool {
    matches!(
        key,
        "type"
            | "key"
            | "uuid"
            | "id"
            | "name"
            | "active"
            | "enabled"
            | "flags"
            | "colors"
            | "color"
            | "widths"
    )
}

/// Imports filter entries into `output` and returns the number of skipped entries.
fn parse_filters(
    value: &Value,
    default_enabled: bool,
    output: &mut Vec<RecentFilterSnapshot>,
) -> usize {
    let mut parse = |item: &Value| parse_filter(item, default_enabled);
    parse_one_or_many(value, &mut parse, output)
}

/// Imports chart search-value entries into `output` and returns the number of skipped entries.
fn parse_charts(
    value: &Value,
    default_enabled: bool,
    output: &mut Vec<RecentSearchValueSnapshot>,
) -> usize {
    let mut parse = |item: &Value| parse_chart(item, default_enabled);
    parse_one_or_many(value, &mut parse, output)
}

/// Parses either one legacy entry or an array, returning the number of skipped items.
fn parse_one_or_many<T>(
    value: &Value,
    parse: &mut impl FnMut(&Value) -> Option<T>,
    output: &mut Vec<T>,
) -> usize {
    let decoded = decode_json_string(value);
    let value = decoded.as_ref();

    if let Some(items) = value.as_array() {
        items
            .iter()
            .map(|item| parse_one_or_many(item, parse, output))
            .sum()
    } else if let Some(item) = parse(value) {
        output.push(item);
        0
    } else {
        1
    }
}

/// Decodes legacy collection payloads that store the actual entry as a JSON string.
fn decode_json_string(value: &Value) -> Cow<'_, Value> {
    if let Value::String(raw) = value
        && let Ok(decoded) = serde_json::from_str::<Value>(raw)
    {
        return Cow::Owned(decoded);
    }

    Cow::Borrowed(value)
}

/// Parses one filter snapshot, returning `None` when filter text is missing.
fn parse_filter(value: &Value, default_enabled: bool) -> Option<RecentFilterSnapshot> {
    let decoded = decode_json_string(value);
    let value = decoded.as_ref();
    let filter_value = value.get("filter").unwrap_or(value);
    let text = if let Some(text) = filter_value.as_str() {
        text
    } else {
        filter_value
            .get("filter")
            .or_else(|| filter_value.get("text"))
            .and_then(Value::as_str)?
    };

    // Older entries put flags beside the filter text; newer legacy entries nest them.
    let reg = is_filter_flag_enabled(value, filter_value, "reg");
    let word = is_filter_flag_enabled(value, filter_value, "word");
    let cases = is_filter_flag_enabled(value, filter_value, "cases");
    let enabled = bool_from_value(value.get("active"))
        .or_else(|| bool_from_value(filter_value.get("active")))
        .unwrap_or(default_enabled);

    let colors =
        parse_legacy_filter_colors(value).or_else(|| parse_legacy_filter_colors(filter_value));

    let snapshot = RecentFilterSnapshot {
        filter: SearchFilter::plain(text)
            .regex(reg)
            .word(word)
            // Legacy `cases` means case-sensitive; native storage keeps the inverse flag.
            .ignore_case(!cases),
        enabled,
        colors,
    };

    Some(snapshot)
}

fn is_filter_flag_enabled(value: &Value, filter_value: &Value, key: &str) -> bool {
    bool_from_value(filter_value.get(key))
        .or_else(|| {
            filter_value
                .get("flags")
                .and_then(|flags| bool_from_value(flags.get(key)))
        })
        .or_else(|| bool_from_value(value.get(key)))
        .or_else(|| {
            value
                .get("flags")
                .and_then(|flags| bool_from_value(flags.get(key)))
        })
        .unwrap_or(false)
}

/// Parses one chart search-value snapshot, returning `None` when filter text is missing.
fn parse_chart(value: &Value, default_enabled: bool) -> Option<RecentSearchValueSnapshot> {
    let decoded = decode_json_string(value);
    let value = decoded.as_ref();
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
    let mut parse = |item: &Value| {
        item.as_u64()
            .or_else(|| item.get("position").and_then(Value::as_u64))
    };
    parse_one_or_many(value, &mut parse, output)
}

/// Imports disabled filters or charts into state and returns the number of skipped entries.
fn parse_disabled(value: &Value, state: &mut RecentSessionStateSnapshot) -> usize {
    let decoded = decode_json_string(value);
    let value = decoded.as_ref();

    if let Some(items) = value.as_array() {
        return items.iter().map(|item| parse_disabled(item, state)).sum();
    }

    let Some(object) = value.as_object() else {
        return 1;
    };

    let mut skipped = 0usize;
    if let (Some(key), Some(value)) = (
        object.get("key").and_then(Value::as_str),
        object.get("value"),
    ) {
        // DisabledRequest stores which collection the nested JSON payload came from.
        match key {
            "filters" => {
                let first_added = state.filters.len();
                skipped += parse_filters(value, false, &mut state.filters);
                for filter in &mut state.filters[first_added..] {
                    filter.enabled = false;
                }
                return skipped;
            }
            "charts" => {
                let first_added = state.search_values.len();
                skipped += parse_charts(value, false, &mut state.search_values);
                for chart in &mut state.search_values[first_added..] {
                    chart.enabled = false;
                }
                return skipped;
            }
            _ => {}
        }
    }
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
            // Chipmunk 3 can keep several collections for the same definition set.
            .max_by_key(|collection| collection.last_used)
            .map(|collection| {
                let mut state = collection.state.clone();
                if !supports_bookmarks(sources) {
                    // Legacy bookmarks are line offsets and only make sense for file sessions.
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
    use stypes::{FileFormat, ProcessTransportConfig, TCPTransportConfig, Transport};

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

    #[test]
    fn parses_minified_file_definition() {
        let content = json!({
            "f": {
                "e": ".log",
                "n": "App.log",
                "p": "/LOGS",
                "s": 141,
                "c": 1_729_517_173_233.153_f64,
                "h": "ignored"
            },
            "p": "Text",
            "u": "definition-id"
        });
        let definition =
            parse_history_definition("definition-id", &content).expect("definition should parse");

        assert_eq!(definition.uuid, "definition-id");
        assert_eq!(definition.parser, ParserNames::Text);
        assert_eq!(
            definition.source,
            MatchSource::Files(vec![String::from("/logs/app.log")])
        );
    }

    #[test]
    fn parses_minified_concat_definition() {
        let content = json!({
            "c": [
                { "e": ".log", "n": "First.log", "p": "/LOGS", "h": "a" },
                { "e": ".log", "n": "Second.log", "p": "/LOGS", "h": "b" }
            ],
            "p": "Text",
            "u": "definition-id"
        });
        let definition =
            parse_history_definition("definition-id", &content).expect("definition should parse");

        assert_eq!(definition.parser, ParserNames::Text);
        assert_eq!(
            definition.source,
            MatchSource::Files(vec![
                String::from("/logs/first.log"),
                String::from("/logs/second.log")
            ])
        );
    }

    #[test]
    fn rejects_partial_minified_concat_definition() {
        let content = json!({
            "c": [
                { "e": ".log", "n": "First.log", "p": "/LOGS", "h": "a" },
                { "h": "missing-path" }
            ],
            "p": "Text",
            "u": "definition-id"
        });

        assert!(parse_history_definition("definition-id", &content).is_none());
    }

    #[test]
    fn parses_minified_stream_definition() {
        let content = json!({
            "s": { "s": "TCP", "mi": "", "ma": "127.0.0.1:7777" },
            "p": "Dlt",
            "u": "definition-id"
        });
        let definition =
            parse_history_definition("definition-id", &content).expect("definition should parse");

        assert_eq!(definition.parser, ParserNames::Dlt);
        assert_eq!(
            definition.source,
            MatchSource::Tcp {
                bind_addr: String::from("127.0.0.1:7777")
            }
        );
    }

    #[test]
    fn attaches_minified_file_history_to_matching_recent_source() {
        let definition_content = json!({
            "f": { "e": ".dlt", "n": "images.dlt", "p": "/home/user/Desktop", "h": "ignored" },
            "p": "Dlt",
            "u": "definition-id"
        });
        let definition = parse_history_definition("definition-id", &definition_content)
            .expect("definition should parse");
        let collection_content = json!({
            "r": ["definition-id"],
            "l": 10,
            "e": [{ "filters": { "filter": "log" } }]
        });
        let collection =
            parse_history_collection(&collection_content).expect("collection should parse");
        let history = LegacyHistory {
            definitions: vec![definition],
            collections: vec![collection],
        };
        let sources = vec![RecentSessionSource::File {
            format: FileFormat::Binary,
            path: PathBuf::from("/home/user/Desktop/images.dlt"),
        }];

        let state = history
            .state_for(&sources, ParserNames::Dlt)
            .expect("history should match");

        assert_eq!(state.filters.len(), 1);
        assert_eq!(state.filters[0].filter.value, "log");
    }

    #[test]
    fn imports_flat_filter_flags() {
        let state = parsed_state(json!({
            "filters": [
                {
                    "filter": "nested flags",
                    "flags": { "cases": true, "word": true, "reg": true }
                },
                {
                    "filter": "sibling flags",
                    "cases": true,
                    "word": true,
                    "reg": true
                }
            ]
        }));

        assert_eq!(state.filters.len(), 2);
        for filter in state.filters {
            assert!(filter.filter.is_regex());
            assert!(filter.filter.is_word());
            assert!(!filter.filter.is_ignore_case());
        }
    }

    #[test]
    fn imports_typed_collection_entry_payload_once() {
        let filter = json!({
            "filter": "log",
            "flags": { "cases": false, "word": true, "reg": true },
            "active": true
        });

        let state = parsed_state(json!({
            "type": "filters",
            "key": "filters",
            "value": filter.to_string(),
            "uuid": "entry-id"
        }));

        assert_eq!(state.filters.len(), 1);
        assert_eq!(state.filters[0].filter.value, "log");
        assert!(state.filters[0].filter.is_regex());
        assert!(state.filters[0].filter.is_word());
    }

    #[test]
    fn imports_nested_json_string_collection_entries() {
        let filter = json!({
            "filter": {
                "filter": "log",
                "flags": { "cases": false, "word": true, "reg": true }
            },
            "uuid": "filter-id",
            "active": true,
            "colors": { "color": "#000000", "background": "#e4e15b" }
        });
        let chart = json!({
            "filter": "value=(\\d+)",
            "uuid": "chart-id",
            "active": true,
            "color": "#010203"
        });
        let disabled_filter = json!({
            "key": "filters",
            "value": filter.to_string()
        });

        let state = parsed_state(json!([
            { "filters": filter.to_string() },
            { "charts": chart.to_string() },
            { "bookmark": json!({ "position": 42 }).to_string() },
            { "disabled": disabled_filter.to_string() }
        ]));

        assert_eq!(state.filters.len(), 2);
        let enabled_filter = &state.filters[0];
        assert_eq!(enabled_filter.filter.value, "log");
        assert!(enabled_filter.filter.is_regex());
        assert!(enabled_filter.filter.is_word());
        assert!(enabled_filter.filter.is_ignore_case());
        assert!(enabled_filter.enabled);
        assert_eq!(
            enabled_filter.colors,
            Some(StoredColorPair {
                fg: [0, 0, 0, 255],
                bg: [228, 225, 91, 255]
            })
        );
        assert!(!state.filters[1].enabled);

        assert_eq!(state.search_values.len(), 1);
        assert_eq!(state.search_values[0].filter.value, "value=(\\d+)");
        assert_eq!(state.search_values[0].color, Some([1, 2, 3, 255]));
        assert_eq!(state.bookmarks, vec![42]);
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

    #[test]
    fn matches_process_history_with_trailing_cwd_separator() {
        let sources = vec![RecentSessionSource::Stream {
            transport: Transport::Process(ProcessTransportConfig {
                cwd: PathBuf::from("/home/user/"),
                command: String::from("ls"),
                shell: None,
            }),
        }];
        let relation_ids = HashSet::from([String::from("definition-id")]);
        let state = parsed_state(json!({ "filters": { "filter": "log" } }));
        let history = LegacyHistory {
            definitions: vec![HistoryDefinition {
                uuid: String::from("definition-id"),
                source: MatchSource::Process {
                    command: String::from("ls"),
                    cwd: Some(String::from("/home/user")),
                },
                parser: ParserNames::Text,
            }],
            collections: vec![HistoryCollection {
                relation_ids,
                last_used: 1,
                state,
                skipped_entries: 0,
            }],
        };

        let state = history
            .state_for(&sources, ParserNames::Text)
            .expect("history should match");

        assert_eq!(state.filters.len(), 1);
        assert_eq!(state.filters[0].filter.value, "log");
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

    #[test]
    fn does_not_match_minified_file_definition_by_checksum() {
        // Documents the deliberate no-checksum trade-off in the legacy importer.
        let content = json!({
            "f": {
                "e": ".dlt",
                "n": "anonymized.dlt",
                "p": "/legacy/anonymized",
                "h": "matching-checksum-is-ignored"
            },
            "p": "Dlt",
            "u": "definition-id"
        });
        let definition =
            parse_history_definition("definition-id", &content).expect("definition should parse");
        let relation_ids = HashSet::from([String::from("definition-id")]);
        let state = parsed_state(json!({ "filters": { "filter": "log" } }));
        let history = LegacyHistory {
            definitions: vec![definition],
            collections: vec![HistoryCollection {
                relation_ids,
                last_used: 1,
                state,
                skipped_entries: 0,
            }],
        };
        let sources = vec![RecentSessionSource::File {
            format: FileFormat::Binary,
            path: PathBuf::from("/home/user/images.dlt"),
        }];

        assert!(history.state_for(&sources, ParserNames::Dlt).is_none());
    }

    /// Parses test entries into state and asserts that no entries were skipped.
    fn parsed_state(entries: Value) -> RecentSessionStateSnapshot {
        let mut state = RecentSessionStateSnapshot::default();
        let skipped = parse_collection_entries(&entries, &mut state);
        assert_eq!(skipped, 0);
        state
    }
}
