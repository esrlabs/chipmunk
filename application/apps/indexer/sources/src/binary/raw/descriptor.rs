use crate::*;
use descriptor::{CommonDescriptor, SourceDescriptor, SourceFactory};
use file_tools::is_binary;
use stypes::{ComponentOptions, SessionAction};

const BIN_SOURCE_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08,
]);

#[derive(Default)]
pub struct Descriptor {}

impl SourceFactory<Sources> for Descriptor {
    fn create(
        &self,
        origin: &stypes::SessionAction,
        _options: &[stypes::Field],
    ) -> Result<Option<(Sources, Option<String>)>, stypes::NativeError> {
        let filename = match origin {
            SessionAction::File(filename) => filename,
            SessionAction::Files(..) | SessionAction::Source | SessionAction::ExportRaw(..) => {
                return Err(stypes::NativeError {
                    severity: stypes::Severity::ERROR,
                    kind: stypes::NativeErrorKind::Configuration,
                    message: Some(
                        "origin isn't supported by this source (BinaryByteSource)".to_owned(),
                    ),
                });
            }
        };

        Ok(Some((
            Sources::Raw(super::BinaryByteSourceFromFile::new(filename)?),
            Some(filename.to_string_lossy().to_string()),
        )))
    }
}

impl CommonDescriptor for Descriptor {
    fn is_compatible(&self, origin: &SessionAction) -> bool {
        let files = match origin {
            SessionAction::File(filepath) => {
                vec![filepath]
            }
            SessionAction::Files(files) => files.iter().collect(),
            SessionAction::Source | SessionAction::ExportRaw(..) => {
                return false;
            }
        };
        // If at least some file doesn't exist or not binary - do not recommend this source
        !files
            .into_iter()
            .any(|f| !f.exists() || !is_binary(f.to_string_lossy().to_string()).unwrap_or_default())
    }
    fn ident(&self) -> stypes::Ident {
        stypes::Ident {
            name: String::from("Binary Source"),
            desc: String::from("Binary Source"),
            io: stypes::IODataType::Raw,
            uuid: BIN_SOURCE_UUID,
        }
    }
}

impl SourceDescriptor for Descriptor {}

pub fn get_default_options() -> ComponentOptions {
    ComponentOptions {
        uuid: BIN_SOURCE_UUID,
        fields: Vec::new(),
    }
}
