use components::{ComponentDescriptor, ComponentFactory};
use file_tools::is_binary;
use stypes::SourceOrigin;

use super::StringTokenizer;

const TEXT_PARSER_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03,
]);

#[derive(Default)]
pub struct Descriptor {}

impl ComponentFactory<crate::Parser> for Descriptor {
    fn create(
        &self,
        _origin: &SourceOrigin,
        _options: &[stypes::Field],
    ) -> Result<Option<crate::Parser>, stypes::NativeError> {
        Ok(None)
    }
}

impl ComponentDescriptor for Descriptor {
    fn is_compatible(&self, origin: &stypes::SourceOrigin) -> bool {
        let files = match origin {
            SourceOrigin::File(filepath) => {
                vec![filepath]
            }
            SourceOrigin::Files(files) => files.iter().collect(),
            SourceOrigin::Source => return true,
        };
        // If at least some file doesn't exist or it's binary - do not recommend this source
        !files
            .into_iter()
            .any(|f| !f.exists() || is_binary(f.to_string_lossy().to_string()).unwrap_or_default())
    }
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
