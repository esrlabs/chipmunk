use std::collections::HashMap;

use super::SomeipParser;
use components::{ComponentDescriptor, StaticFieldResult};
use tokio::{
    select,
    time::{sleep, Duration},
};
use tokio_util::sync::CancellationToken;

const SOMEIP_PARSER_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
]);

// TODO: fields IDs could be same for diff parser/source... on level of Options event
// we should also provide a master of field to prevent conflicts.
const FIELD_LOG_LEVEL: &str = "log_level";
const FIELD_STATISTICS: &str = "statistics";

#[derive(Default)]
struct Descriptor {}

impl ComponentDescriptor for Descriptor {
    fn fields_getter(&self, _origin: &stypes::SourceOrigin) -> components::FieldsResult {
        Ok(vec![stypes::FieldDesc::Static(stypes::StaticFieldDesc {
            id: FIELD_LOG_LEVEL.to_owned(),
            name: String::from("Log Level"),
            desc: String::from("DLT Log Level"),
            required: true,
            interface: stypes::ValueInput::KeyString(HashMap::new()),
            binding: None,
        })])
    }
    fn ident(&self) -> stypes::Ident {
        stypes::Ident {
            name: String::from("SomeIP Parser"),
            desc: String::from("SomeIP Parser"),
            uuid: SOMEIP_PARSER_UUID,
        }
    }
    fn lazy_fields_getter(
        &self,
        _origin: stypes::SourceOrigin,
        cancel: CancellationToken,
    ) -> components::LazyFieldsTask {
        Box::pin(async move {
            // Sleep a little to emulate loading
            let duration = Duration::from_millis(100);
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
                interface: stypes::ValueInput::KeyString(HashMap::new()),
                binding: None,
            })])
        })
    }
    fn ty(&self) -> stypes::ComponentType {
        stypes::ComponentType::Parser
    }
}

impl components::Component for SomeipParser {
    fn register(components: &mut components::Components) -> Result<(), stypes::NativeError> {
        components.register(Descriptor::default())?;
        Ok(())
    }
}
