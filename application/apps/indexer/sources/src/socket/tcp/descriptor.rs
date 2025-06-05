use components::{ComponentDescriptor, ComponentFactory};
use stypes::{FieldDesc, SessionAction, StaticFieldDesc, ValueInput};

const TCP_SOURCE_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05,
]);

// TODO: make fields ids more generic, for example prefix can be taken from source trait somehow
const FIELD_IP_ADDR: &str = "TCP_SOURCE_FIELD_IP_ADDR";

#[derive(Default)]
pub struct Descriptor {}

impl ComponentFactory<crate::Source> for Descriptor {
    fn create(
        &self,
        _origin: &SessionAction,
        _options: &[stypes::Field],
    ) -> Result<Option<crate::Source>, stypes::NativeError> {
        Ok(None)
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
            name: String::from("TCP Connection"),
            desc: String::from("Connects to the specified IP address and port to receive incoming messages. If the connection fails, an appropriate error is returned. Each individual TCP message is passed to the parser without any headers - only the payload is forwarded."),
            io: stypes::IODataType::NetworkFramePayload,
            uuid: TCP_SOURCE_UUID,
        }
    }
    fn ty(&self) -> stypes::ComponentType {
        stypes::ComponentType::Source
    }
    fn fields_getter(&self, _origin: &stypes::SessionAction) -> components::FieldsResult {
        Ok(vec![FieldDesc::Static(StaticFieldDesc {
            id: FIELD_IP_ADDR.to_owned(),
            name: "IP address and port".to_owned(),
            desc: "Specifies the target address of the remote TCP server. The value must include both the IP address and the port, using the format IP:PORT — for example, 192.168.0.100:8888. This field is mandatory, and the parser will attempt to connect to the given endpoint exactly as specified. Use 0.0.0.0:PORT to bind to all local interfaces, if applicable.".to_owned(),
            required: true,
            interface: ValueInput::String(String::new(), "0.0.0.0:8888".to_owned()),
            binding: None,
        })])
    }
}
