#[cfg(feature = "rustcore")]
mod converting;
#[cfg(feature = "rustcore")]
mod extending;
#[cfg(feature = "nodejs")]
mod nodejs;
#[cfg(test)]
mod proptest;

use std::ops::RangeInclusive;

#[cfg(feature = "rustcore")]
pub use extending::*;

use crate::*;
use dlt_core::filtering::DltFilterConfig;

#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "observe.ts")
)]
/// Описывает операцию, которая должна быть произведена
pub enum SessionAction {
    File(PathBuf),
    Files(Vec<PathBuf>),
    ExportRaw(Vec<PathBuf>, Vec<RangeInclusive<u64>>, PathBuf),
    Source,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "observe.ts")
)]
pub enum ComponentDef {
    Source(ComponentOptions),
    Parser(ComponentOptions),
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "observe.ts")
)]
pub struct SessionSetup {
    pub origin: SessionAction,
    pub parser: ComponentOptions,
    pub source: ComponentOptions,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "observe.ts")
)]
pub struct SessionDescriptor {
    pub parser: Ident,
    pub source: Ident,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "observe.ts")
)]
pub struct IdentList(pub Vec<Ident>);

#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "observe.ts")
)]
pub struct Ident {
    pub name: String,
    pub desc: String,
    pub io: IODataType,
    pub uuid: Uuid,
}

/// Represents the type of a component within the system.
///
/// The component type indicates the general domain of responsibility and
/// functional role of the component. It is used to categorize components
/// according to their purpose in the data processing pipeline.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, PartialOrd, Ord, Eq, Hash)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "observe.ts")
)]
pub enum ComponentType {
    /// A standard parser used during session processing.
    ///
    /// These parsers transform raw input data into a structured representation
    /// that can be stored in session files and later viewed or analyzed by the user.
    Parser,

    /// A data source component.
    ///
    /// Responsible for providing input data to the system, such as reading from
    /// a file, a network stream, or another external interface.
    Source,
}

/// Multicast configuration information.
/// - `multiaddr`: A valid multicast address.
/// - `interface`: The address of the local interface used to join the multicast group.
///   If set to `INADDR_ANY`, the system selects an appropriate interface.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "observe.ts")
)]
pub struct MulticastInfo {
    pub multiaddr: String,
    pub interface: Option<String>,
}

/// Configuration for UDP connections.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "observe.ts")
)]
pub struct UdpConnectionInfo {
    /// A list of multicast addresses to listen on.
    pub multicast_addr: Vec<MulticastInfo>,
}

/// Specifies the parser to be used for processing session data.
#[allow(clippy::large_enum_variant)]
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "observe.ts")
)]
pub enum ParserType {
    /// DLT parser for files (including PCAP files) or streams (TCP/UDP).
    Dlt(DltParserSettings),
    /// SomeIp parser for streams (TCP/UDP) or PCAP/PCAPNG files.
    SomeIp(SomeIpParserSettings),
    /// A pseudo-parser for reading plain text data without processing.
    Text(()),
    /// Parser using plugins system.
    Plugin(PluginParserSettings),
}

/// Settings for the DLT parser.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "observe.ts")
)]
pub struct DltParserSettings {
    /// Configuration for filtering DLT messages.
    #[cfg_attr(all(test, feature = "test_and_gen"), ts(type = "DltFilterConfig"))]
    pub filter_config: Option<DltFilterConfig>,
    /// Paths to FIBEX files for additional interpretation of `payload` content.
    pub fibex_file_paths: Option<Vec<String>>,
    /// Indicates whether the source contains a `StorageHeader`. Set to `true` if applicable.
    pub with_storage_header: bool,
    /// Timezone for timestamp adjustment. If specified, timestamps are converted to this timezone.
    pub tz: Option<String>,
    /// Internal field that stores FIBEX schema metadata. Not exposed to the client.
    #[serde(skip)]
    pub fibex_metadata: Option<dlt_core::fibex::FibexMetadata>,
}

/// Settings for the SomeIp parser.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "observe.ts")
)]
pub struct SomeIpParserSettings {
    /// Paths to FIBEX files for additional interpretation of `payload` content.
    pub fibex_file_paths: Option<Vec<String>>,
}

/// Describes the transport source for a session.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "observe.ts")
)]
pub enum Transport {
    /// Terminal command execution.
    Process(ProcessTransportConfig),
    /// TCP connection.
    TCP(TCPTransportConfig),
    /// UDP connection.
    UDP(UDPTransportConfig),
    /// Serial port connection.
    Serial(SerialTransportConfig),
}

/// Configuration for executing terminal commands.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "observe.ts")
)]
pub struct ProcessTransportConfig {
    /// The working directory for the command.
    pub cwd: PathBuf,
    /// The command to execute.
    pub command: String,
    /// Environment variables. If empty, the default environment variables are used.
    #[cfg_attr(all(test, feature = "test_and_gen"), ts(type = "Map<string, string>"))]
    pub envs: HashMap<String, String>,
}

/// Configuration for serial port connections.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "observe.ts")
)]
pub struct SerialTransportConfig {
    /// The path to the serial port.
    pub path: String,
    /// The baud rate for the connection.
    pub baud_rate: u32,
    /// The number of data bits per frame.
    pub data_bits: u8,
    /// The flow control setting.
    pub flow_control: u8,
    /// The parity setting.
    pub parity: u8,
    /// The number of stop bits.
    pub stop_bits: u8,
    /// The delay in sending data, in milliseconds.
    pub send_data_delay: u8,
    /// Whether the connection is exclusive.
    pub exclusive: bool,
}

/// Configuration for TCP connections.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "observe.ts")
)]
pub struct TCPTransportConfig {
    /// The address to bind the TCP connection to.
    pub bind_addr: String,
}

/// Configuration for UDP connections.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "observe.ts")
)]
pub struct UDPTransportConfig {
    /// The address to bind the UDP connection to.
    pub bind_addr: String,
    /// A list of multicast configurations.
    pub multicast: Vec<MulticastInfo>,
}

/// Supported file formats for observation.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "observe.ts")
)]
pub enum FileFormat {
    PcapNG,
    PcapLegacy,
    Text,
    Binary,
}

/// Describes the source of data for observation.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "observe.ts")
)]
pub enum ObserveOrigin {
    /// The source is a single file.
    File(String, FileFormat, PathBuf),
    /// The source is multiple files concatenated into a session.
    Concat(Vec<(String, FileFormat, PathBuf)>),
    /// The source is a stream.
    Stream(String, Transport),
}

/// Options for observing data within a session.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "observe.ts")
)]
pub struct ObserveOptions {
    /// The description of the data source.
    pub origin: ObserveOrigin,
    /// The parser configuration to be applied.
    pub parser: ParserType,
}
