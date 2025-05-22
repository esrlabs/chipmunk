use super::*;
use components::{ComponentDescriptor, ComponentFactory};
use stypes::SessionAction;
use tokio_util::sync::CancellationToken;

const DLT_PARSER_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x01, 0x02, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
]);

#[derive(Default)]
pub struct Descriptor {}

impl ComponentFactory<crate::Parser> for Descriptor {
    fn create(
        &self,
        origin: &SessionAction,
        _options: &[stypes::Field],
    ) -> Result<Option<crate::Parser>, stypes::NativeError> {
        Ok(Some(crate::Parser::DltRaw(DltRawParser::new(!matches!(
            origin,
            SessionAction::Source
        )))))
    }
}

impl ComponentDescriptor for Descriptor {
    fn is_compatible(&self, origin: &SessionAction) -> bool {
        let files = match origin {
            SessionAction::File(..) | SessionAction::Files(..) | SessionAction::Source => {
                return false
            }
            SessionAction::ExportRaw(files, ..) => files,
        };
        files.iter().any(|fp| {
            fp.extension()
                .map(|ext| ext.to_ascii_lowercase() == "dlt")
                .unwrap_or_default()
        })
    }
    fn fields_getter(&self, _origin: &SessionAction) -> components::FieldsResult {
        Ok(Vec::new())
    }
    fn ident(&self) -> stypes::Ident {
        stypes::Ident {
            name: String::from("DLT Export Parser"),
            desc: String::from("DLT Export Parser"),
            uuid: DLT_PARSER_UUID,
        }
    }
    fn lazy_fields_getter(
        &self,
        _origin: SessionAction,
        _cancel: CancellationToken,
    ) -> components::LazyFieldsTask {
        Box::pin(async move { Ok(Vec::new()) })
    }
    fn ty(&self) -> stypes::ComponentType {
        stypes::ComponentType::Parser
    }
}
