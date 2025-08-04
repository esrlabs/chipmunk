use crate::*;
use descriptor::{CommonDescriptor, FieldsResult, SourceDescriptor, SourceFactory};
use std::collections::HashMap;
use stypes::{
    ExtractByKey, Extracted, Field, FieldDesc, NativeError, NativeErrorKind, SessionAction,
    Severity, StaticFieldDesc, ValueInput, missed_field_err as missed,
};

use crate::prelude::TcpSource;

const TCP_SOURCE_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05,
]);

// TODO: make fields ids more generic, for example prefix can be taken from source trait somehow
const FIELD_IP_ADDR: &str = "TCP_SOURCE_FIELD_IP_ADDR";

#[derive(Default)]
pub struct Descriptor {}

impl SourceFactory<Sources> for Descriptor {
    fn create(
        &self,
        origin: &stypes::SessionAction,
        options: &[stypes::Field],
    ) -> Result<Option<(Sources, Option<String>)>, stypes::NativeError> {
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
        Ok(Some((
            Sources::Tcp(TcpSource::new(&addr, None, None)?),
            Some(format!("TCP on {addr}")),
        )))
    }
}

impl CommonDescriptor for Descriptor {
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
            name: String::from("TCP Connection"),
            desc: String::from(
                "Connects to the specified IP address and port to receive incoming messages. If the connection fails, an appropriate error is returned. Each individual TCP message is passed to the parser without any headers - only the payload is forwarded.",
            ),
            io: stypes::IODataType::NetworkFramePayload,
            uuid: TCP_SOURCE_UUID,
        }
    }
    fn fields_getter(&self, _origin: &SessionAction) -> FieldsResult {
        Ok(vec![FieldDesc::Static(StaticFieldDesc {
            id: FIELD_IP_ADDR.to_owned(),
            name: "IP address and port".to_owned(),
            desc: "Specifies the target address of the remote TCP server. The value must include both the IP address and the port, using the format IP:PORT - for example, 192.168.0.100:8888. This field is mandatory, and the parser will attempt to connect to the given endpoint exactly as specified. Use 0.0.0.0:PORT to bind to all local interfaces, if applicable.".to_owned(),
            required: true,
            interface: ValueInput::String(String::new(), "0.0.0.0:8888".to_owned()),
            binding: None,
        })])
    }
    fn validate(
        &self,
        _origin: &SessionAction,
        fields: &[Field],
    ) -> Result<HashMap<String, String>, NativeError> {
        fn is_valid(addr: &str) -> bool {
            addr.parse::<std::net::SocketAddr>().is_ok()
        }
        let addr: Extracted<String> = fields
            .extract_by_key(FIELD_IP_ADDR)
            .ok_or(missed(FIELD_IP_ADDR))?;
        let mut errors = HashMap::new();
        if !is_valid(&addr.value) {
            errors.insert(
                addr.id.to_owned(),
                "Expecting IP format 0.0.0.0::8888 (port is required)".to_owned(),
            );
        }
        Ok(errors)
    }
}
impl SourceDescriptor for Descriptor {}
