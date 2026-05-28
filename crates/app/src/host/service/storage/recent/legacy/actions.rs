//! Legacy recent-action source and parser conversion.

use std::{
    ops::Not,
    path::{Path, PathBuf},
};

use serde_json::{Map, Value, from_value};

use stypes::{
    DltParserSettings, FileFormat, MulticastInfo, ParserType, PluginParserGeneralSettings,
    PluginParserSettings, ProcessTransportConfig, SerialTransportConfig, SomeIpParserSettings,
    TCPTransportConfig, Transport, UDPTransportConfig,
};

use crate::host::{
    common::parsers::ParserNames,
    ui::storage::recent::session::{RecentSessionSnapshot, RecentSessionSource},
};

/// Normalized source shape for conservative recent-action/history matching.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MatchSource {
    /// One or more normalized file paths.
    Files(Vec<String>),
    /// Process command source identity.
    Process {
        /// Process command line.
        command: String,
        /// Optional working directory.
        cwd: Option<String>,
    },
    /// TCP stream source identity.
    Tcp {
        /// TCP bind address.
        bind_addr: String,
    },
    /// UDP stream source identity.
    Udp {
        /// UDP bind address.
        bind_addr: String,
    },
    /// Serial stream source identity.
    Serial {
        /// Optional serial port path.
        path: Option<String>,
    },
}

/// Converts one legacy recent-action payload into a native recent-session snapshot.
pub fn parse_recent_action(content: &Value) -> Result<RecentSessionSnapshot, String> {
    let observe = content
        .get("observe")
        .ok_or_else(|| String::from("missing observe payload"))?;
    let origin = observe
        .get("origin")
        .ok_or_else(|| String::from("missing origin"))?;
    let parser = observe
        .get("parser")
        .ok_or_else(|| String::from("missing parser"))?;

    let sources = parse_sources(origin)?;
    if sources.is_empty() {
        return Err(String::from("empty sources"));
    }

    let parser = parse_parser(parser)?;

    let last_opened = content
        .pointer("/stat/last")
        .and_then(Value::as_u64)
        .ok_or_else(|| String::from("missing timestamp"))?
        / 1000;
    Ok(RecentSessionSnapshot::new(
        last_opened,
        sources,
        parser,
        Default::default(),
    ))
}

/// Converts a legacy origin object into ordered native recent-session sources.
pub fn parse_sources(origin: &Value) -> Result<Vec<RecentSessionSource>, String> {
    let (variant, payload) =
        single_variant(origin).ok_or_else(|| String::from("invalid origin"))?;

    match variant {
        "File" => parse_file_source(payload).map(|source| vec![source]),
        "Concat" => payload
            .as_array()
            .ok_or_else(|| String::from("invalid concat source"))?
            .iter()
            .map(parse_file_source)
            .collect(),
        "Stream" => parse_stream_source(payload).map(|source| vec![source]),
        other => Err(format!("unsupported origin {other}")),
    }
}

fn parse_file_source(payload: &Value) -> Result<RecentSessionSource, String> {
    let (format, path) = if let Some(items) = payload.as_array() {
        let format = items
            .get(1)
            .and_then(Value::as_str)
            .ok_or_else(|| String::from("missing file format"))?;
        let path = items
            .get(2)
            .and_then(Value::as_str)
            .ok_or_else(|| String::from("missing file path"))?;
        (parse_file_format(format)?, PathBuf::from(path))
    } else if let Some(object) = payload.as_object() {
        let format = string_field(object, &["format", "file_format", "f"])
            .ok_or_else(|| String::from("missing file format"))?;
        let path = path_from_object(object).ok_or_else(|| String::from("missing file path"))?;
        (parse_file_format(format)?, path)
    } else {
        return Err(String::from("invalid file source"));
    };

    Ok(RecentSessionSource::File { format, path })
}

fn parse_file_format(format: &str) -> Result<FileFormat, String> {
    match format {
        "PcapNG" => Ok(FileFormat::PcapNG),
        "PcapLegacy" => Ok(FileFormat::PcapLegacy),
        "Text" => Ok(FileFormat::Text),
        "Binary" => Ok(FileFormat::Binary),
        "ParserPlugin" => Err(String::from("ParserPlugin file sources are not supported")),
        other => Err(format!("unsupported file format {other}")),
    }
}

fn parse_stream_source(payload: &Value) -> Result<RecentSessionSource, String> {
    if let Some((variant, config)) = single_variant(payload) {
        return parse_stream_variant(variant, config);
    }

    if let Some(items) = payload.as_array() {
        if let Some((variant, config)) = items.iter().find_map(single_variant) {
            return parse_stream_variant(variant, config);
        }
        if let (Some(kind), Some(config)) = (items.get(1).and_then(Value::as_str), items.get(2)) {
            return parse_stream_variant(kind, config);
        }
    }

    if let Some(object) = payload.as_object()
        && let Some(kind) = string_field(object, &["kind", "type", "transport"])
    {
        return parse_stream_variant(kind, payload);
    }

    Err(String::from("invalid stream source"))
}

fn parse_stream_variant(variant: &str, payload: &Value) -> Result<RecentSessionSource, String> {
    let payload = stream_config_payload(payload);
    let transport = match variant {
        "Process" => Transport::Process(parse_process_config(payload)?),
        "TCP" => Transport::TCP(TCPTransportConfig {
            bind_addr: parse_bind_addr(payload)?,
        }),
        "UDP" => Transport::UDP(UDPTransportConfig {
            bind_addr: parse_bind_addr(payload)?,
            multicast: parse_multicast(payload),
        }),
        "Serial" => Transport::Serial(parse_serial_config(payload)?),
        other => return Err(format!("unsupported stream source {other}")),
    };

    Ok(RecentSessionSource::Stream { transport })
}

fn stream_config_payload(payload: &Value) -> &Value {
    payload
        .as_array()
        .and_then(|items| items.get(1))
        .unwrap_or(payload)
}

fn parse_process_config(payload: &Value) -> Result<ProcessTransportConfig, String> {
    if let Some(command) = payload.as_str() {
        return Ok(ProcessTransportConfig {
            cwd: PathBuf::new(),
            command: command.to_owned(),
            shell: None,
        });
    }

    let object = payload
        .as_object()
        .ok_or_else(|| String::from("invalid process source"))?;
    let command = string_field(object, &["command", "cmd"])
        .ok_or_else(|| String::from("missing process command"))?
        .to_owned();
    let cwd = string_field(object, &["cwd", "working_dir", "workdir"])
        .map(PathBuf::from)
        .unwrap_or_default();

    Ok(ProcessTransportConfig {
        cwd,
        command,
        shell: None,
    })
}

fn parse_bind_addr(payload: &Value) -> Result<String, String> {
    if let Some(bind_addr) = payload.as_str() {
        return Ok(bind_addr.to_owned());
    }

    let object = payload
        .as_object()
        .ok_or_else(|| String::from("invalid network source"))?;
    string_field(
        object,
        &["bind_addr", "bindAddr", "bind", "addr", "address"],
    )
    .map(str::to_owned)
    .ok_or_else(|| String::from("missing bind address"))
}

fn parse_multicast(payload: &Value) -> Vec<MulticastInfo> {
    let Some(object) = payload.as_object() else {
        return Vec::new();
    };

    object
        .get("multicast")
        .or_else(|| object.get("multicast_addr"))
        .or_else(|| object.get("multicastAddr"))
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    if let Some(multiaddr) = item.as_str() {
                        return Some(MulticastInfo {
                            multiaddr: multiaddr.to_owned(),
                            interface: None,
                        });
                    }

                    let item = item.as_object()?;
                    let multiaddr = string_field(item, &["multiaddr", "multi_addr", "addr"])?;
                    let interface = string_field(item, &["interface", "iface"]).map(str::to_owned);
                    Some(MulticastInfo {
                        multiaddr: multiaddr.to_owned(),
                        interface,
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

fn parse_serial_config(payload: &Value) -> Result<SerialTransportConfig, String> {
    if let Some(path) = payload.as_str() {
        return Ok(default_serial_config(path.to_owned()));
    }

    let object = payload
        .as_object()
        .ok_or_else(|| String::from("invalid serial source"))?;
    let path = string_field(object, &["path", "port"])
        .ok_or_else(|| String::from("missing serial path"))?
        .to_owned();

    Ok(SerialTransportConfig {
        path,
        baud_rate: u32_field(object, &["baud_rate", "baudRate"]).unwrap_or(9600),
        data_bits: u8_field(object, &["data_bits", "dataBits"]).unwrap_or(8),
        flow_control: u8_field(object, &["flow_control", "flowControl"]).unwrap_or(0),
        parity: u8_field(object, &["parity"]).unwrap_or(0),
        stop_bits: u8_field(object, &["stop_bits", "stopBits"]).unwrap_or(1),
        send_data_delay: u8_field(object, &["send_data_delay", "sendDataDelay"]).unwrap_or(0),
        exclusive: bool_field(object, &["exclusive"]).unwrap_or(false),
    })
}

fn default_serial_config(path: String) -> SerialTransportConfig {
    SerialTransportConfig {
        path,
        baud_rate: 9600,
        data_bits: 8,
        flow_control: 0,
        parity: 0,
        stop_bits: 1,
        send_data_delay: 0,
        exclusive: false,
    }
}

fn parse_parser(parser: &Value) -> Result<ParserType, String> {
    let (variant, payload) =
        single_variant(parser).ok_or_else(|| String::from("invalid parser"))?;

    match variant {
        "Text" => Ok(ParserType::Text(())),
        "Dlt" => Ok(ParserType::Dlt(parse_dlt_settings(payload))),
        "SomeIp" => Ok(ParserType::SomeIp(parse_someip_settings(payload))),
        "Plugin" => parse_plugin_settings(payload).map(ParserType::Plugin),
        other => Err(format!("unsupported parser {other}")),
    }
}

/// Extracts the parser kind used for history matching.
pub fn parse_parser_name(parser: &Value) -> Option<ParserNames> {
    if let Some(name) = parser.as_str() {
        return parser_name_from_name(name);
    }

    single_variant(parser).and_then(|(variant, _)| parser_name_from_name(variant))
}

fn parser_name_from_name(name: &str) -> Option<ParserNames> {
    match name {
        "Text" => Some(ParserNames::Text),
        "Dlt" => Some(ParserNames::Dlt),
        "SomeIp" => Some(ParserNames::SomeIP),
        "Plugin" => Some(ParserNames::Plugins),
        _ => None,
    }
}

fn parse_dlt_settings(payload: &Value) -> DltParserSettings {
    let Some(object) = payload.as_object() else {
        return DltParserSettings::default();
    };

    DltParserSettings {
        filter_config: object
            .get("filter_config")
            .and_then(|value| from_value(value.clone()).ok()),
        fibex_file_paths: string_vec_field(object, &["fibex_file_paths", "fibexFilePaths"]),
        with_storage_header: bool_field(object, &["with_storage_header", "withStorageHeader"])
            .unwrap_or(DltParserSettings::default().with_storage_header),
        tz: string_field(object, &["tz"]).map(str::to_owned),
        fibex_metadata: None,
    }
}

fn parse_someip_settings(payload: &Value) -> SomeIpParserSettings {
    let fibex_file_paths = payload
        .as_object()
        .and_then(|object| string_vec_field(object, &["fibex_file_paths", "fibexFilePaths"]));

    SomeIpParserSettings { fibex_file_paths }
}

fn parse_plugin_settings(payload: &Value) -> Result<PluginParserSettings, String> {
    let object = payload
        .as_object()
        .ok_or_else(|| String::from("invalid plugin parser settings"))?;
    let plugin_path = string_field(object, &["plugin_path", "pluginPath", "path"])
        .ok_or_else(|| String::from("missing plugin path"))?;
    let plugin_configs = object
        .get("plugin_configs")
        .or_else(|| object.get("pluginConfigs"))
        .and_then(|value| from_value(value.clone()).ok())
        .unwrap_or_default();

    let settings = PluginParserSettings {
        plugin_path: PathBuf::from(plugin_path),
        general_settings: PluginParserGeneralSettings::default(),
        plugin_configs,
    };

    Ok(settings)
}

/// Converts a legacy stream descriptor into the normalized matching shape.
pub fn parse_stream_match(value: &Value) -> Option<MatchSource> {
    let stream = value.get("Stream").unwrap_or(value);
    let (variant, payload) = single_variant(stream).unwrap_or_else(|| {
        let kind = stream
            .as_object()
            .and_then(|object| string_field(object, &["kind", "type", "transport"]))
            .unwrap_or("");
        (kind, stream)
    });

    let payload = stream_config_payload(payload);
    match variant {
        "Process" => {
            let transport = parse_process_config(payload).ok()?;
            Some(MatchSource::Process {
                command: transport.command,
                cwd: path_to_match_string(&transport.cwd),
            })
        }
        "TCP" => parse_bind_addr(payload)
            .ok()
            .map(|bind_addr| MatchSource::Tcp { bind_addr }),
        "UDP" => parse_bind_addr(payload)
            .ok()
            .map(|bind_addr| MatchSource::Udp { bind_addr }),
        "Serial" => parse_serial_config(payload)
            .ok()
            .map(|config| MatchSource::Serial {
                path: Some(config.path),
            }),
        _ => None,
    }
}

/// Converts native sources into the normalized matching shape.
pub fn match_source_from_sources(sources: &[RecentSessionSource]) -> Option<MatchSource> {
    match sources.first()? {
        RecentSessionSource::File { .. } => sources
            .iter()
            .map(|source| match source {
                RecentSessionSource::File { path, .. } => Some(normalize_path(path)),
                RecentSessionSource::Stream { .. } => None,
            })
            .collect::<Option<Vec<_>>>()
            .map(MatchSource::Files),
        RecentSessionSource::Stream { transport } if sources.len() == 1 => match transport {
            Transport::Process(config) => Some(MatchSource::Process {
                command: config.command.clone(),
                cwd: path_to_match_string(&config.cwd),
            }),
            Transport::TCP(config) => Some(MatchSource::Tcp {
                bind_addr: config.bind_addr.clone(),
            }),
            Transport::UDP(config) => Some(MatchSource::Udp {
                bind_addr: config.bind_addr.clone(),
            }),
            Transport::Serial(config) => Some(MatchSource::Serial {
                path: Some(config.path.clone()),
            }),
        },
        RecentSessionSource::Stream { .. } => None,
    }
}

/// Returns whether the source shape can safely retain imported bookmarks.
pub fn supports_bookmarks(sources: &[RecentSessionSource]) -> bool {
    matches!(sources.first(), Some(RecentSessionSource::File { .. }))
}

fn single_variant(value: &Value) -> Option<(&str, &Value)> {
    let object = value.as_object()?;
    if object.len() != 1 {
        return None;
    }

    object
        .iter()
        .next()
        .map(|(key, value)| (key.as_str(), value))
}

/// Reconstructs a legacy path from direct or parent/name fields.
pub fn path_from_object(object: &Map<String, Value>) -> Option<PathBuf> {
    if let Some(path) = string_field(object, &["path", "file", "filename"]) {
        return Some(PathBuf::from(path));
    }

    let name = string_field(object, &["n", "name"])?;
    let parent = string_field(object, &["p", "parent", "parent_path"]);
    Some(match parent {
        Some(parent) if !parent.is_empty() => PathBuf::from(parent).join(name),
        _ => PathBuf::from(name),
    })
}

/// Normalizes paths only for case-insensitive legacy matching.
pub fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().to_lowercase()
}

fn path_to_match_string(path: &Path) -> Option<String> {
    path.as_os_str()
        .is_empty()
        .not()
        .then(|| path.to_string_lossy().into_owned())
}

fn string_field<'a>(object: &'a Map<String, Value>, keys: &[&str]) -> Option<&'a str> {
    keys.iter()
        .find_map(|key| object.get(*key).and_then(Value::as_str))
}

fn string_vec_field(object: &Map<String, Value>, keys: &[&str]) -> Option<Vec<String>> {
    keys.iter()
        .find_map(|key| object.get(*key))
        .and_then(|value| {
            value.as_array().map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_owned)
                    .collect::<Vec<_>>()
            })
        })
}

fn bool_field(object: &Map<String, Value>, keys: &[&str]) -> Option<bool> {
    keys.iter()
        .find_map(|key| object.get(*key))
        .and_then(|value| bool_from_value(Some(value)))
}

/// Reads legacy boolean flags that may be stored as booleans or numeric values.
pub fn bool_from_value(value: Option<&Value>) -> Option<bool> {
    value.and_then(|value| match value {
        Value::Bool(value) => Some(*value),
        Value::Number(value) => value.as_u64().map(|value| value != 0),
        _ => None,
    })
}

fn u32_field(object: &Map<String, Value>, keys: &[&str]) -> Option<u32> {
    keys.iter()
        .find_map(|key| object.get(*key))
        .and_then(Value::as_u64)
        .and_then(|value| u32::try_from(value).ok())
}

fn u8_field(object: &Map<String, Value>, keys: &[&str]) -> Option<u8> {
    keys.iter()
        .find_map(|key| object.get(*key))
        .and_then(Value::as_u64)
        .and_then(|value| u8::try_from(value).ok())
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use serde_json::json;
    use stypes::{FileFormat, ParserType, Transport};

    use super::*;

    fn action(origin: Value, parser: Value) -> Value {
        json!({
            "stat": { "last": 1_700_000_123_456_u64 },
            "observe": {
                "origin": origin,
                "parser": parser,
            }
        })
    }

    fn text_parser() -> Value {
        json!({ "Text": null })
    }

    #[test]
    fn imports_file_text_action() {
        let snapshot = parse_recent_action(&action(
            json!({ "File": ["source-id", "Text", "/logs/app.log"] }),
            text_parser(),
        ))
        .expect("file action should import");

        assert_eq!(snapshot.last_opened, 1_700_000_123);
        assert!(matches!(snapshot.parser, ParserType::Text(())));
        assert!(matches!(
            &snapshot.sources()[0],
            RecentSessionSource::File { format: FileFormat::Text, path }
                if path == &PathBuf::from("/logs/app.log")
        ));
    }

    #[test]
    fn imports_concat_preserving_order() {
        let snapshot = parse_recent_action(&action(
            json!({
                "Concat": [
                    ["first", "Text", "/logs/first.log"],
                    ["second", "Binary", "/logs/second.bin"]
                ]
            }),
            text_parser(),
        ))
        .expect("concat action should import");

        let paths = snapshot
            .sources()
            .iter()
            .map(|source| match source {
                RecentSessionSource::File { path, .. } => path.clone(),
                RecentSessionSource::Stream { .. } => panic!("expected file source"),
            })
            .collect::<Vec<_>>();

        assert_eq!(
            paths,
            vec![
                PathBuf::from("/logs/first.log"),
                PathBuf::from("/logs/second.bin")
            ]
        );
    }

    #[test]
    fn imports_stream_actions() {
        let process = parse_recent_action(&action(
            json!({ "Stream": { "Process": { "command": "journalctl -f", "cwd": "/tmp" } } }),
            text_parser(),
        ))
        .expect("process action should import");
        let tcp = parse_recent_action(&action(
            json!({ "Stream": { "TCP": { "bind_addr": "127.0.0.1:5000" } } }),
            text_parser(),
        ))
        .expect("tcp action should import");
        let udp = parse_recent_action(&action(
            json!({
                "Stream": {
                    "UDP": {
                        "bind_addr": "0.0.0.0:5001",
                        "multicast": [{ "multiaddr": "239.0.0.1", "interface": "eth0" }]
                    }
                }
            }),
            text_parser(),
        ))
        .expect("udp action should import");
        let serial = parse_recent_action(&action(
            json!({ "Stream": { "Serial": { "path": "/dev/ttyUSB0", "baud_rate": 115200 } } }),
            text_parser(),
        ))
        .expect("serial action should import");

        assert!(matches!(
            &process.sources()[0],
            RecentSessionSource::Stream { transport: Transport::Process(config) }
                if config.command == "journalctl -f" && config.cwd.as_path() == Path::new("/tmp")
        ));
        assert!(matches!(
            &tcp.sources()[0],
            RecentSessionSource::Stream { transport: Transport::TCP(config) }
                if config.bind_addr == "127.0.0.1:5000"
        ));
        assert!(matches!(
            &udp.sources()[0],
            RecentSessionSource::Stream { transport: Transport::UDP(config) }
                if config.bind_addr == "0.0.0.0:5001"
                    && config.multicast.len() == 1
                    && config.multicast[0].multiaddr == "239.0.0.1"
                    && config.multicast[0].interface.as_deref() == Some("eth0")
        ));
        assert!(matches!(
            &serial.sources()[0],
            RecentSessionSource::Stream { transport: Transport::Serial(config) }
                if config.path == "/dev/ttyUSB0" && config.baud_rate == 115200
        ));
    }

    #[test]
    fn imports_parser_settings() {
        let dlt = parse_recent_action(&action(
            json!({ "File": ["source-id", "PcapNG", "/logs/trace.pcapng"] }),
            json!({ "Dlt": { "fibex_file_paths": ["/fibex/a.xml"], "with_storage_header": false, "tz": "UTC" } }),
        ))
        .expect("dlt parser should import");
        let someip = parse_recent_action(&action(
            json!({ "File": ["source-id", "PcapNG", "/logs/someip.pcapng"] }),
            json!({ "SomeIp": { "fibex_file_paths": ["/fibex/someip.xml"] } }),
        ))
        .expect("someip parser should import");
        let plugin = parse_recent_action(&action(
            json!({ "File": ["source-id", "Text", "/logs/plugin.log"] }),
            json!({ "Plugin": { "plugin_path": "/plugins/parser.wasm", "plugin_configs": [] } }),
        ))
        .expect("plugin parser should import");

        assert!(matches!(
            dlt.parser,
            ParserType::Dlt(settings)
                if settings.fibex_file_paths == Some(vec![String::from("/fibex/a.xml")])
                    && !settings.with_storage_header
                    && settings.tz.as_deref() == Some("UTC")
                    && settings.fibex_metadata.is_none()
        ));
        assert!(matches!(
            someip.parser,
            ParserType::SomeIp(settings)
                if settings.fibex_file_paths == Some(vec![String::from("/fibex/someip.xml")])
        ));
        assert!(matches!(
            plugin.parser,
            ParserType::Plugin(settings)
                if settings.plugin_path.as_path() == Path::new("/plugins/parser.wasm")
                    && settings.general_settings.placeholder.is_empty()
                    && settings.plugin_configs.is_empty()
        ));
    }

    #[test]
    fn skips_unsupported_and_malformed_actions() {
        assert!(
            parse_recent_action(&action(
                json!({ "File": ["source-id", "ParserPlugin", "/logs/plugin.bin"] }),
                text_parser(),
            ))
            .is_err()
        );
        assert!(parse_recent_action(&json!({ "stat": { "last": 12 } })).is_err());
    }
}
