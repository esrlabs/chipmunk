use components::{CommonDescriptor, SourceDescriptor};
use file_tools::is_binary;
use stypes::{NativeError, NativeErrorKind, SessionAction, Severity};
use super::PcapngByteSourceFromFile;
use crate::*;

const PCAPNG_SOURCE_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09,
]);

#[derive(Default)]
pub struct Descriptor {}

     pub fn factory(
        origin: &SessionAction,
        _options: &[stypes::Field],
    ) -> Result<Option<(Sources, Option<String>)>, stypes::NativeError> {
                let filepath = match origin {
            SessionAction::File(file) => file,
            SessionAction::Files(..) | SessionAction::Source | SessionAction::ExportRaw(..) => {
                return Err(NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::Configuration,
                    message: Some("Pcap NG Source cannot be applied in this context".to_owned())
                })
            }
        };
        Ok(Some((Sources::PcapNg(PcapngByteSourceFromFile::new(filepath)?), Some("PcapNg".to_owned()))))
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
        files.iter().any(|fp| {
            fp.extension()
                .map(|ext| ext.to_ascii_lowercase() == "pcapng")
                .unwrap_or_default()
        }) &&        
        // If at least some file doesn't exist or not binary - do not recommend this source
        !files
            .into_iter()
            .any(|f| !f.exists() || !is_binary(f.to_string_lossy().to_string()).unwrap_or_default())
    }
    fn ident(&self) -> stypes::Ident {
        stypes::Ident {
            name: String::from("PCAP NG Source"),
            desc: String::from("PCAP NG Source"),
            io: stypes::IODataType::NetworkFramePayload,
            uuid: PCAPNG_SOURCE_UUID,
        }
    }
}

impl SourceDescriptor for Descriptor {}


