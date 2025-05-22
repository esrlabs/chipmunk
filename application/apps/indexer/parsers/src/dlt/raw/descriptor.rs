use super::*;
use components::{ComponentFactory, ComponentDescriptor};
use stypes::SourceOrigin;
use tokio_util::sync::CancellationToken;

const DLT_PARSER_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x01, 0x02, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
]);

#[derive(Default)]
pub struct Descriptor {}

impl ComponentFactory<crate::Parser> for Descriptor {
    fn create(
        &self,
        origin: &SourceOrigin,
        _options: &[stypes::Field],
    ) -> Result<Option<crate::Parser>, stypes::NativeError> {
        Ok(Some(crate::Parser::DltRaw(DltRawParser::new(!matches!(
            origin,
            SourceOrigin::Source
        )))))
    }
}

impl ComponentDescriptor for Descriptor {
    fn is_compatible(&self, origin: &SourceOrigin) -> bool {
        let files = match origin {
            SourceOrigin::File(filepath) => {
                vec![filepath]
            }
            SourceOrigin::Files(files) => files.iter().collect(),
            SourceOrigin::Source => return true,
        };
        files.iter().any(|fp| {
            fp.extension()
                .map(|ext| ext.to_ascii_lowercase() == "dlt")
                .unwrap_or_default()
        })
    }
    fn fields_getter(&self, _origin: &SourceOrigin) -> components::FieldsResult {
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
        _origin: SourceOrigin,
        _cancel: CancellationToken,
    ) -> components::LazyFieldsTask {
        Box::pin(async move { Ok(Vec::new()) })
    }
    fn ty(&self) -> stypes::ComponentType {
        stypes::ComponentType::RawParser
    }
}
