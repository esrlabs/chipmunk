use super::*;
use crate::*;
use ::descriptor::{CommonDescriptor, FieldsResult, LazyFieldsTask, ParserDescriptor};
use stypes::SessionAction;
use tokio_util::sync::CancellationToken;

const DLT_PARSER_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x01, 0x02, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
]);

#[derive(Default)]
pub struct Descriptor {}

pub fn factory(
    origin: &SessionAction,
    _options: &[stypes::Field],
) -> Result<Option<(Parsers, Option<String>)>, stypes::NativeError> {
    Ok(Some((
        Parsers::DltRaw(DltRawParser::new(!matches!(origin, SessionAction::Source))),
        Some("DLT".to_string()),
    )))
}

impl CommonDescriptor for Descriptor {
    fn is_compatible(&self, origin: &SessionAction) -> bool {
        let files = match origin {
            SessionAction::File(..) | SessionAction::Files(..) | SessionAction::Source => {
                return false;
            }
            SessionAction::ExportRaw(files, ..) => files,
        };
        files.iter().any(|fp| {
            fp.extension()
                .map(|ext| ext.to_ascii_lowercase() == "dlt")
                .unwrap_or_default()
        })
    }
    fn fields_getter(&self, _origin: &SessionAction) -> FieldsResult {
        Ok(Vec::new())
    }
    fn ident(&self) -> stypes::Ident {
        stypes::Ident {
            name: String::from("DLT Export Parser"),
            desc: String::from("DLT Export Parser"),
            io: stypes::IODataType::Multiple(vec![
                stypes::IODataType::NetworkFramePayload,
                stypes::IODataType::Raw,
            ]),
            uuid: DLT_PARSER_UUID,
        }
    }
    fn lazy_fields_getter(
        &self,
        _origin: SessionAction,
        _cancel: CancellationToken,
    ) -> LazyFieldsTask {
        Box::pin(async move { Ok(Vec::new()) })
    }
}

impl ParserDescriptor for Descriptor {
    fn get_render(&self) -> Option<stypes::OutputRender> {
        None
    }
}
