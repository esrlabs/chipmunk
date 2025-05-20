use super::*;
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
    0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09,
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
        _options: &[stypes::Field],
    ) -> Result<Option<crate::Parser>, stypes::NativeError> {
        Ok(Some(crate::Parser::DltRaw(DltRawParser::new(!matches!(
            origin,
            SourceOrigin::Source
        )))))
    }
}

impl MetadataDescriptor for Descriptor {
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
