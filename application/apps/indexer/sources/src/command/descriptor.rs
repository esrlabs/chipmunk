use super::ProcessSource;
use crate::*;
use descriptor::{CommonDescriptor, FieldsResult, SourceDescriptor};
use std::{collections::HashMap, env};
use stypes::{
    ExtractByKey, Extracted, Field, FieldDesc, NativeError, NativeErrorKind, SessionAction,
    Severity, StaticFieldDesc, ValueInput, missed_field_err as missed,
};

const TERM_SOURCE_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07,
]);

const FIELD_COMMAND: &str = "COMMAND_FIELD_COMMAND";
const FIELD_CWD: &str = "COMMAND_FIELD_CWD";
const FIELD_SHELLS: &str = "COMMAND_FIELD_SHELLS";

#[derive(Default)]
pub struct Descriptor {}

pub fn factory(
    origin: &SessionAction,
    options: &[Field],
) -> Result<Option<(Sources, Option<String>)>, NativeError> {
    let command: String = options
        .extract_by_key(FIELD_COMMAND)
        .ok_or(missed(FIELD_COMMAND))?
        .value;
    Ok(Some((
        Sources::Process(
            ProcessSource::new(&command, env::current_dir().unwrap(), HashMap::new()).unwrap(),
        ),
        Some(command),
    )))
}

impl CommonDescriptor for Descriptor {
    fn fields_getter(&self, _origin: &SessionAction) -> FieldsResult {
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
                interface: ValueInput::NamedStrings(shells, String::new()),
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
            desc: String::from(
                "Reads the standard output (stdout) of a launched command. The data is passed to the parser as lines of text.",
            ),
            io: stypes::IODataType::PlaitText,
            uuid: TERM_SOURCE_UUID,
        }
    }
    fn validate(
        &self,
        _origin: &SessionAction,
        fields: &[Field],
    ) -> Result<HashMap<String, String>, NativeError> {
        let mut errors = HashMap::new();
        let command: Extracted<String> = fields
            .extract_by_key(FIELD_COMMAND)
            .ok_or(missed(FIELD_COMMAND))?;
        if command.value.trim().is_empty() {
            errors.insert(command.id.to_owned(), "command cannot be empty".to_owned());
        }
        Ok(errors)
    }
}
impl SourceDescriptor for Descriptor {}
