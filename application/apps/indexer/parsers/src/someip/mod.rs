pub mod options;
use definitions::*;
use std::{
    borrow::Cow,
    cmp::Ordering,
    collections::{HashMap, hash_map::Entry},
    fmt::{self, Display},
    io::{self, Write},
    path::PathBuf,
    sync::Mutex,
};
use stypes::NativeError;

use someip_messages::*;
use someip_payload::{
    fibex::{FibexModel, FibexParser, FibexReader, FibexServiceInterface, FibexTypeDeclaration},
    fibex2som::FibexTypes,
    som::{SOMParser, SOMType},
};

use lazy_static::lazy_static;
use log::{debug, error};
use regex::Regex;
use serde::Serialize;

/// Marker for a column separator in the output string.
const COLUMN_SEP: &str = "\u{0004}"; // EOT
/// Marker for a newline in the output string.
const LINE_SEP: &str = "\u{0006}"; // ACK

/// The most likely minimal bytes count needed to parse a SomeIP message.
const MIN_MSG_LEN: usize = 16;

/// Wrapper for a fibex-model (new-type pattern).
pub struct FibexMetadata {
    model: FibexModel,
    services: Mutex<FibexServiceCache>,
    types: Mutex<FibexTypeCache>,
}

impl FibexMetadata {
    /// Returns a new meta-data from the given fibex-files.
    pub fn from_fibex_files(paths: Vec<PathBuf>) -> Option<Self> {
        let readers: Vec<_> = paths
            .iter()
            .filter_map(|path| FibexReader::from_file(path).ok())
            .collect();

        if !readers.is_empty() {
            return FibexParser::try_parse(readers).map(FibexMetadata::new).ok();
        }

        None
    }

    /// Returns a new meta-data from the given fibex-model.
    pub fn new(mut model: FibexModel) -> Self {
        model.services.sort_by(|a, b| {
            let r = a.service_id.cmp(&b.service_id);
            if Ordering::Equal == r {
                let r = b.major_version.cmp(&b.major_version);
                if Ordering::Equal == r {
                    return b.minor_version.cmp(&a.minor_version);
                }
                return r;
            }
            r
        });

        Self {
            model,
            services: Mutex::new(FibexServiceCache::default()),
            types: Mutex::new(FibexTypeCache::default()),
        }
    }

    /// Returns a SOME/IP service for the given id and matching or latest version, if any.
    pub fn get_service(&self, id: usize, version: usize) -> Option<&FibexServiceInterface> {
        if let Ok(mut lock) = self.services.lock() {
            if let Some(index) = lock.get_service_index(&self.model, id, version) {
                return self.model.services.get(index);
            }
        }

        None
    }

    /// Parses a SOME/IP payload for the given FIBEX type.
    pub fn parse_payload(
        &self,
        fibex_type: &FibexTypeDeclaration,
        payload: &RpcPayload,
    ) -> Option<String> {
        if let Ok(mut lock) = self.types.lock() {
            if let Some(som_type) = lock.get_som_type(fibex_type) {
                match som_type.parse(&mut SOMParser::new(payload).non_strict()) {
                    Ok(_) => {
                        return Some(
                            som_type
                                .to_string()
                                .replace('\n', LINE_SEP)
                                .replace(&" ".repeat(4), "\t"),
                        );
                    }
                    Err(error) => {
                        return Some(format!("'{}' {:02X?}", error, *payload));
                    }
                };
            }
        }

        None
    }
}

unsafe impl Send for FibexMetadata {}
unsafe impl Sync for FibexMetadata {}

/// A cache for service indexes within a model.
#[derive(Default)]
struct FibexServiceCache {
    map: HashMap<(usize, usize), usize>,
}

impl FibexServiceCache {
    fn get_service_index(
        &mut self,
        model: &FibexModel,
        id: usize,
        version: usize,
    ) -> Option<usize> {
        match self.map.entry((id, version)) {
            Entry::Occupied(occupied_index) => Some(*occupied_index.get()),
            Entry::Vacant(vacant_index) => {
                let mut scan = true;
                let mut result: Option<usize> = None;
                for (index, service) in model.services.iter().enumerate() {
                    if service.service_id == id {
                        scan = false;
                        if service.major_version == version {
                            result = Some(index);
                            break;
                        } else if result.is_none() {
                            result = Some(index);
                        }
                    } else if !scan {
                        break;
                    }
                }

                if let Some(index) = result {
                    vacant_index.insert(index);
                };

                result
            }
        }
    }
}

/// A cache for payload types within a model.
#[derive(Default)]
struct FibexTypeCache {
    map: HashMap<String, Box<dyn SOMType>>,
}

impl FibexTypeCache {
    fn get_som_type(&mut self, fibex_type: &FibexTypeDeclaration) -> Option<&mut Box<dyn SOMType>> {
        if !self.map.contains_key(&fibex_type.id) {
            if let Ok(som_type) = FibexTypes::build(fibex_type) {
                self.map.insert(fibex_type.id.clone(), som_type);
            }
        }

        self.map.get_mut(&fibex_type.id)
    }
}

/// A parser for SOME/IP log messages.
pub struct SomeipParser {
    fibex_metadata: Option<FibexMetadata>,
}

impl Default for SomeipParser {
    fn default() -> Self {
        Self::new()
    }
}

impl SomeipParser {
    /// Creates a new parser.
    pub fn new() -> Self {
        SomeipParser {
            fibex_metadata: None,
        }
    }

    /// Creates a new parser with the given files.
    pub fn from_fibex_files(paths: Vec<PathBuf>) -> Self {
        SomeipParser {
            fibex_metadata: FibexMetadata::from_fibex_files(paths),
        }
    }

    /// Parses a SOME/IP message (header and payload) from the given input.
    pub(crate) fn parse_message(
        fibex_metadata: Option<&FibexMetadata>,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<(usize, SomeipLogMessage), ParserError> {
        let time = timestamp.unwrap_or(0);
        match Message::from_slice(input) {
            Ok(Message::Sd(header, payload)) => {
                let len = header.message_len();
                debug!("at {} : SD Message ({} bytes)", time, len);
                Ok((
                    if input.len() - len < Header::LENGTH {
                        input.len()
                    } else {
                        len
                    },
                    SomeipLogMessage::from(
                        sd_message_string(&header, &payload),
                        input[..len].to_vec(),
                    ),
                ))
            }

            Ok(Message::Rpc(header, payload)) => {
                let len = header.message_len();
                debug!("at {} : RPC Message ({:?} bytes)", time, len);
                Ok((
                    if input.len() - len < Header::LENGTH {
                        input.len()
                    } else {
                        len
                    },
                    SomeipLogMessage::from(
                        rpc_message_string(fibex_metadata, &header, &payload),
                        input[..len].to_vec(),
                    ),
                ))
            }

            Ok(Message::CookieClient) => {
                let len = Header::LENGTH;
                debug!("at {} : MCC Message", time);
                Ok((
                    if input.len() - len < Header::LENGTH {
                        input.len()
                    } else {
                        len
                    },
                    SomeipLogMessage::from(
                        String::from("MCC"), // Magic-Cookie-Client
                        input[..len].to_vec(),
                    ),
                ))
            }

            Ok(Message::CookieServer) => {
                let len = Header::LENGTH;
                debug!("at {} : MCS Message", time);
                Ok((
                    if input.len() - len < Header::LENGTH {
                        input.len()
                    } else {
                        len
                    },
                    SomeipLogMessage::from(
                        String::from("MCS"), // Magic-Cookie-Server
                        input[..len].to_vec(),
                    ),
                ))
            }

            Err(e) => match e {
                someip_messages::Error::NotEnoughData { .. } => Err(ParserError::Incomplete),
                e => {
                    let msg = e.to_string();
                    error!("at {} : {}", time, msg);
                    Err(ParserError::Parse(msg))
                }
            },
        }
    }
}

unsafe impl Send for SomeipParser {}
unsafe impl Sync for SomeipParser {}

impl SingleParser<SomeipLogMessage> for SomeipParser {
    const MIN_MSG_LEN: usize = MIN_MSG_LEN;

    fn parse_item(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<(usize, Option<SomeipLogMessage>), ParserError> {
        SomeipParser::parse_message(self.fibex_metadata.as_ref(), input, timestamp)
            .map(|(rest, message)| (rest, Some(message)))
    }
}

unsafe impl Send for SomeipParser {}
unsafe impl Sync for SomeipParser {}

impl Parser for SomeipParser {
    fn parse<'a>(
        &mut self,
        input: &'a [u8],
        timestamp: Option<u64>,
    ) -> Result<(usize, Option<LogRecordOutput<'a>>), ParserError> {
        let (consumed, data) = self.parse_item(input, timestamp)?;
        Ok((
            consumed,
            data.map(|msg| LogRecordOutput::String(msg.to_string())),
        ))
    }
}

fn header_string(header: &Header) -> String {
    format!(
        "{}{COLUMN_SEP}{}{COLUMN_SEP}{}{COLUMN_SEP}{}{COLUMN_SEP}{}{COLUMN_SEP}{}{COLUMN_SEP}{}{COLUMN_SEP}{}",
        header.message_id.service_id,
        header.message_id.method_id,
        header.length,
        header.request_id.client_id,
        header.request_id.session_id,
        header.interface_version,
        u8::from(header.message_type),
        u8::from(header.return_code),
    )
}

fn sd_message_string(header: &Header, payload: &SdPayload) -> String {
    let mut string = format!(
        "SD{}{}{}Flags [{:02X?}]",
        COLUMN_SEP,
        header_string(header),
        COLUMN_SEP,
        payload.flags
    );

    for (i, entry) in payload.entries.iter().enumerate() {
        let (entry_string, entry_options) = match entry {
            SdEntry::FindService(value) => (
                service_entry_string(
                    match value.has_ttl() {
                        true => "Find",
                        false => "Stop-Find",
                    },
                    value,
                ),
                payload.options(i),
            ),
            SdEntry::OfferService(value) => (
                service_entry_string(
                    match value.has_ttl() {
                        true => "Offer",
                        false => "Stop-Offer",
                    },
                    value,
                ),
                payload.options(i),
            ),
            SdEntry::SubscribeEventgroup(value) => (
                eventgroup_entry_string(
                    match value.has_ttl() {
                        true => "Subscribe",
                        false => "Stop-Subscribe",
                    },
                    value,
                ),
                payload.options(i),
            ),
            SdEntry::SubscribeEventgroupAck(value) => (
                eventgroup_entry_string(
                    match value.has_ttl() {
                        true => "Subscribe-Ack",
                        false => "Subscribe-Nack",
                    },
                    value,
                ),
                payload.options(i),
            ),
        };

        string = format!("{string}, {entry_string}");

        for option in entry_options {
            string = format!("{} {}", string, option_string(option));
        }
    }

    string
}

fn service_entry_string(name: &str, entry: &SdServiceEntry) -> String {
    format!(
        "{} {} v{}.{} Inst {}{}",
        name,
        entry.service_id,
        entry.major_version,
        entry.minor_version,
        entry.instance_id,
        match entry.has_ttl() {
            true => Cow::Owned(format!(" Ttl {}", entry.ttl)),
            false => Cow::Borrowed(""),
        }
    )
}

fn eventgroup_entry_string(name: &str, entry: &SdEventgroupEntry) -> String {
    format!(
        "{} {}-{} v{} Inst {}{}",
        name,
        entry.service_id,
        entry.eventgroup_id,
        entry.major_version,
        entry.instance_id,
        match entry.has_ttl() {
            true => Cow::Owned(format!(" Ttl {}", entry.ttl)),
            false => Cow::Borrowed(""),
        }
    )
}

fn option_string(option: &SdEndpointOption) -> String {
    format!(
        "{} {}:{}",
        match option.proto {
            IpProto::UDP => "UDP",
            IpProto::TCP => "TCP",
        },
        option.ip,
        option.port,
    )
}

fn rpc_message_string(
    fibex_metadata: Option<&FibexMetadata>,
    header: &Header,
    payload: &RpcPayload,
) -> String {
    format!(
        "RPC{COLUMN_SEP}{}{COLUMN_SEP}{}",
        header_string(header),
        match fibex_metadata {
            None => {
                format!("{:02X?}", *payload)
            }
            Some(meta_data) => {
                let service_id = header.message_id.service_id as usize;
                let service_version = header.interface_version as usize;
                let method_id = header.message_id.method_id as usize;
                let message_type = header.message_type;

                match meta_data
                    .get_service(service_id, service_version)
                    .map(|service| {
                        let service_name = if service.major_version == service_version {
                            Cow::Borrowed(&service.name)
                        } else {
                            Cow::Owned(format!("{}<{}?>", service.name, service.major_version))
                        };
                        (service, service_name)
                    }) {
                    Some((service, service_name)) => match service.get_method(method_id) {
                        Some(method) => {
                            let payload_string = if payload.is_empty() {
                                Cow::Borrowed("")
                            } else {
                                let fibex_type = match message_type {
                                    MessageType::Request
                                    | MessageType::RequestNoReturn
                                    | MessageType::Notification => method.get_request(),
                                    MessageType::Response => method.get_response(),
                                    _ => None,
                                };

                                fibex_type
                                    .and_then(|f| {
                                        meta_data.parse_payload(f, payload).map(Cow::Owned)
                                    })
                                    .unwrap_or_else(|| format!("{:02X?}", *payload).into())
                            };

                            format!("{}::{} {}", service_name, method.name, payload_string)
                        }
                        None => {
                            format!("{}::UnknownMethod {:02X?}", service_name, *payload)
                        }
                    },
                    None => {
                        format!("UnknownService {:02X?}", *payload)
                    }
                }
            }
        }
    )
}

/// Represents a SOME/IP log message.
#[derive(Serialize)]
pub struct SomeipLogMessage {
    description: String,
    bytes: Vec<u8>,
}

impl SomeipLogMessage {
    /// Creates a new log message for the given values.
    pub fn from(description: String, bytes: Vec<u8>) -> Self {
        SomeipLogMessage { description, bytes }
    }
}

// impl LogMessage for SomeipLogMessage {
//     fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error> {
//         writer.write_all(&self.bytes)?;
//         Ok(self.bytes.len())
//     }
// }

impl Display for SomeipLogMessage {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", self.description)
    }
}

impl fmt::Debug for SomeipLogMessage {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", merge_columns(self.description.as_str()))
    }
}

/// Merges the SOME/IP message columns to a single column with additional info.
fn merge_columns(columns: &str) -> Cow<str> {
    lazy_static! {
        static ref REGEX : Regex = Regex::new(
            &format!("(SD|RPC){COLUMN_SEP}(\\d+){COLUMN_SEP}(\\d+){COLUMN_SEP}(\\d+){COLUMN_SEP}(\\d+){COLUMN_SEP}(\\d+){COLUMN_SEP}(\\d+){COLUMN_SEP}(\\d+){COLUMN_SEP}(\\d+){COLUMN_SEP}(.*)")
            ).unwrap();
    }
    REGEX.replace(columns, "${1} SERV:${2} METH:${3} LENG:${4} CLID:${5} SEID:${6} IVER:${7} MSTP:${8} RETC:${9} ${10}")
}

#[cfg(test)]
mod test {
    use super::*;
    use std::io::BufReader;
    use stringreader::StringReader;

    fn test_metadata() -> FibexMetadata {
        let xml = r#"
            <fx:SERVICE-INTERFACE ID="/SOMEIP/TEST/ServiceInterface_TestService">
                <ho:SHORT-NAME>TestService</ho:SHORT-NAME>
                <fx:SERVICE-IDENTIFIER>259</fx:SERVICE-IDENTIFIER>
                <fx:PACKAGE-REF ID-REF="/SOMEIP/TEST"/>
                <service:API-VERSION>
                    <service:MAJOR>1</service:MAJOR>
                    <service:MINOR>2</service:MINOR>
                </service:API-VERSION>
                <service:EVENTS>
                    <service:EVENT ID="/SOMEIP/TEST/ServiceInterface_TestService/Method_EmptyEvent">
                        <ho:SHORT-NAME>EmptyEvent</ho:SHORT-NAME>
                        <service:METHOD-IDENTIFIER>32772</service:METHOD-IDENTIFIER>
                        <service:CALL-SEMANTIC>FIRE_AND_FORGET</service:CALL-SEMANTIC>
                    </service:EVENT>
                    <service:EVENT ID="/SOMEIP/TEST/ServiceInterface_TestService/Method_TestEvent">
                        <ho:SHORT-NAME>TestEvent</ho:SHORT-NAME>
                        <service:METHOD-IDENTIFIER>32773</service:METHOD-IDENTIFIER>
                        <service:CALL-SEMANTIC>FIRE_AND_FORGET</service:CALL-SEMANTIC>
                        <service:INPUT-PARAMETERS>
                            <service:INPUT-PARAMETER ID="/SOMEIP/TEST/ServiceInterface_TestService/Method_TestEvent/in/Parameter_Value1">
                                <ho:SHORT-NAME>Value1</ho:SHORT-NAME>
                                <fx:DATATYPE-REF ID-REF="/CommonDatatype_UINT8"/>
                                <fx:UTILIZATION>
                                    <fx:IS-HIGH-LOW-BYTE-ORDER>false</fx:IS-HIGH-LOW-BYTE-ORDER>
                                </fx:UTILIZATION>
                                <service:POSITION>0</service:POSITION>
                            </service:INPUT-PARAMETER>
                            <service:INPUT-PARAMETER ID="/SOMEIP/TEST/ServiceInterface_TestService/Method_TestEvent/in/Parameter_Value2">
                                <ho:SHORT-NAME>Value2</ho:SHORT-NAME>
                                <fx:DATATYPE-REF ID-REF="/CommonDatatype_UINT8"/>
                                <fx:UTILIZATION>
                                    <fx:IS-HIGH-LOW-BYTE-ORDER>false</fx:IS-HIGH-LOW-BYTE-ORDER>
                                </fx:UTILIZATION>
                                <service:POSITION>1</service:POSITION>
                            </service:INPUT-PARAMETER>
                        </service:INPUT-PARAMETERS>
                    </service:EVENT>
                </service:EVENTS>
            </fx:SERVICE-INTERFACE>
            <fx:DATATYPE xsi:type="fx:COMMON-DATATYPE-TYPE" ID="/CommonDatatype_UINT8">
                <ho:SHORT-NAME>UINT8</ho:SHORT-NAME>
            </fx:DATATYPE>
        "#;

        FibexMetadata::new(
            FibexParser::parse(vec![
                FibexReader::from_reader(BufReader::new(StringReader::new(xml))).unwrap(),
            ])
            .expect("parse failed"),
        )
    }

    #[test]
    fn parse_error_no_data() {
        let input: &[u8] = &[];

        let mut parser = SomeipParser::new();
        let result = parser.parse_item(input, None);

        match result {
            Err(ParserError::Incomplete) => {}
            Err(err) => panic!("unexpected error: {err}"),
            _ => panic!("unexpected parse result"),
        }
    }

    #[test]
    fn parse_error_malformed_header() {
        let input: &[u8] = &[
            0xFF, 0xFF, 0x00, 0x00, // serviceId(u16), methodId(u16)
            0x00, 0x00, 0x00, 0x0A, // length(u32)
            0xDE, 0xAD, 0xBE, 0xEF, // clientId(u16), sessionId(u16)
            0x01, 0x01, 0x01, 0x00, // proto(u8), version(u8), messageType,(u8) returnCode(u8)
        ];

        let mut parser = SomeipParser::new();
        let result = parser.parse_item(input, None);

        match result {
            Err(ParserError::Incomplete) => {}
            Err(err) => panic!("unexpected error: {err}"),
            _ => panic!("unexpected parse result"),
        }
    }

    #[test]
    fn parse_cookie_client() {
        let input: &[u8] = &[
            0xFF, 0xFF, 0x00, 0x00, // serviceId(u16), methodId(u16)
            0x00, 0x00, 0x00, 0x08, // length(u32)
            0xDE, 0xAD, 0xBE, 0xEF, // clientId(u16), sessionId(u16)
            0x01, 0x01, 0x01, 0x00, // proto(u8), version(u8), messageType,(u8) returnCode(u8)
        ];

        let mut parser = SomeipParser::new();

        let (consumed, message) = parser.parse_item(input, None).unwrap();
        assert_eq!(consumed, input.len());

        if let ParseYield::Message(item) = message.unwrap() {
            assert_eq!("MCC", &format!("{}", item));
            assert_eq!("MCC", &format!("{:?}", item));
        } else {
            panic!("unexpected parse yield");
        }
    }

    #[test]
    fn parse_cookie_server() {
        let input: &[u8] = &[
            0xFF, 0xFF, 0x80, 0x00, // serviceId(u16), methodId(u16)
            0x00, 0x00, 0x00, 0x08, // length(u32)
            0xDE, 0xAD, 0xBE, 0xEF, // clientId(u16), sessionId(u16)
            0x01, 0x01, 0x02, 0x00, // proto(u8), version(u8), messageType,(u8) returnCode(u8)
        ];

        let mut parser = SomeipParser::new();

        let (consumed, message) = parser.parse_item(input, None).unwrap();
        assert_eq!(consumed, input.len());

        if let ParseYield::Message(item) = message.unwrap() {
            assert_eq!("MCS", &format!("{}", item));
            assert_eq!("MCS", &format!("{:?}", item));
        } else {
            panic!("unexpected parse yield");
        }
    }

    #[test]
    fn parse_empty_rpc_message_no_model() {
        let input: &[u8] = &[
            0x01, 0x03, 0x80, 0x04, // serviceId(u16), methodId(u16)
            0x00, 0x00, 0x00, 0x08, // length(u32)
            0x00, 0x01, 0x00, 0x02, // clientId(u16), sessionId(u16)
            0x01, 0x01, 0x02, 0x00, // proto(u8), version(u8), messageType,(u8) returnCode(u8)
        ];

        let mut parser = SomeipParser::new();

        let (consumed, message) = parser.parse_item(input, None).unwrap();
        assert_eq!(consumed, input.len());

        if let ParseYield::Message(item) = message.unwrap() {
            assert_eq!(
                "RPC\u{4}259\u{4}32772\u{4}8\u{4}1\u{4}2\u{4}1\u{4}2\u{4}0\u{4}[]",
                &format!("{}", item)
            );
            assert_eq!(
                "RPC SERV:259 METH:32772 LENG:8 CLID:1 SEID:2 IVER:1 MSTP:2 RETC:0 []",
                &format!("{:?}", item)
            );
        } else {
            panic!("unexpected parse yield");
        }
    }

    #[test]
    fn parse_empty_rpc_message() {
        let input: &[u8] = &[
            0x01, 0x03, 0x80, 0x04, // serviceId(u16), methodId(u16)
            0x00, 0x00, 0x00, 0x08, // length(u32)
            0x00, 0x01, 0x00, 0x02, // clientId(u16), sessionId(u16)
            0x01, 0x01, 0x02, 0x00, // proto(u8), version(u8), messageType,(u8) returnCode(u8)
        ];

        let fibex_metadata = test_metadata();
        let mut parser = SomeipParser {
            fibex_metadata: Some(fibex_metadata),
        };

        let (consumed, message) = parser.parse_item(input, None).unwrap();
        assert_eq!(consumed, input.len());

        if let ParseYield::Message(item) = message.unwrap() {
            assert_eq!(
                "RPC\u{4}259\u{4}32772\u{4}8\u{4}1\u{4}2\u{4}1\u{4}2\u{4}0\u{4}TestService::emptyEvent ",
                &format!("{}", item)
            );
            assert_eq!(
                "RPC SERV:259 METH:32772 LENG:8 CLID:1 SEID:2 IVER:1 MSTP:2 RETC:0 TestService::emptyEvent ",
                &format!("{:?}", item)
            );
        } else {
            panic!("unexpected parse yield");
        }
    }

    #[test]
    fn parse_rpc_message_no_model() {
        let input: &[u8] = &[
            0x01, 0x03, 0x80, 0x05, // serviceId(u16), methodId(u16)
            0x00, 0x00, 0x00, 0x0A, // length(u32)
            0x00, 0x01, 0x00, 0x02, // clientId(u16), sessionId(u16)
            0x01, 0x01, 0x02, 0x00, // proto(u8), version(u8), messageType,(u8) returnCode(u8)
            0x01, 0x02, // payload([u8;2])
        ];

        let mut parser = SomeipParser::new();

        let (consumed, message) = parser.parse_item(input, None).unwrap();
        assert_eq!(consumed, input.len());

        if let ParseYield::Message(item) = message.unwrap() {
            assert_eq!(
                "RPC\u{4}259\u{4}32773\u{4}10\u{4}1\u{4}2\u{4}1\u{4}2\u{4}0\u{4}[01, 02]",
                &format!("{}", item)
            );
            assert_eq!(
                "RPC SERV:259 METH:32773 LENG:10 CLID:1 SEID:2 IVER:1 MSTP:2 RETC:0 [01, 02]",
                &format!("{:?}", item)
            );
        } else {
            panic!("unexpected parse yield");
        }
    }

    #[test]
    fn parse_rpc_message() {
        let input: &[u8] = &[
            0x01, 0x03, 0x80, 0x05, // serviceId(u16), methodId(u16)
            0x00, 0x00, 0x00, 0x0A, // length(u32)
            0x00, 0x01, 0x00, 0x02, // clientId(u16), sessionId(u16)
            0x01, 0x01, 0x02, 0x00, // proto(u8), version(u8), messageType,(u8) returnCode(u8)
            0x01, 0x02, // payload([u8;2])
        ];

        let fibex_metadata = test_metadata();
        let mut parser = SomeipParser {
            fibex_metadata: Some(fibex_metadata),
        };

        let (consumed, message) = parser.parse_item(input, None).unwrap();
        assert_eq!(consumed, input.len());

        if let ParseYield::Message(item) = message.unwrap() {
            assert_eq!(
                "RPC\u{4}259\u{4}32773\u{4}10\u{4}1\u{4}2\u{4}1\u{4}2\u{4}0\u{4}TestService::testEvent {\u{6}\tvalue1 (UINT8) : 1,\u{6}\tvalue2 (UINT8) : 2,\u{6}}",
                &format!("{}", item)
            );
            assert_eq!(
                "RPC SERV:259 METH:32773 LENG:10 CLID:1 SEID:2 IVER:1 MSTP:2 RETC:0 TestService::testEvent {\u{6}\tvalue1 (UINT8) : 1,\u{6}\tvalue2 (UINT8) : 2,\u{6}}",
                &format!("{:?}", item)
            );
        } else {
            panic!("unexpected parse yield");
        }
    }

    #[test]
    fn parse_rpc_message_service_not_found() {
        let input: &[u8] = &[
            0x01, 0x04, 0x80, 0x05, // serviceId(u16), methodId(u16)
            0x00, 0x00, 0x00, 0x0A, // length(u32)
            0x00, 0x01, 0x00, 0x02, // clientId(u16), sessionId(u16)
            0x01, 0x01, 0x02, 0x00, // proto(u8), version(u8), messageType,(u8) returnCode(u8)
            0x01, 0x02, // payload([u8;2])
        ];

        let fibex_metadata = test_metadata();
        let mut parser = SomeipParser {
            fibex_metadata: Some(fibex_metadata),
        };

        let (consumed, message) = parser.parse_item(input, None).unwrap();
        assert_eq!(consumed, input.len());

        if let ParseYield::Message(item) = message.unwrap() {
            assert_eq!(
                "RPC\u{4}260\u{4}32773\u{4}10\u{4}1\u{4}2\u{4}1\u{4}2\u{4}0\u{4}UnknownService [01, 02]",
                &format!("{}", item)
            );
            assert_eq!(
                "RPC SERV:260 METH:32773 LENG:10 CLID:1 SEID:2 IVER:1 MSTP:2 RETC:0 UnknownService [01, 02]",
                &format!("{:?}", item)
            );
        } else {
            panic!("unexpected parse yield");
        }
    }

    #[test]
    fn parse_rpc_message_service_version_not_found() {
        let input: &[u8] = &[
            0x01, 0x03, 0x80, 0x05, // serviceId(u16), methodId(u16)
            0x00, 0x00, 0x00, 0x0A, // length(u32)
            0x00, 0x01, 0x00, 0x02, // clientId(u16), sessionId(u16)
            0x01, 0x03, 0x02, 0x00, // proto(u8), version(u8), messageType,(u8) returnCode(u8)
            0x01, 0x02, // payload([u8;2])
        ];

        let fibex_metadata = test_metadata();
        let mut parser = SomeipParser {
            fibex_metadata: Some(fibex_metadata),
        };

        let (consumed, message) = parser.parse_item(input, None).unwrap();
        assert_eq!(consumed, input.len());

        if let ParseYield::Message(item) = message.unwrap() {
            assert_eq!(
                "RPC\u{4}259\u{4}32773\u{4}10\u{4}1\u{4}2\u{4}3\u{4}2\u{4}0\u{4}TestService<1?>::testEvent {\u{6}\tvalue1 (UINT8) : 1,\u{6}\tvalue2 (UINT8) : 2,\u{6}}",
                &format!("{}", item)
            );
            assert_eq!(
                "RPC SERV:259 METH:32773 LENG:10 CLID:1 SEID:2 IVER:3 MSTP:2 RETC:0 TestService<1?>::testEvent {\u{6}\tvalue1 (UINT8) : 1,\u{6}\tvalue2 (UINT8) : 2,\u{6}}",
                &format!("{:?}", item)
            );
        } else {
            panic!("unexpected parse yield");
        }
    }

    #[test]
    fn parse_rpc_message_method_not_found() {
        let input: &[u8] = &[
            0x01, 0x03, 0x80, 0x06, // serviceId(u16), methodId(u16)
            0x00, 0x00, 0x00, 0x0A, // length(u32)
            0x00, 0x01, 0x00, 0x02, // clientId(u16), sessionId(u16)
            0x01, 0x01, 0x02, 0x00, // proto(u8), version(u8), messageType,(u8) returnCode(u8)
            0x01, 0x02, // payload([u8;2])
        ];

        let fibex_metadata = test_metadata();
        let mut parser = SomeipParser {
            fibex_metadata: Some(fibex_metadata),
        };

        let (consumed, message) = parser.parse_item(input, None).unwrap();
        assert_eq!(consumed, input.len());

        if let ParseYield::Message(item) = message.unwrap() {
            assert_eq!(
                "RPC\u{4}259\u{4}32774\u{4}10\u{4}1\u{4}2\u{4}1\u{4}2\u{4}0\u{4}TestService::UnknownMethod [01, 02]",
                &format!("{}", item)
            );
            assert_eq!(
                "RPC SERV:259 METH:32774 LENG:10 CLID:1 SEID:2 IVER:1 MSTP:2 RETC:0 TestService::UnknownMethod [01, 02]",
                &format!("{:?}", item)
            );
        } else {
            panic!("unexpected parse yield");
        }
    }

    #[test]
    fn parse_rpc_message_invalid_payload() {
        let input: &[u8] = &[
            0x01, 0x03, 0x80, 0x05, // serviceId(u16), methodId(u16)
            0x00, 0x00, 0x00, 0x09, // length(u32)
            0x00, 0x01, 0x00, 0x02, // clientId(u16), sessionId(u16)
            0x01, 0x01, 0x02, 0x00, // proto(u8), version(u8), messageType,(u8) returnCode(u8)
            0x01, // payload([u8;2])
        ];

        let fibex_metadata = test_metadata();
        let mut parser = SomeipParser {
            fibex_metadata: Some(fibex_metadata),
        };

        let (consumed, message) = parser.parse_item(input, None).unwrap();
        assert_eq!(consumed, input.len());

        if let ParseYield::Message(item) = message.unwrap() {
            assert_eq!(
                "RPC\u{4}259\u{4}32773\u{4}9\u{4}1\u{4}2\u{4}1\u{4}2\u{4}0\u{4}TestService::testEvent 'SOME/IP Error: Parser exhausted at offset 1 for Object size 1' [01]",
                &format!("{}", item)
            );
            assert_eq!(
                "RPC SERV:259 METH:32773 LENG:9 CLID:1 SEID:2 IVER:1 MSTP:2 RETC:0 TestService::testEvent 'SOME/IP Error: Parser exhausted at offset 1 for Object size 1' [01]",
                &format!("{:?}", item)
            );
        } else {
            panic!("unexpected parse yield");
        }
    }

    #[test]
    fn parse_empty_sd_message() {
        let input: &[u8] = &[
            0xFF, 0xFF, 0x81, 0x00, // serviceId(u16), methodId(u16)
            0x00, 0x00, 0x00, 0x14, // length(u32)
            0x00, 0x00, 0x00, 0x00, // clientId(u16), sessionId(u16)
            0x01, 0x01, 0x02, 0x00, // proto(u8), version(u8), messageType,(u8) returnCode(u8)
            0xC0, 0x00, 0x00, 0x00, // sdFlags(08), reserved(u24)
            0x00, 0x00, 0x00, 0x00, // entries-length(u32)
            0x00, 0x00, 0x00, 0x00, // options-length(u32)
        ];

        let mut parser = SomeipParser::new();
        let (consumed, message) = parser.parse_item(input, None).unwrap();
        assert_eq!(consumed, input.len());

        if let ParseYield::Message(item) = message.unwrap() {
            assert_eq!(
                "SD\u{4}65535\u{4}33024\u{4}20\u{4}0\u{4}0\u{4}1\u{4}2\u{4}0\u{4}Flags [C0]",
                &format!("{}", item)
            );
            assert_eq!(
                "SD SERV:65535 METH:33024 LENG:20 CLID:0 SEID:0 IVER:1 MSTP:2 RETC:0 Flags [C0]",
                &format!("{:?}", item)
            );
        } else {
            panic!("unexpected parse yield");
        }
    }

    #[test]
    fn parse_sd_message() {
        let input: &[u8] = &[
            0xFF, 0xFF, 0x81, 0x00, // serviceId(u16), methodId(u16)
            0x00, 0x00, 0x00, 0x40, // length(u32)
            0x00, 0x00, 0x00, 0x00, // clientId(u16), sessionId(u16)
            0x01, 0x01, 0x02, 0x00, // proto(u8), version(u8), messageType,(u8) returnCode(u8)
            0xC0, 0x00, 0x00, 0x00, // sdFlags(08), reserved(u24)
            // entries
            0x00, 0x00, 0x00, 0x20, // entries-length(u32)
            // subscribe-eventgroup
            0x06, 0x00, 0x00, 0x00, // entryType(u8), index1(u8), index2,(u8) num1|2(u8)
            0x01, 0x03, 0x00, 0x01, // serviceId(u16), instanceId(u16)
            0x02, 0x00, 0x00, 0x03, // majorVersion(u8), ttl(u24)
            0x00, 0x00, 0x01, 0xC8, // reserved(u16), eventgroupId(u16)
            // subscribe-eventgroup-ack
            0x07, 0x00, 0x00, 0x10, // entryType(u8), index1(u8), index2,(u8) num1|2(u8)
            0x01, 0x03, 0x00, 0x01, // serviceId(u16), instanceId(u16)
            0x02, 0x00, 0x00, 0x03, // majorVersion(u8), ttl(u24)
            0x00, 0x00, 0x01, 0xC8, // reserved(u16), eventgroupId(u16)
            // options
            0x00, 0x00, 0x00, 0x0C, // options-length(u32)
            // ip-4 endpoint
            0x00, 0x09, 0x04, 0x00, // length(u16), optionType(u8), reserved(u8)
            0x7F, 0x00, 0x00, 0x01, // ip4(u32)
            0x00, 0x11, 0x75, 0x30, // reserved(u8), proto(u8), port(u16)
        ];

        let mut parser = SomeipParser::new();

        let (consumed, message) = parser.parse_item(input, None).unwrap();
        assert_eq!(consumed, input.len());

        if let ParseYield::Message(item) = message.unwrap() {
            assert_eq!(
                "SD\u{4}65535\u{4}33024\u{4}64\u{4}0\u{4}0\u{4}1\u{4}2\u{4}0\u{4}Flags [C0], Subscribe 259-456 v2 Inst 1 Ttl 3, Subscribe-Ack 259-456 v2 Inst 1 Ttl 3 UDP 127.0.0.1:30000",
                &format!("{}", item)
            );
            assert_eq!(
                "SD SERV:65535 METH:33024 LENG:64 CLID:0 SEID:0 IVER:1 MSTP:2 RETC:0 Flags [C0], Subscribe 259-456 v2 Inst 1 Ttl 3, Subscribe-Ack 259-456 v2 Inst 1 Ttl 3 UDP 127.0.0.1:30000",
                &format!("{:?}", item)
            );
        } else {
            panic!("unexpected parse yield");
        }
    }

    #[test]
    fn service_lookup() {
        let xml = r#"
            <fx:SERVICE-INTERFACE ID="123.1.0">
                <ho:SHORT-NAME>Foo</ho:SHORT-NAME>
                <fx:SERVICE-IDENTIFIER>123</fx:SERVICE-IDENTIFIER>
                <service:API-VERSION>
                    <service:MAJOR>1</service:MAJOR>
                    <service:MINOR>0</service:MINOR>
                </service:API-VERSION>
            </fx:SERVICE-INTERFACE>
            <fx:SERVICE-INTERFACE ID="321.1.0">
                <ho:SHORT-NAME>Foo</ho:SHORT-NAME>
                <fx:SERVICE-IDENTIFIER>321</fx:SERVICE-IDENTIFIER>
                <service:API-VERSION>
                    <service:MAJOR>1</service:MAJOR>
                    <service:MINOR>0</service:MINOR>
                </service:API-VERSION>
            </fx:SERVICE-INTERFACE>
            <fx:SERVICE-INTERFACE ID="123.2.1">
                <ho:SHORT-NAME>Foo</ho:SHORT-NAME>
                <fx:SERVICE-IDENTIFIER>123</fx:SERVICE-IDENTIFIER>
                <service:API-VERSION>
                    <service:MAJOR>2</service:MAJOR>
                    <service:MINOR>1</service:MINOR>
                </service:API-VERSION>
            </fx:SERVICE-INTERFACE>
            <fx:SERVICE-INTERFACE ID="123.1.1">
                <ho:SHORT-NAME>Foo</ho:SHORT-NAME>
                <fx:SERVICE-IDENTIFIER>123</fx:SERVICE-IDENTIFIER>
                <service:API-VERSION>
                    <service:MAJOR>1</service:MAJOR>
                    <service:MINOR>1</service:MINOR>
                </service:API-VERSION>
            </fx:SERVICE-INTERFACE>
            <fx:SERVICE-INTERFACE ID="123.2.3">
                <ho:SHORT-NAME>Foo</ho:SHORT-NAME>
                <fx:SERVICE-IDENTIFIER>123</fx:SERVICE-IDENTIFIER>
                <service:API-VERSION>
                    <service:MAJOR>2</service:MAJOR>
                    <service:MINOR>3</service:MINOR>
                </service:API-VERSION>
            </fx:SERVICE-INTERFACE>
        "#;

        let meta_data = FibexMetadata::new(
            FibexParser::parse(vec![
                FibexReader::from_reader(BufReader::new(StringReader::new(xml))).unwrap(),
            ])
            .expect("parse failed"),
        );

        let service = meta_data.get_service(123, 3).unwrap();
        assert_eq!(
            (123, 2, 3),
            (
                service.service_id,
                service.major_version,
                service.minor_version
            )
        );

        let service = meta_data.get_service(123, 2).unwrap();
        assert_eq!(
            (123, 2, 3),
            (
                service.service_id,
                service.major_version,
                service.minor_version
            )
        );

        let service = meta_data.get_service(123, 1).unwrap();
        assert_eq!(
            (123, 1, 1),
            (
                service.service_id,
                service.major_version,
                service.minor_version
            )
        );

        assert!(meta_data.get_service(213, 1).is_none());
        assert!(meta_data.get_service(321, 1).is_some());
    }
}
