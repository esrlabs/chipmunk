use crate::dlt::*;
use components::{ComponentDescriptor, MetadataDescriptor, StaticFieldResult};
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
    FieldDesc, NativeError, NativeErrorKind, Severity, SourceOrigin, StaticFieldDesc, Value,
    ValueInput,
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

fn to_native_cfg_err<S: ToString>(msg: S) -> NativeError {
    NativeError {
        severity: Severity::ERROR,
        kind: NativeErrorKind::Configuration,
        message: Some(msg.to_string()),
    }
}

impl ComponentDescriptor<crate::Parser> for Descriptor {
    fn create(
        &self,
        origin: &SourceOrigin,
        options: &[stypes::Field],
    ) -> Result<Option<crate::Parser>, stypes::NativeError> {
        let mut filter_config: Option<ProcessedDltFilterConfig> = None;
        let mut someip_metadata: Option<FibexSomeipMetadata> = None;
        let mut dlt_metadata: Option<FibexDltMetadata> = None;
        for field in options.into_iter() {
            if field.id == FIELD_FIBEX_FILES {
                let Value::Files(paths) = &field.value else {
                    return Err(to_native_cfg_err("Invalid settings for Fibex files paths"));
                };
                someip_metadata = if paths.is_empty() {
                    None
                } else {
                    FibexSomeipMetadata::from_fibex_files(paths.clone())
                };
                dlt_metadata = if paths.is_empty() {
                    None
                } else {
                    dlt_core::fibex::gather_fibex_data(dlt_core::fibex::FibexConfig {
                        fibex_file_paths: paths
                            .iter()
                            .map(|p| p.to_string_lossy().to_string())
                            .collect(),
                    })
                };
            }
        }
        Ok(Some(crate::Parser::Dlt(DltParser::new(
            None,
            dlt_metadata,
            None,
            someip_metadata,
            // If it's source - no storage header expected
            !matches!(origin, SourceOrigin::Source),
        ))))
    }
}
impl MetadataDescriptor for Descriptor {
    fn is_compatible(&self, origin: &SourceOrigin) -> bool {
        let files = match origin {
            SourceOrigin::File(filepath) => {
                vec![filepath]
            }
            SourceOrigin::Files(files) => files.iter().collect(),
            SourceOrigin::Source | SourceOrigin::Folder(..) | SourceOrigin::Folders(..) => {
                return true
            }
        };
        files.iter().any(|fp| {
            fp.extension()
                .map(|ext| ext.to_ascii_lowercase() == "dlt")
                .unwrap_or_default()
        })
    }
    fn fields_getter(&self, origin: &SourceOrigin) -> components::FieldsResult {
        let mut options = vec![
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_LOG_LEVEL.to_owned(),
                name: "Log Level".to_owned(),
                desc: "Log Level".to_owned(),
                required: true,
                interface: ValueInput::Strings(
                    vec![
                        "Fatal".to_owned(),
                        "Error".to_owned(),
                        "Warn".to_owned(),
                        "Info".to_owned(),
                        "Debug".to_owned(),
                        "Verbose".to_owned(),
                    ],
                    "Verbose".to_owned(),
                ),
                binding: None,
            }),
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_FIBEX_FILES.to_owned(),
                name: "Fibex Files".to_owned(),
                desc: "Fibex Files".to_owned(),
                required: true,
                interface: ValueInput::Files(vec!["xml".to_owned(), "*".to_owned()]),
                binding: None,
            }),
        ];
        if matches!(origin, SourceOrigin::File(..) | SourceOrigin::Files(..)) {
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
            name: String::from("DLT Parser"),
            desc: String::from("DLT Parser"),
            uuid: DLT_PARSER_UUID,
        }
    }
    fn lazy_fields_getter(
        &self,
        origin: SourceOrigin,
        cancel: CancellationToken,
    ) -> components::LazyFieldsTask {
        Box::pin(async move {
            let file_paths = match origin {
                SourceOrigin::File(fp) => {
                    vec![fp]
                }
                SourceOrigin::Files(fps) => fps,
                _ => {
                    return Ok(vec![StaticFieldResult::Success(stypes::StaticFieldDesc {
                        id: FIELD_STATISTICS.to_owned(),
                        name: String::from("Example"),
                        desc: String::from("Example"),
                        required: true,
                        interface: ValueInput::KeyString(HashMap::new()),
                        binding: None,
                    })])
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
