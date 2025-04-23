use std::collections::HashMap;

use components::{ComponentDescriptor, StaticFieldResult};
use tokio::{
    select,
    time::{sleep, Duration},
};
use tokio_util::sync::CancellationToken;

use crate::dlt::*;

const DLT_PARSER_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
]);

const FIELD_LOG_LEVEL: &str = "log_level";
const FIELD_STATISTICS: &str = "statistics";

#[derive(Default)]
struct Descriptor {}

impl ComponentDescriptor for Descriptor {
    fn fields_getter(&self, _origin: &stypes::SourceOrigin) -> components::FieldsResult {
        Ok(vec![
            stypes::FieldDesc::Static(stypes::StaticFieldDesc {
                id: FIELD_LOG_LEVEL.to_owned(),
                name: String::from("Log Level"),
                desc: String::from("DLT Log Level"),
                required: true,
                default: Some(stypes::Value::Number(1)),
                interface: stypes::ValueInput::KeyString(HashMap::new()),
                binding: None,
            }),
            stypes::FieldDesc::Lazy(stypes::LazyFieldDesc {
                id: FIELD_STATISTICS.to_owned(),
                name: String::from("Statistics"),
                desc: String::from("Collected Statistis Data"),
                binding: None,
            }),
        ])
    }
    fn ident(&self) -> stypes::Ident {
        stypes::Ident {
            name: String::from("DLT Parser"),
            desc: String::from("DLT Parser"),
            uuid: DLT_PARSER_UUID,
        }
    }
    fn lazy_fields_getter(
        &self,
        _origin: stypes::SourceOrigin,
        cancel: CancellationToken,
    ) -> components::LazyFieldsTask {
        Box::pin(async move {
            let duration = Duration::from_millis(5000);
            select! {
                _ = sleep(duration) => {
                    // no cancelation
                },
                _ = cancel.cancelled() => {
                    // cancelled
                    return Ok(Vec::new());
                }
            };
            Ok(vec![StaticFieldResult::Success(stypes::StaticFieldDesc {
                id: FIELD_STATISTICS.to_owned(),
                name: String::from("Example"),
                desc: String::from("Example"),
                required: true,
                default: Some(stypes::Value::Number(1)),
                interface: stypes::ValueInput::KeyString(HashMap::new()),
                binding: None,
            })])
        })
    }
    fn ty(&self) -> stypes::ComponentType {
        stypes::ComponentType::Parser
    }
}

impl components::Component for DltParser<'_> {
    fn register(components: &mut components::Components) -> Result<(), stypes::NativeError> {
        components.register(Descriptor::default())?;
        Ok(())
    }
}

impl components::Component for DltRangeParser {
    fn register(_components: &mut components::Components) -> Result<(), stypes::NativeError> {
        Ok(())
    }
}

impl components::Component for DltRawParser {
    fn register(_components: &mut components::Components) -> Result<(), stypes::NativeError> {
        Ok(())
    }
}
