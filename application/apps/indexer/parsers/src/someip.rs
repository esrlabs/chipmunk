use crate::{Error, LogMessage, ParseYield, Parser};
use std::{borrow::Cow, fmt, fmt::Display, io::Write};

use someip_messages::*;
use someip_payload::{fibex::FibexModel, fibex2som::FibexTypes, som::SOMParser};

use log::debug;
use serde::Serialize;

/// A parser for SOME/IP log messages.
pub struct SomeipParser<'m> {
    model: Option<&'m FibexModel>,
}

impl<'m> Default for SomeipParser<'m> {
    fn default() -> Self {
        Self::new()
    }
}

impl<'m> SomeipParser<'m> {
    /// Creates a new parser.
    pub fn new() -> Self {
        SomeipParser { model: None }
    }

    // Creates a new parser for the given model.
    pub fn from_fibex(model: &'m FibexModel) -> Self {
        SomeipParser { model: Some(model) }
    }
}

unsafe impl<'m> Send for SomeipParser<'m> {}
unsafe impl<'m> Sync for SomeipParser<'m> {}

impl<'m> Parser<SomeipLogMessage> for SomeipParser<'m> {
    fn parse<'a>(
        &mut self,
        input: &'a [u8],
        timestamp: Option<u64>,
    ) -> Result<(&'a [u8], Option<ParseYield<SomeipLogMessage>>), Error> {
        let time = timestamp.unwrap_or(0);
        match Message::from_slice(input) {
            Ok(Message::Sd(header, payload)) => {
                let len = header.message_len();
                debug!("at {} : SD Message ({:?} bytes)", time, len);
                Ok((
                    &input[len..],
                    Some(ParseYield::from(SomeipLogMessage::from(
                        sd_message_string(&payload),
                        input[..len].to_vec(),
                    ))),
                ))
            }

            Ok(Message::Rpc(header, payload)) => {
                let len = header.message_len();
                debug!("at {} : RPC Message ({:?} bytes)", time, len);
                Ok((
                    &input[len..],
                    Some(ParseYield::from(SomeipLogMessage::from(
                        rpc_message_string(&header, &payload, self.model),
                        input[..len].to_vec(),
                    ))),
                ))
            }

            Ok(Message::CookieClient) => {
                debug!("at {} : MCC Message", time);
                Ok((
                    &input[Header::LENGTH..],
                    Some(ParseYield::from(SomeipLogMessage::from(
                        String::from("Magic-Cookie-Client"),
                        input[..Header::LENGTH].to_vec(),
                    ))),
                ))
            }

            Ok(Message::CookieServer) => {
                debug!("at {} : MCS Message", time);
                Ok((
                    &input[Header::LENGTH..],
                    Some(ParseYield::from(SomeipLogMessage::from(
                        String::from("Magic-Cookie-Server"),
                        input[..Header::LENGTH].to_vec(),
                    ))),
                ))
            }

            Err(error) => {
                let msg = format!("{error}");
                debug!("at {} : {}", time, msg);
                Err(Error::Parse(msg))
            }
        }
    }
}

fn sd_message_string(payload: &SdPayload) -> String {
    let mut string = format!(
        "SD\n- Flags: {}",
        match (payload.reboot_flag(), payload.unicast_flag()) {
            (true, false) => "R",
            (false, true) => "U",
            (true, true) => "R,U",
            (false, false) => "-",
        }
    );

    for (i, entry) in payload.entries.iter().enumerate() {
        let (entry_string, entry_options) = match entry {
            SdEntry::FindService(value) => (
                sd_service_entry_string(
                    match value.has_ttl() {
                        true => "FindService",
                        false => "StopFindService",
                    },
                    value,
                ),
                payload.options(i),
            ),
            SdEntry::OfferService(value) => (
                sd_service_entry_string(
                    match value.has_ttl() {
                        true => "OfferService",
                        false => "StopOfferService",
                    },
                    value,
                ),
                payload.options(i),
            ),
            SdEntry::SubscribeEventgroup(value) => (
                sd_eventgroup_entry_string(
                    match value.has_ttl() {
                        true => "SubscribeEventgroup",
                        false => "StopSubscribeEventgroup",
                    },
                    value,
                ),
                payload.options(i),
            ),
            SdEntry::SubscribeEventgroupAck(value) => (
                sd_eventgroup_entry_string(
                    match value.has_ttl() {
                        true => "SubscribeEventgroupAck",
                        false => "SubscribeEventgroupNack",
                    },
                    value,
                ),
                payload.options(i),
            ),
        };

        string = format!("{string}\n- {entry_string}");

        for option in entry_options {
            string = format!("{}\n  |- {}", string, sd_option_string(option));
        }
    }

    string
}

fn sd_service_entry_string(name: &str, entry: &SdServiceEntry) -> String {
    format!(
        "{}: Service {}, Instance {}, Version {}.{}{}",
        name,
        entry.service_id,
        entry.instance_id,
        entry.major_version,
        entry.minor_version,
        match entry.has_ttl() {
            true => Cow::Owned(format!(", Ttl {}", entry.ttl)),
            false => Cow::Borrowed(""),
        }
    )
}

fn sd_eventgroup_entry_string(name: &str, entry: &SdEventgroupEntry) -> String {
    format!(
        "{}: Service {}, Instance {}, Eventgroup {}, Version {}{}",
        name,
        entry.service_id,
        entry.instance_id,
        entry.eventgroup_id,
        entry.major_version,
        match entry.has_ttl() {
            true => Cow::Owned(format!(", Ttl {}", entry.ttl)),
            false => Cow::Borrowed(""),
        }
    )
}

fn sd_option_string(option: &SdEndpointOption) -> String {
    format!(
        "{}:{} ({})",
        option.ip,
        option.port,
        match option.proto {
            IpProto::UDP => "UDP",
            IpProto::TCP => "TCP",
        },
    )
}

fn rpc_message_string(header: &Header, payload: &RpcPayload, model: Option<&FibexModel>) -> String {
    let service_id = header.message_id.service_id as usize;
    let service_version = header.interface_version as usize;
    let method_id = header.message_id.method_id as usize;
    let message_type = header.message_type;

    let mut service_name: Option<&str> = None;
    let mut method_name: Option<&str> = None;

    let fibex_type = model.and_then(|model| {
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
            })
    });

    let som_type = fibex_type.and_then(|value| FibexTypes::build(value).ok());

    format!(
        "RPC\n- Service {}, Method {}, Version {}\n- {:?} ({:?})\n- Payload {} bytes\n- {}::{} {}",
        service_id,
        method_id,
        service_version,
        message_type,
        header.return_code,
        header.payload_len(),
        service_name.unwrap_or("UnknownService"),
        method_name.unwrap_or("UnknownMethod"),
        match payload.is_empty() {
            true => Cow::Borrowed(""),
            false => {
                let mut som_parser = SOMParser::new(payload);
                som_type
                    .map(|mut value| match value.parse(&mut som_parser) {
                        Ok(_) => Cow::Owned(format!("{value}")),
                        Err(error) => Cow::Owned(format!("{error}")),
                    })
                    .unwrap_or(Cow::Borrowed("(UnknownType)"))
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
        write!(f, "SOME/IP {}", self.description,)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use someip_payload::fibex::{FibexParser, FibexReader};
    use std::io::BufReader;
    use stringreader::StringReader;

    fn flatten_str(string: &str) -> String {
        string.replace([' ', '\n'], "")
    }

    fn assert_str(expected: &str, actual: &str) {
        assert_eq!(flatten_str(expected), flatten_str(actual), "\n{actual}\n");
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
        FibexParser::parse(reader).expect("parse failed")
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
        let (output, message) = parser.parse(input, None).unwrap();

        assert!(output.is_empty());

        if let ParseYield::Message(item) = message.unwrap() {
            assert_str("SOME/IP Magic-Cookie-Client", &format!("{}", item));
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
        let (output, message) = parser.parse(input, None).unwrap();

        assert!(output.is_empty());

        if let ParseYield::Message(item) = message.unwrap() {
            assert_str("SOME/IP Magic-Cookie-Server", &format!("{}", item));
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
        let (output, message) = parser.parse(input, None).unwrap();

        assert!(output.is_empty());

        let expected = r#"
            SOME/IP RPC
            - Service 259, Method 32772, Version 1
            - Notification (Ok)
            - Payload 0 bytes
            - UnknownService::UnknownMethod
        "#;

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

        let mut parser = SomeipParser::from_fibex(&model);
        let (output, message) = parser.parse(input, None).unwrap();

        assert!(output.is_empty());

        let expected = r#"
            SOME/IP RPC
            - Service 259, Method 32772, Version 1
            - Notification (Ok)
            - Payload 0 bytes
            - TestService::emptyEvent
        "#;

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
        let (output, message) = parser.parse(input, None).unwrap();

        assert!(output.is_empty());

        let expected = r#"
            SOME/IP RPC
            - Service 259, Method 32773, Version 1
            - Notification (Ok)
            - Payload 2 bytes
            - UnknownService::UnknownMethod (UnknownType)
        "#;

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

        let mut parser = SomeipParser::from_fibex(&model);
        let (output, message) = parser.parse(input, None).unwrap();

        assert!(output.is_empty());

        let expected = r#"
            SOME/IP RPC
            - Service 259, Method 32773, Version 1
            - Notification (Ok)
            - Payload 2 bytes
            - TestService::testEvent {
                value1 (UINT8) : 1,
                value2 (UINT8) : 2,
            }
        "#;

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
        let (output, message) = parser.parse(input, None).unwrap();

        assert!(output.is_empty());

        let expected = r#"
            SOME/IP SD
            - Flags: R,U
        "#;

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
        let (output, message) = parser.parse(input, None).unwrap();

        assert!(output.is_empty());

        let expected = r#"
            SOME/IP SD
            - Flags: R,U
            - SubscribeEventgroup: Service 259, Instance 1, Eventgroup 456, Version 2, Ttl 3
            - SubscribeEventgroupAck: Service 259, Instance 1, Eventgroup 456, Version 2, Ttl 3
              |- 127.0.0.1:30000 (UDP)
        "#;

        if let ParseYield::Message(item) = message.unwrap() {
            assert_str(expected, &format!("{}", item));
        } else {
            panic!("unexpected parse yield");
        }
    }
}
