use components::ComponentDescriptor;

use super::StringTokenizer;

const TEXT_PARSER_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03,
]);

#[derive(Default)]
struct Descriptor {}

impl ComponentDescriptor for Descriptor {
    fn ident(&self) -> stypes::Ident {
        stypes::Ident {
            name: String::from("Text Parser"),
            desc: String::from("Text Parser"),
            uuid: TEXT_PARSER_UUID,
        }
    }
    fn ty(&self) -> stypes::ComponentType {
        stypes::ComponentType::Parser
    }
}

impl components::Component for StringTokenizer {
    fn register(components: &mut components::Components) -> Result<(), stypes::NativeError> {
        components.register(Descriptor::default())?;
        Ok(())
    }
}
