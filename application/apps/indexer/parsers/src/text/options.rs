use components::ComponentDescriptor;
use file_tools::is_binary;
use stypes::SourceOrigin;

use super::StringTokenizer;

const TEXT_PARSER_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03,
]);

#[derive(Default)]
struct Descriptor {}

impl ComponentDescriptor for Descriptor {
    fn is_compatible(&self, origin: &stypes::SourceOrigin) -> bool {
        let files = match origin {
            SourceOrigin::File(filepath) => {
                vec![filepath]
            }
            SourceOrigin::Files(files) => files.iter().collect(),
            SourceOrigin::Source => return true,
            SourceOrigin::Folder(..) | SourceOrigin::Folders(..) => return false,
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

impl components::Component for StringTokenizer {
    fn register(components: &mut components::Components) -> Result<(), stypes::NativeError> {
        components.register(Descriptor::default())?;
        Ok(())
    }
}
