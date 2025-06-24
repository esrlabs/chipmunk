use components::{ComponentDescriptor, ComponentFactory};
use stypes::{FieldDesc, SessionAction, StaticFieldDesc, ValueInput};

use super::SomeipParser;

const SOMEIP_PARSER_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
]);

// TODO: fields IDs could be same for diff parser/source... on level of Options event
// we should also provide a master of field to prevent conflicts.
const FIELD_FIBEX_FILES: &str = "SOMEIP_PARSER_FIELD_FIBEX_FILES";
const FIELD_TZ: &str = "SOMEIP_PARSER_FIELD_TIMEZONE";

#[derive(Default)]
pub struct Descriptor {}

impl ComponentFactory<crate::AllParserTypes> for Descriptor {
    fn create(
        &self,
        _origin: &SessionAction,
        _options: &[stypes::Field],
    ) -> Result<Option<crate::AllParserTypes>, stypes::NativeError> {
        Ok(Some(crate::AllParserTypes::SomeIp(SomeipParser::new())))
    }
}

impl ComponentDescriptor for Descriptor {
    fn get_render(&self) -> Option<stypes::OutputRender> {
        Some(stypes::OutputRender::Columns(vec![
            ("SOME/IP".to_owned(), 50),
            ("SERV".to_owned(), 50),
            ("METH".to_owned(), 50),
            ("LENG".to_owned(), 30),
            ("CLID".to_owned(), 30),
            ("SEID".to_owned(), 30),
            ("IVER".to_owned(), 30),
            ("MSTP".to_owned(), 30),
            ("RETC".to_owned(), 30),
            ("PAYLOAD".to_owned(), 0),
        ]))
    }
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
                desc: "Fibex Files — allows the user to attach one or more XML files containing the schema definitions for decoding the payload. These files are used to interpret the payload contents according to the provided descriptions. If decoding fails or no matching schema is found, the payload will be displayed as-is, in raw hexadecimal form.".to_owned(),
                required: true,
                interface: ValueInput::Files(vec!["xml".to_owned(), "*".to_owned()]),
                binding: None,
            }),
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_TZ.to_owned(),
                name: "Timezone".to_owned(),
                desc: "Timezone — a display-only setting used for visualizing timestamps. If a timezone is specified, all timestamps will be adjusted accordingly to improve readability. This setting does not modify the underlying data and is used purely for presentation purposes.".to_owned(),
                required: true,
                interface: ValueInput::Timezone,
                binding: None,
            }),
        ])
    }

    fn ident(&self) -> stypes::Ident {
        stypes::Ident {
            name: String::from("SOME/IP"),
            desc: String::from(
                "SomeIP Parser is a binary parser designed to decode messages conforming to the AUTOSAR SOME/IP (Scalable service-Oriented Middleware over IP) protocol. It processes raw binary input and extracts structured message data, including service ID, method ID, payload length, and more. The parser can be applied to both files and network streams (e.g., TCP/UDP). If a valid DLT message is detected within the SOME/IP payload, it will be automatically passed to the DLT parser and decoded accordingly.",
            ),
            io: stypes::IODataType::NetworkFramePayload,
            uuid: SOMEIP_PARSER_UUID,
        }
    }
    fn ty(&self) -> stypes::ComponentType {
        stypes::ComponentType::Parser
    }
}
