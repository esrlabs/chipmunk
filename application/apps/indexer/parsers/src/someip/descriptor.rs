use components::{ComponentDescriptor, ComponentFactory};
use stypes::{FieldDesc, SessionAction, StaticFieldDesc, ValueInput};

const SOMEIP_PARSER_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
]);

// TODO: fields IDs could be same for diff parser/source... on level of Options event
// we should also provide a master of field to prevent conflicts.
const FIELD_FIBEX_FILES: &str = "SOMEIP_PARSER_FIELD_FIBEX_FILES";
const FIELD_TZ: &str = "SOMEIP_PARSER_FIELD_TIMEZONE";

#[derive(Default)]
pub struct Descriptor {}

impl ComponentFactory<crate::Parser> for Descriptor {
    fn create(
        &self,
        _origin: &SessionAction,
        _options: &[stypes::Field],
    ) -> Result<Option<crate::Parser>, stypes::NativeError> {
        Ok(None)
    }
}

impl ComponentDescriptor for Descriptor {
    fn is_compatible(&self, origin: &SessionAction) -> bool {
        let files = match origin {
            SessionAction::File(filepath) => {
                vec![filepath]
            }
            SessionAction::Files(files) => files.iter().collect(),
            SessionAction::Source => return true,
            SessionAction::ExportRaw(..) => return false,
        };
        files.iter().any(|fp| {
            fp.extension()
                .map(|ext| {
                    ["dlt", "pcap", "pcapng"]
                        .contains(&ext.to_string_lossy().to_lowercase().as_str())
                })
                .unwrap_or_default()
        })
    }
    fn fields_getter(&self, _origin: &SessionAction) -> components::FieldsResult {
        Ok(vec![
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_FIBEX_FILES.to_owned(),
                name: "Fibex Files".to_owned(),
                desc: "Fibex Files".to_owned(),
                required: true,
                interface: ValueInput::Files(vec!["xml".to_owned(), "*".to_owned()]),
                binding: None,
            }),
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_TZ.to_owned(),
                name: "Timezone".to_owned(),
                desc: "Timezone".to_owned(),
                required: true,
                interface: ValueInput::Timezone,
                binding: None,
            }),
        ])
    }

    fn ident(&self) -> stypes::Ident {
        stypes::Ident {
            name: String::from("SomeIP Parser"),
            desc: String::from("SomeIP Parser"),
            uuid: SOMEIP_PARSER_UUID,
        }
    }
    fn ty(&self) -> stypes::ComponentType {
        stypes::ComponentType::Parser
    }
}
