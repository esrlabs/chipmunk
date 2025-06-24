use components::{ComponentDescriptor, ComponentFactory};
use std::collections::HashMap;
use stypes::{
    ExtractAs, ExtractByKey, Extracted, Field, FieldDesc, NativeError, NativeErrorKind,
    SessionAction, Severity, StaticFieldDesc, Value, ValueInput, missed_field_err as missed,
};

use super::{MulticastInfo, UdpSource};

const UDP_SOURCE_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04,
]);

const FIELD_IP_ADDR: &str = "UDP_SOURCE_FIELD_IP_ADDR";
const FIELD_MULTICAST_ADDR: &str = "UDP_SOURCE_FIELD_MULTICAST_ADDR";

#[derive(Default)]
pub struct Descriptor {}

impl ComponentFactory<crate::AllSourceTypes> for Descriptor {
    fn create(
        &self,
        origin: &SessionAction,
        options: &[Field],
    ) -> Result<Option<crate::AllSourceTypes>, NativeError> {
        let errors = self.validate(origin, options)?;
        if !errors.is_empty() {
            return Err(NativeError {
                kind: NativeErrorKind::Configuration,
                severity: Severity::ERROR,
                message: Some(
                    errors
                        .values()
                        .map(String::as_str)
                        .collect::<Vec<_>>()
                        .join("; "),
                ),
            });
        }
        let addr: String = options
            .extract_by_key(FIELD_IP_ADDR)
            .ok_or(missed(FIELD_IP_ADDR))?
            .value;
        let multicast: &Vec<Field> = options
            .extract_by_key(FIELD_MULTICAST_ADDR)
            .ok_or(missed(FIELD_MULTICAST_ADDR))?
            .value;
        let mut multicasts = Vec::new();
        for field in multicast {
            let pair: &Vec<Field> = field.extract_as().ok_or(missed("Multicast Addr"))?;
            if pair.len() != 2 {
                return Err(NativeError {
                    kind: NativeErrorKind::Configuration,
                    severity: Severity::ERROR,
                    message: Some("Invalid settings of multicast address".to_owned()),
                });
            }
            let addr: String = (&pair[0]).extract_as().ok_or(missed("Multicast"))?;
            let interface: String = (&pair[1]).extract_as().ok_or(missed("Interface"))?;
            multicasts.push(MulticastInfo {
                multiaddr: addr
                    .parse::<std::net::IpAddr>()
                    .map_err(|err| NativeError {
                        kind: NativeErrorKind::Configuration,
                        severity: Severity::ERROR,
                        message: Some(format!("Fail to parse IP: {err}")),
                    })?,
                interface: if interface.is_empty() {
                    None
                } else {
                    Some(interface)
                },
            })
        }
        Ok(Some(crate::AllSourceTypes::Udp(
            UdpSource::new(addr, multicasts).map_err(|err| NativeError {
                kind: NativeErrorKind::Io,
                severity: Severity::ERROR,
                message: Some(err.to_string()),
            })?,
        )))
    }
}

impl ComponentDescriptor for Descriptor {
    fn is_compatible(&self, origin: &SessionAction) -> bool {
        match origin {
            SessionAction::File(..) | SessionAction::Files(..) | SessionAction::ExportRaw(..) => {
                false
            }
            SessionAction::Source => true,
        }
    }
    fn ident(&self) -> stypes::Ident {
        stypes::Ident {
            name: String::from("UDP Connection"),
            desc: String::from(
                "Starts listening on the specified IP address and port, as well as on any user-defined multicast addresses. Each received UDP packet is passed to the parser as-is, excluding headers - only the payload is forwarded.",
            ),
            io: stypes::IODataType::NetworkFramePayload,
            uuid: UDP_SOURCE_UUID,
        }
    }
    fn ty(&self) -> stypes::ComponentType {
        stypes::ComponentType::Source
    }
    fn fields_getter(&self, _origin: &SessionAction) -> components::FieldsResult {
        Ok(vec![
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_IP_ADDR.to_owned(),
                name: "IP address and port".to_owned(),
                desc: "Specifies the local address and port on which the application should listen for incoming UDP packets. The value must include both the IP address and the port, using the format IP:PORT — for example, 0.0.0.0:9000. This field is mandatory, and determines the network interface and port bound by the listener. Use 0.0.0.0:PORT to listen on all available interfaces.".to_owned(),
                required: true,
                interface: ValueInput::String(String::new(), "0.0.0.0:8888".to_owned()),
                binding: None,
            }),
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_MULTICAST_ADDR.to_owned(),
                name: "Multicast Addresses".to_owned(),
                desc: "An optional list of UDP multicast groups to join. Each entry includes the group address (e.g., 239.0.0.1) and the local interface IP (e.g., 192.168.1.10) used for joining. This allows the source to receive packets sent to the specified multicast addresses in addition to those received on the main local socket (IP:PORT). If the list is empty, only unicast or broadcast messages will be received.".to_owned(),
                required: true,
                interface: ValueInput::FieldsCollection {
                    elements: vec![
                        StaticFieldDesc {
                            id: String::new(),
                            name: "Address".to_owned(),
                            desc: "".to_owned(),
                            required: true,
                            interface: ValueInput::String(
                                String::new(),
                                "255.255.255.255".to_owned(),
                            ),
                            binding: None,
                        },
                        StaticFieldDesc {
                            id: String::new(),
                            name: "Interface".to_owned(),
                            desc: "".to_owned(),
                            required: true,
                            interface: ValueInput::String(String::new(), "0.0.0.0".to_owned()),
                            binding: None,
                        },
                    ],
                    add_title: "Add Multicast".to_owned(),
                },
                binding: None,
            }),
        ])
    }

    fn validate(
        &self,
        _origin: &SessionAction,
        fields: &[Field],
    ) -> Result<HashMap<String, String>, NativeError> {
        fn is_valid(addr: &str) -> bool {
            addr.parse::<std::net::IpAddr>().is_ok()
        }
        let multicast: Extracted<&Vec<Field>> = fields
            .extract_by_key(FIELD_MULTICAST_ADDR)
            .ok_or(missed(FIELD_MULTICAST_ADDR))?;
        let mut errors = HashMap::new();
        for pair in multicast.value.into_iter() {
            if let Value::Fields(pair) = &pair.value {
                if pair.len() != 2 {
                    errors.insert(
                        multicast.id.to_owned(),
                        "Invalid number of mutlicast settings".to_owned(),
                    );
                    break;
                }
                if let (Value::String(addr), Value::String(interface)) =
                    (&pair[0].value, &pair[1].value)
                {
                    if !is_valid(addr) {
                        errors.insert(
                            pair[0].id.to_owned(),
                            "Expecting IP format 255.255.255.255".to_owned(),
                        );
                    }
                    if !interface.is_empty() && !is_valid(interface) {
                        errors.insert(
                            pair[1].id.to_owned(),
                            "Expecting IP format 0.0.0.0".to_owned(),
                        );
                    }
                } else {
                    errors.insert(
                        multicast.id.to_owned(),
                        "Invalid values of mutlicast settings".to_owned(),
                    );
                    break;
                }
            } else {
                errors.insert(
                    multicast.id.to_owned(),
                    "Invalid mutlicast settings".to_owned(),
                );
                break;
            }
        }
        Ok(errors)
    }
}
