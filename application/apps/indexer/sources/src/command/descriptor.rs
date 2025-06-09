use super::ProcessSource;
use components::{ComponentDescriptor, ComponentFactory};
use std::{collections::HashMap, env};
use stypes::{FieldDesc, SessionAction, StaticFieldDesc, Value, ValueInput};

const TERM_SOURCE_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07,
]);

const FIELD_COMMAND: &str = "COMMAND_FIELD_COMMAND";
const FIELD_CWD: &str = "COMMAND_FIELD_CWD";
const FIELD_SHELLS: &str = "COMMAND_FIELD_SHELLS";

#[derive(Default)]
pub struct Descriptor {}

impl ComponentFactory<crate::Source> for Descriptor {
    fn create(
        &self,
        _origin: &SessionAction,
        options: &[stypes::Field],
    ) -> Result<Option<crate::Source>, stypes::NativeError> {
        let Some(command) = options.iter().find_map(|field| {
            if field.id == FIELD_COMMAND {
                if let Value::String(command) = &field.value {
                    Some(command.clone())
                } else {
                    None
                }
            } else {
                None
            }
        }) else {
            return Ok(None);
        };
        Ok(Some(crate::Source::Process(
            ProcessSource::new(command, env::current_dir().unwrap(), HashMap::new()).unwrap(),
        )))
    }
}

impl ComponentDescriptor for Descriptor {
    fn fields_getter(&self, _origin: &stypes::SessionAction) -> components::FieldsResult {
        let mut shells = vec![("".to_owned(), "Default".to_owned())];
        if let Ok(profiles) = envvars::get_profiles() {
            shells = profiles
                .into_iter()
                .map(|profile| {
                    let path = profile.path.to_string_lossy();
                    (format!("{} ({path})", profile.name), path.to_string())
                })
                .collect();
        }
        Ok(vec![
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_COMMAND.to_owned(),
                name: "Terminal Command".to_owned(),
                desc: String::new(),
                required: true,
                interface: ValueInput::String(String::new(), "terminal command".to_owned()),
                binding: None,
            }),
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_CWD.to_owned(),
                name: "Working Folder".to_owned(),
                desc: String::new(),
                required: true,
                interface: ValueInput::Directory(
                    env::current_dir()
                        .map(|cwd| Some(cwd.to_string_lossy().to_string()))
                        .unwrap_or(None),
                ),
                binding: None,
            }),
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_SHELLS.to_owned(),
                name: "Shell".to_owned(),
                desc: String::new(),
                required: true,
                interface: ValueInput::NamedStrings(shells),
                binding: None,
            }),
        ])
    }
    fn is_compatible(&self, origin: &SessionAction) -> bool {
        match origin {
            SessionAction::File(..) | SessionAction::Files(..) | SessionAction::ExportRaw(..) => {
                false
            }
            SessionAction::Source => true,
        }
    }
    fn ident(&self) -> stypes::Ident {
        stypes::Ident {
            name: String::from("Command Output"),
            desc: String::from("Reads the standard output (stdout) of a launched command. The data is passed to the parser as lines of text."),
            io: stypes::IODataType::PlaitText,
            uuid: TERM_SOURCE_UUID,
        }
    }
    fn ty(&self) -> stypes::ComponentType {
        stypes::ComponentType::Source
    }
    fn validate(
        &self,
        _origin: &stypes::SessionAction,
        fields: &[stypes::Field],
    ) -> HashMap<String, String> {
        let mut errors = HashMap::new();
        fields.iter().for_each(|field| {
            if field.id == FIELD_COMMAND {
                if let Value::String(path) = &field.value {
                    if path.trim().is_empty() {
                        errors.insert(field.id.clone(), "command cannot be empty".to_owned());
                    }
                }
            }
        });
        errors
    }
}
