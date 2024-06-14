use crate::{Error, LogMessage, ParseYield, Parser};
use std::{borrow::Cow, fmt, fmt::Display, io::Write, path::PathBuf};

use someip_messages::*;
use someip_payload::{
    fibex::{FibexModel, FibexParser, FibexReader},
    fibex2som::FibexTypes,
    som::SOMParser,
};

use log::{debug, error};
use serde::Serialize;

/// A parser for SOME/IP log messages.
pub struct SomeipParser {
    model: Option<FibexModel>,
}

impl Default for SomeipParser {
    fn default() -> Self {
        Self::new()
    }
}

impl SomeipParser {
    /// Creates a new parser.
    pub fn new() -> Self {
        SomeipParser { model: None }
    }

    /// Creates a new parser with the given files.
    pub fn from_fibex_files(paths: Vec<PathBuf>) -> Self {
        let readers: Vec<_> = paths
            .iter()
            .filter_map(|path| FibexReader::from_file(path).ok())
            .collect();

        if !readers.is_empty() {
            if let Ok(model) = FibexParser::try_parse(readers) {
                return SomeipParser { model: Some(model) };
            }
        }

        SomeipParser { model: None }
    }
}

unsafe impl Send for SomeipParser {}
unsafe impl Sync for SomeipParser {}

impl Parser<SomeipLogMessage> for SomeipParser {
    fn parse(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Vec<Result<(usize, Option<ParseYield<SomeipLogMessage>>), Error>> {
        let time = timestamp.unwrap_or(0);
        match Message::from_slice(input) {
            Ok(Message::Sd(header, payload)) => {
                let len = header.message_len();
                debug!("at {} : SD Message ({} bytes)", time, len);
                vec![Ok((
                    if input.len() - len < Header::LENGTH {
                        input.len()
                    } else {
                        len
                    },
                    Some(ParseYield::from(SomeipLogMessage::from(
                        sd_message_string(&header, &payload),
                        input[..len].to_vec(),
                    ))),
                ))]
            }

            Ok(Message::Rpc(header, payload)) => {
                let len = header.message_len();
                debug!("at {} : RPC Message ({:?} bytes)", time, len);
                vec![Ok((
                    if input.len() - len < Header::LENGTH {
                        input.len()
                    } else {
                        len
                    },
                    Some(ParseYield::from(SomeipLogMessage::from(
                        rpc_message_string(&header, &payload, &self.model),
                        input[..len].to_vec(),
                    ))),
                ))]
            }

            Ok(Message::CookieClient) => {
                let len = Header::LENGTH;
                debug!("at {} : MCC Message", time);
                vec![Ok((
                    if input.len() - len < Header::LENGTH {
                        input.len()
                    } else {
                        len
                    },
                    Some(ParseYield::from(SomeipLogMessage::from(
                        String::from("MCC"), // Magic-Cookie-Client
                        input[..len].to_vec(),
                    ))),
                ))]
            }

            Ok(Message::CookieServer) => {
                let len = Header::LENGTH;
                debug!("at {} : MCS Message", time);
                vec![Ok((
                    if input.len() - len < Header::LENGTH {
                        input.len()
                    } else {
                        len
                    },
                    Some(ParseYield::from(SomeipLogMessage::from(
                        String::from("MCS"), // Magic-Cookie-Server
                        input[..len].to_vec(),
                    ))),
                ))]
            }

            Err(e) => {
                let msg = e.to_string();
                error!("at {} : {}", time, msg);
                vec![Err(Error::Parse(msg))]
            }
        }
    }
}

const COLUMN_SEP: char = '\u{0004}';

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
        "SD{}{}{}Flags: [{:02X?}]",
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

fn rpc_message_string(header: &Header, payload: &RpcPayload, model: &Option<FibexModel>) -> String {
    format!(
        "RPC{COLUMN_SEP}{}{COLUMN_SEP}{}",
        header_string(header),
        match model {
            None => {
                format!("Bytes: {:02X?}", *payload)
            }
            Some(model) => {
                let service_id = header.message_id.service_id as usize;
                let service_version = header.interface_version as usize;
                let method_id = header.message_id.method_id as usize;
                let message_type = header.message_type;

                let mut service_name: Option<&str> = None;
                let mut method_name: Option<&str> = None;

                let fibex_type =
                    model
                        .get_service(service_id, service_version)
                        .and_then(|service| {
                            service_name = Some(&service.name);
                            service.get_method(method_id).and_then(|method| {
                                method_name = Some(&method.name);
                                match message_type {
                                    MessageType::Request
                                    | MessageType::RequestNoReturn
                                    | MessageType::Notification => method.get_request(),
                                    MessageType::Response => method.get_response(),
                                    _ => None,
                                }
                            })
                        });

                let som_type = fibex_type.and_then(|value| FibexTypes::build(value).ok());

                format!(
                    "{}::{} {}",
                    service_name.unwrap_or("Service?"),
                    method_name.unwrap_or("Method?"),
                    match payload.is_empty() {
                        true => Cow::Borrowed(""),
                        false => {
                            let mut som_parser = SOMParser::new(payload);
                            som_type
                                .map(|mut value| match value.parse(&mut som_parser) {
                                    Ok(_) => {
                                        Cow::Owned(format!("{value}").replace([' ', '\n'], ""))
                                    }
                                    Err(error) => Cow::Owned(format!("{error}")),
                                })
                                .unwrap_or(Cow::Borrowed("(Type?)"))
                        }
                    }
                )
            }
        }
    )
}

/// Represents a SOME/IP log message.
#[derive(Debug, Serialize)]
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

impl LogMessage for SomeipLogMessage {
    fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error> {
        writer.write_all(&self.bytes)?;
        Ok(self.bytes.len())
    }
}

impl Display for SomeipLogMessage {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", self.description,)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use std::io::BufReader;
    use stringreader::StringReader;

    fn assert_str(expected: &str, actual: &str) {
        assert_eq!(expected, actual.replace(COLUMN_SEP, "|"), "\n{actual}\n");
    }

    fn test_model() -> FibexModel {
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

        let reader = FibexReader::from_reader(BufReader::new(StringReader::new(xml))).unwrap();
        FibexParser::parse(vec![reader]).expect("parse failed")
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
        let (consumed, message) = parser
            .parse(input, None)
            .into_iter()
            .next()
            .unwrap()
            .unwrap();

        assert_eq!(consumed, input.len());

        if let ParseYield::Message(item) = message.unwrap() {
            assert_str("MCC", &format!("{}", item));
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
        let (consumed, message) = parser
            .parse(input, None)
            .into_iter()
            .next()
            .unwrap()
            .unwrap();

        assert_eq!(consumed, input.len());

        if let ParseYield::Message(item) = message.unwrap() {
            assert_str("MCS", &format!("{}", item));
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
        let (consumed, message) = parser
            .parse(input, None)
            .into_iter()
            .next()
            .unwrap()
            .unwrap();

        assert_eq!(consumed, input.len());

        let expected = r#"RPC|259|32772|8|1|2|1|2|0|Bytes: []"#;

        if let ParseYield::Message(item) = message.unwrap() {
            assert_str(expected, &format!("{}", item));
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

        let model = test_model();

        let mut parser = SomeipParser { model: Some(model) };
        let (consumed, message) = parser
            .parse(input, None)
            .into_iter()
            .next()
            .unwrap()
            .unwrap();

        assert_eq!(consumed, input.len());

        let expected = r#"RPC|259|32772|8|1|2|1|2|0|TestService::emptyEvent "#;

        if let ParseYield::Message(item) = message.unwrap() {
            assert_str(expected, &format!("{}", item));
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
        let (consumed, message) = parser
            .parse(input, None)
            .into_iter()
            .next()
            .unwrap()
            .unwrap();

        assert_eq!(consumed, input.len());

        let expected = r#"RPC|259|32773|10|1|2|1|2|0|Bytes: [01, 02]"#;

        if let ParseYield::Message(item) = message.unwrap() {
            assert_str(expected, &format!("{}", item));
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

        let model = test_model();

        let mut parser = SomeipParser { model: Some(model) };
        let (consumed, message) = parser
            .parse(input, None)
            .into_iter()
            .next()
            .unwrap()
            .unwrap();

        assert_eq!(consumed, input.len());

        let expected = r#"RPC|259|32773|10|1|2|1|2|0|TestService::testEvent {value1(UINT8):1,value2(UINT8):2,}"#;

        if let ParseYield::Message(item) = message.unwrap() {
            assert_str(expected, &format!("{}", item));
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
        let (consumed, message) = parser
            .parse(input, None)
            .into_iter()
            .next()
            .unwrap()
            .unwrap();

        assert_eq!(consumed, input.len());

        let expected = r#"SD|65535|33024|20|0|0|1|2|0|Flags: [C0]"#;

        if let ParseYield::Message(item) = message.unwrap() {
            assert_str(expected, &format!("{}", item));
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
        let (consumed, message) = parser
            .parse(input, None)
            .into_iter()
            .next()
            .unwrap()
            .unwrap();

        assert_eq!(consumed, input.len());

        let expected = r#"SD|65535|33024|64|0|0|1|2|0|Flags: [C0], Subscribe 259-456 v2 Inst 1 Ttl 3, Subscribe-Ack 259-456 v2 Inst 1 Ttl 3 UDP 127.0.0.1:30000"#;

        if let ParseYield::Message(item) = message.unwrap() {
            assert_str(expected, &format!("{}", item));
        } else {
            panic!("unexpected parse yield");
        }
    }
}
