use crate::{Error, LogMessage, Parser};
use std::{fmt, fmt::Display, io::Write};

use someip_messages::*;
use someip_payload::fibex::FibexModel;
use someip_payload::fibex2som::FibexTypes;
use someip_payload::som::{SOMParser, SOMType};

use log::debug;
use serde::Serialize;

pub struct SomeipParser<'m> {
    model: &'m FibexModel,
}

impl<'m> SomeipParser<'m> {
    pub fn new(model: &'m FibexModel) -> Self {
        SomeipParser { model }
    }
}

impl<'m> Parser<SomeipLogMessage> for SomeipParser<'m> {
    fn parse<'a>(
        &mut self,
        input: &'a [u8],
        timestamp: Option<u64>,
    ) -> Result<(&'a [u8], Option<SomeipLogMessage>), Error> {
        let time = timestamp.unwrap_or(0);
        match Message::from_slice(input) {
            Ok(Message::Sd(header, payload)) => {
                let len = header.message_len();
                debug!("at {} : SD Message ({:?} bytes)", time, len);
                Ok((
                    &[],
                    Some(SomeipLogMessage::from(
                        String::from("SD"),
                        Some(sd_payload_string(&payload)),
                        input[..len].to_vec(),
                    )),
                ))
            }

            Ok(Message::Rpc(header, payload)) => {
                let len = header.message_len();
                debug!("at {} : RPC Message ({:?} bytes)", time, len);
                Ok((
                    &[],
                    Some(SomeipLogMessage::from(
                        String::from("RPC"),
                        Some(format!(
                            "{}\n{}",
                            header_string(&header),
                            rpc_payload_string(rpc_payload_details(self.model, &header), &payload),
                        )),
                        input[..len].to_vec(),
                    )),
                ))
            }

            Ok(Message::CookieClient) => {
                debug!("at {} : MCC Message", time);
                Ok((
                    &[],
                    Some(SomeipLogMessage::from(
                        String::from("MCC"),
                        None,
                        input[..Header::LENGTH].to_vec(),
                    )),
                ))
            }

            Ok(Message::CookieServer) => {
                debug!("at {} : MCS Message", time);
                Ok((
                    &[],
                    Some(SomeipLogMessage::from(
                        String::from("MCS"),
                        None,
                        input[..Header::LENGTH].to_vec(),
                    )),
                ))
            }

            Err(error) => {
                let msg = format!("{}", error);
                debug!("at {} : {}", time, msg);
                Err(Error::Parse(msg))
            }
        }
    }
}

fn header_string(header: &Header) -> String {
    format!(
        "- Service {}, Method {}, Version {}\n- {:?} ({:?})\n- Payload {} bytes",
        header.message_id.service_id,
        header.message_id.method_id,
        header.interface_version,
        header.message_type,
        header.return_code,
        header.payload_len(),
    )
}

fn sd_payload_string(payload: &SdPayload) -> String {
    let mut string = format!(
        "- Flags: {}",
        match (payload.reboot_flag(), payload.unicast_flag()) {
            (true, false) => String::from("R"),
            (false, true) => String::from("U"),
            (true, true) => String::from("R,U"),
            (false, false) => String::from("-"),
        }
    );

    for (i, entry) in payload.entries.iter().enumerate() {
        let (entry_description, entry_options) = match entry {
            SdEntry::FindService(value) => (
                sd_service_entry_string(
                    match value.has_ttl() {
                        true => String::from("FindService"),
                        false => String::from("StopFindService"),
                    },
                    value,
                ),
                payload.options(i),
            ),
            SdEntry::OfferService(value) => (
                sd_service_entry_string(
                    match value.has_ttl() {
                        true => String::from("OfferService"),
                        false => String::from("StopOfferService"),
                    },
                    value,
                ),
                payload.options(i),
            ),
            SdEntry::SubscribeEventgroup(value) => (
                sd_eventgroup_entry_string(
                    match value.has_ttl() {
                        true => String::from("SubscribeEventgroup"),
                        false => String::from("StopSubscribeEventgroup"),
                    },
                    value,
                ),
                payload.options(i),
            ),
            SdEntry::SubscribeEventgroupAck(value) => (
                sd_eventgroup_entry_string(
                    match value.has_ttl() {
                        true => String::from("SubscribeEventgroupAck"),
                        false => String::from("SubscribeEventgroupNack"),
                    },
                    value,
                ),
                payload.options(i),
            ),
        };

        string = format!("{}\n- {}", string, entry_description);

        for option in entry_options {
            string = format!("{}\n  |- {}", string, sd_option_string(option));
        }
    }

    string
}

fn sd_service_entry_string(name: String, entry: &SdServiceEntry) -> String {
    format!(
        "{}: Service {}, Instance {}, Version {}.{}{}",
        name,
        entry.service_id,
        entry.instance_id,
        entry.major_version,
        entry.minor_version,
        match entry.has_ttl() {
            true => format!(", Ttl {}", entry.ttl),
            false => String::from(""),
        }
    )
}

fn sd_eventgroup_entry_string(name: String, entry: &SdEventgroupEntry) -> String {
    format!(
        "{}: Service {}, Instance {}, Eventgroup {}, Version {}{}",
        name,
        entry.service_id,
        entry.instance_id,
        entry.eventgroup_id,
        entry.major_version,
        match entry.has_ttl() {
            true => format!(", Ttl {}", entry.ttl),
            false => String::from(""),
        }
    )
}

fn sd_option_string(option: &SdEndpointOption) -> String {
    format!(
        "{}:{} ({})",
        option.ip,
        option.port,
        match option.proto {
            IpProto::UDP => String::from("UDP"),
            IpProto::TCP => String::from("TCP"),
        },
    )
}

type RpcPayloadDetails = (Option<String>, Option<String>, Option<Box<dyn SOMType>>);

fn rpc_payload_details(model: &FibexModel, header: &Header) -> RpcPayloadDetails {
    let service_id = header.message_id.service_id as usize;
    let service_version = header.interface_version as usize;
    let method_id = header.message_id.method_id as usize;
    let message_type = header.message_type;

    let mut service_name = None;
    let mut method_name = None;

    let fibex_type = match model.get_service(service_id, service_version) {
        Some(service) => {
            service_name = Some(service.name.clone());
            match service.get_method(method_id) {
                Some(method) => {
                    method_name = Some(method.name.clone());
                    match message_type {
                        MessageType::Request
                        | MessageType::RequestNoReturn
                        | MessageType::Notification => method.get_request(),
                        MessageType::Response => method.get_response(),
                        _ => None,
                    }
                }
                _ => None,
            }
        }
        _ => None,
    };

    let som_type = match fibex_type {
        Some(value) => match FibexTypes::build(value) {
            Ok(result) => Some(result),
            _ => None,
        },
        _ => None,
    };

    (service_name, method_name, som_type)
}

fn rpc_payload_string(details: RpcPayloadDetails, payload: &RpcPayload) -> String {
    let (service_name, method_name, som_type) = details;

    let signature = format!(
        "{}::{}",
        match service_name {
            Some(value) => value,
            _ => String::from("'Unknown Service'"),
        },
        match method_name {
            Some(value) => value,
            _ => String::from("'Unknown Method'"),
        }
    );

    if payload.is_empty() {
        return format!("- {}", signature);
    }

    let content = match som_type {
        Some(mut value) => {
            let mut parser = SOMParser::new(payload);
            match value.parse(&mut parser) {
                Ok(_) => {
                    format!("{}", value)
                }
                Err(error) => format!("{}", error),
            }
        }
        _ => String::from("'Unknown Type'"),
    };

    format!("- {} {}", signature, content)
}

#[derive(Debug, Serialize)]
pub struct SomeipLogMessage {
    name: String,
    description: Option<String>,
    bytes: Vec<u8>,
}

impl SomeipLogMessage {
    pub fn from(name: String, description: Option<String>, bytes: Vec<u8>) -> Self {
        SomeipLogMessage {
            name,
            description,
            bytes,
        }
    }
}

impl LogMessage for SomeipLogMessage {
    fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error> {
        let bytes = self.bytes.to_vec();
        let len = bytes.len();
        writer.write_all(&bytes)?;
        Ok(len)
    }
}

impl Display for SomeipLogMessage {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(
            f,
            "{}",
            format!(
                "SOME/IP {}{}",
                self.name,
                match &self.description {
                    Some(description) => format!("\n{}", description),
                    None => String::from(""),
                },
            )
        )
    }
}
