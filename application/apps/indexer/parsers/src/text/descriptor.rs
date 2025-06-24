use components::{ComponentDescriptor, ComponentFactory};
use file_tools::is_binary;
use stypes::SessionAction;

use super::StringTokenizer;

const TEXT_PARSER_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03,
]);

#[derive(Default)]
pub struct Descriptor {}

impl ComponentFactory<crate::AllParserTypes> for Descriptor {
    fn create(
        &self,
        _origin: &SessionAction,
        _options: &[stypes::Field],
    ) -> Result<Option<crate::AllParserTypes>, stypes::NativeError> {
        Ok(Some(crate::AllParserTypes::Text(StringTokenizer {})))
    }
}

impl ComponentDescriptor for Descriptor {
    fn get_render(&self) -> Option<stypes::OutputRender> {
        Some(stypes::OutputRender::PlaitText)
    }
    fn is_compatible(&self, origin: &stypes::SessionAction) -> bool {
        let files = match origin {
            SessionAction::File(filepath) => {
                vec![filepath]
            }
            SessionAction::Files(files) => files.iter().collect(),
            SessionAction::Source => return true,
            SessionAction::ExportRaw(..) => return false,
        };
        // If at least some file doesn't exist or it's binary - do not recommend this source
        !files
            .into_iter()
            .any(|f| !f.exists() || is_binary(f.to_string_lossy().to_string()).unwrap_or_default())
    }
    fn ident(&self) -> stypes::Ident {
        stypes::Ident {
            name: String::from("Text Parser"),
            desc: String::from(
                "Text Parser is a minimal parser designed for processing plain text input. It performs no decoding or transformation and has no configuration options. Its sole purpose is to output incoming data line by line, making it suitable for logs or command outputs in textual format.",
            ),
            io: stypes::IODataType::PlaitText,
            uuid: TEXT_PARSER_UUID,
        }
    }
    fn ty(&self) -> stypes::ComponentType {
        stypes::ComponentType::Parser
    }
}
