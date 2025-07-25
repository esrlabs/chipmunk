use crate::dlt::*;
use components::{ComponentDescriptor, ComponentFactory, StaticFieldResult};
use dlt_core::{
    read::DltMessageReader,
    statistics::{
        collect_statistics,
        common::{StatisticInfo, StatisticInfoCollector},
    },
};
use std::fmt;
use std::fs::File;
use std::{collections::HashMap, path::PathBuf};
use stypes::{
    ExtractByKey, Field, FieldDesc, NativeError, NativeErrorKind, SessionAction, Severity,
    StaticFieldDesc, ValueInput, missed_field_err as missed,
};
use tokio_util::sync::CancellationToken;

const DLT_PARSER_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
]);

const FIELD_LOG_LEVEL: &str = "DLT_PARSER_FIELD_LOG_LEVEL";
const FIELD_FIBEX_FILES: &str = "DLT_PARSER_FIELD_FIBEX_FILES";
const FIELD_STATISTICS: &str = "DLT_PARSER_FIELD_STATISTICS";
const FIELD_TZ: &str = "DLT_PARSER_FIELD_TIMEZONE";

#[derive(Default)]
pub struct Descriptor {}

enum StatFields {
    AppIds,
    ContextIds,
    EcuIds,
}

impl fmt::Display for StatFields {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{}",
            match self {
                Self::AppIds => "app_ids",
                Self::ContextIds => "context_ids",
                Self::EcuIds => "ecu_ids",
            }
        )
    }
}

impl ComponentFactory<crate::Parser> for Descriptor {
    fn create(
        &self,
        origin: &SessionAction,
        options: &[Field],
    ) -> Result<Option<(crate::Parser, Option<String>)>, NativeError> {
        let errors = self.validate(origin, options)?;
        if !errors.is_empty() {
            return Err(NativeError {
                kind: NativeErrorKind::Configuration,
                severity: Severity::ERROR,
                message: Some(
                    errors
                        .values()
                        .map(String::as_str)
                        .collect::<Vec<_>>()
                        .join("; "),
                ),
            });
        }
        let fibex_file_paths: &Vec<PathBuf> = options
            .extract_by_key(FIELD_FIBEX_FILES)
            .ok_or(missed(FIELD_FIBEX_FILES))?
            .value;
        let dlt_metadata = dlt_core::fibex::gather_fibex_data(dlt_core::fibex::FibexConfig {
            fibex_file_paths: fibex_file_paths
                .iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect(),
        });
        let someip_metadata = FibexSomeipMetadata::from_fibex_files(fibex_file_paths);
        let min_log_level = u8_to_log_level(
            options
                .extract_by_key(FIELD_LOG_LEVEL)
                .ok_or(missed(FIELD_LOG_LEVEL))?
                .value,
        )
        .ok_or(missed(FIELD_LOG_LEVEL))?;
        let stats: &HashMap<String, Vec<String>> = options
            .extract_by_key(FIELD_STATISTICS)
            .ok_or(missed(FIELD_STATISTICS))?
            .value;
        let filter_config: ProcessedDltFilterConfig = ProcessedDltFilterConfig {
            min_log_level: Some(min_log_level),
            app_ids: stats
                .get(&StatFields::AppIds.to_string())
                .map(|fields| fields.iter().cloned().collect()),
            ecu_ids: stats
                .get(&StatFields::EcuIds.to_string())
                .map(|fields| fields.iter().cloned().collect()),
            context_ids: stats
                .get(&StatFields::ContextIds.to_string())
                .map(|fields| fields.iter().cloned().collect()),
            app_id_count: 0,
            context_id_count: 0,
        };
        Ok(Some((
            crate::Parser::Dlt(DltParser::new(
                Some(filter_config),
                dlt_metadata,
                None,
                someip_metadata,
                // If it's source - no storage header expected
                !matches!(origin, SessionAction::Source),
            )),
            Some("DLT".to_owned()),
        )))
    }
}

impl ComponentDescriptor for Descriptor {
    fn get_render(&self) -> Option<stypes::OutputRender> {
        Some(stypes::OutputRender::Columns(vec![
            ("Datetime".to_owned(), 150),
            ("ECUID".to_owned(), 80),
            ("VERS".to_owned(), 80),
            ("SID".to_owned(), 80),
            ("MCNT".to_owned(), 80),
            ("TMS".to_owned(), 80),
            ("EID".to_owned(), 80),
            ("APID".to_owned(), 80),
            ("CTID".to_owned(), 80),
            ("MSTP".to_owned(), 80),
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
                .map(|ext| ext.to_ascii_lowercase() == "dlt")
                .unwrap_or_default()
        })
    }
    fn fields_getter(&self, origin: &SessionAction) -> components::FieldsResult {
        let mut options = vec![
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_LOG_LEVEL.to_owned(),
                name: "Log Level".to_owned(),
                desc: "Log Level — defines the minimum severity level of log messages to be displayed. Messages with lower severity (e.g., Debug or Verbose) will be filtered out. For example, if \"Error\" is selected, only messages with level \"Error\" and above (e.g., Fatal) will be shown, while lower levels such as \"Warning\" or \"Debug\" will be ignored.".to_owned(),
                required: true,
                interface: ValueInput::NamedNumbers(
                    vec![
                        ("Fatal".to_owned(), 1),
                        ("Error".to_owned(), 2),
                        ("Warn".to_owned(), 3),
                        ("Info".to_owned(), 4),
                        ("Debug".to_owned(), 5),
                        ("Verbose".to_owned(), 6),
                    ],
                    6,
                ),
                binding: None,
            }),
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_FIBEX_FILES.to_owned(),
                name: "Fibex Files".to_owned(),
                desc: "Fibex Files — allows the user to attach one or more XML files containing the schema definitions for decoding the DLT payload. These files are used to interpret the payload contents according to the provided descriptions. If decoding fails or no matching schema is found, the payload will be displayed as-is, in raw hexadecimal form.".to_owned(),
                required: true,
                interface: ValueInput::Files(vec!["xml".to_owned(), "*".to_owned()]),
                binding: None,
            }),
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_TZ.to_owned(),
                name: "Timezone".to_owned(),
                desc: "Timezone — a display-only setting used for visualizing timestamps. If a timezone is specified, all DLT timestamps will be adjusted accordingly to improve readability. This setting does not modify the underlying data and is used purely for presentation purposes.".to_owned(),
                required: true,
                interface: ValueInput::Timezone,
                binding: None,
            }),
        ];
        if matches!(origin, SessionAction::File(..) | SessionAction::Files(..)) {
            options.push(stypes::FieldDesc::Lazy(stypes::LazyFieldDesc {
                id: FIELD_STATISTICS.to_owned(),
                name: String::from("Statistics"),
                desc: String::from("Collected Statistis Data"),
                binding: None,
            }));
        }
        Ok(options)
    }
    fn ident(&self) -> stypes::Ident {
        stypes::Ident {
            name: String::from("DLT"),
            desc: String::from(
                "DLT Parser is a binary parser for decoding AUTOSAR DLT (Diagnostic Log and Trace) messages. It processes raw binary input and extracts structured log information according to the DLT protocol specification. The parser can be applied both to files (typically containing a StorageHeader) and to live streams over TCP or UDP. It expects binary data as input and does not perform any framing or transport-level parsing.",
            ),
            io: stypes::IODataType::Multiple(vec![
                stypes::IODataType::NetworkFramePayload,
                stypes::IODataType::Raw,
            ]),
            uuid: DLT_PARSER_UUID,
        }
    }
    fn lazy_fields_getter(
        &self,
        origin: SessionAction,
        cancel: CancellationToken,
    ) -> components::LazyFieldsTask {
        Box::pin(async move {
            let file_paths = match origin {
                SessionAction::File(fp) => {
                    vec![fp]
                }
                SessionAction::Files(fps) => fps,
                _ => {
                    return Ok(vec![StaticFieldResult::Success(stypes::StaticFieldDesc {
                        id: FIELD_STATISTICS.to_owned(),
                        name: String::from("Example"),
                        desc: String::from("Example"),
                        required: true,
                        interface: ValueInput::KeyString(HashMap::new()),
                        binding: None,
                    })]);
                }
            };
            let mut stat = StatisticInfo::new();
            let mut error: Option<String> = None;
            file_paths.iter().for_each(|file_path| {
                if error.is_some() || cancel.is_cancelled() {
                    return;
                }
                match File::open(file_path) {
                    Ok(file) => {
                        let mut reader = DltMessageReader::new(file, true);
                        let mut collector = StatisticInfoCollector::default();
                        match collect_statistics(&mut reader, &mut collector) {
                            Ok(()) => {
                                stat.merge(collector.collect());
                            }
                            Err(err) => {
                                error = Some(err.to_string());
                            }
                        }
                    }
                    Err(err) => {
                        error = Some(err.to_string());
                    }
                }
            });
            if cancel.is_cancelled() {
                return Err(NativeError {
                    kind: NativeErrorKind::Interrupted,
                    severity: Severity::WARNING,
                    message: Some("Operation has been cancelled".to_owned()),
                });
            }
            if let Some(err) = error {
                return Err(NativeError {
                    kind: NativeErrorKind::Io,
                    severity: Severity::ERROR,
                    message: Some(err),
                });
            }
            static NON_LOG: &str = "non_log";
            static LOG_FATAL: &str = "log_fatal";
            static LOG_ERROR: &str = "log_error";
            static LOG_WARNING: &str = "log_warning";
            static LOG_INFO: &str = "log_info";
            static LOG_DEBUG: &str = "log_debug";
            static LOG_VERBOSE: &str = "log_verbose";
            static LOG_INVALID: &str = "log_invalid";
            let mut converted: HashMap<String, HashMap<String, HashMap<String, usize>>> =
                HashMap::new();
            [
                StatFields::AppIds,
                StatFields::ContextIds,
                StatFields::EcuIds,
            ]
            .into_iter()
            .for_each(|key| {
                let inner = match key {
                    StatFields::AppIds => &stat.app_ids,
                    StatFields::ContextIds => &stat.context_ids,
                    StatFields::EcuIds => &stat.ecu_ids,
                };
                let mut entity: HashMap<String, HashMap<String, usize>> = HashMap::new();
                inner.into_iter().for_each(|(id, levels)| {
                    let mut map: HashMap<String, usize> = HashMap::new();
                    map.insert(NON_LOG.to_owned(), levels.non_log);
                    map.insert(LOG_FATAL.to_owned(), levels.log_fatal);
                    map.insert(LOG_ERROR.to_owned(), levels.log_error);
                    map.insert(LOG_WARNING.to_owned(), levels.log_warning);
                    map.insert(LOG_INFO.to_owned(), levels.log_info);
                    map.insert(LOG_DEBUG.to_owned(), levels.log_debug);
                    map.insert(LOG_VERBOSE.to_owned(), levels.log_verbose);
                    map.insert(LOG_INVALID.to_owned(), levels.log_invalid);
                    entity.insert(id.to_owned(), map);
                });
                converted.insert(key.to_string(), entity);
            });
            Ok(vec![StaticFieldResult::Success(stypes::StaticFieldDesc {
                id: FIELD_STATISTICS.to_owned(),
                name: String::from("Statistics"),
                desc: String::from("Dlt File(s) Statistics data"),
                required: true,
                interface: ValueInput::NestedNumbersMap(
                    converted,
                    vec![
                        (String::from("non_log"), String::from("NON LOG")),
                        (String::from("log_fatal"), String::from("FATAL")),
                        (String::from("log_error"), String::from("ERROR")),
                        (String::from("log_warning"), String::from("WARNING")),
                        (String::from("log_info"), String::from("INFO")),
                        (String::from("log_debug"), String::from("DEBUG")),
                        (String::from("log_verbose"), String::from("VERBOSE")),
                        (String::from("log_invalid"), String::from("INVALID")),
                        (String::from("context_ids"), String::from("CONTEXT LIST")),
                    ]
                    .into_iter()
                    .collect(),
                ),
                binding: None,
            })])
        })
    }
    fn ty(&self) -> stypes::ComponentType {
        stypes::ComponentType::Parser
    }
}

fn u8_to_log_level(level: u8) -> Option<dlt::LogLevel> {
    match level {
        1 => Some(dlt::LogLevel::Fatal),
        2 => Some(dlt::LogLevel::Error),
        3 => Some(dlt::LogLevel::Warn),
        4 => Some(dlt::LogLevel::Info),
        5 => Some(dlt::LogLevel::Debug),
        6 => Some(dlt::LogLevel::Verbose),
        _ => None,
    }
}
