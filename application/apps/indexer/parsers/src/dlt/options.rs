use tokio_util::sync::CancellationToken;

use crate::dlt::*;

const DLT_PARSER_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
]);

const FIELD_LOG_LEVEL: &str = "log_level";
const FIELD_STATISTICS: &str = "statistics";

impl DltParser<'_> {
    pub fn fields(
        _origin: &stypes::SourceOrigin,
    ) -> Result<Vec<stypes::FieldDesc>, stypes::NativeError> {
        Ok(vec![
            stypes::FieldDesc::Static(stypes::StaticFieldDesc {
                id: FIELD_LOG_LEVEL.to_owned(),
                name: String::from("Log Level"),
                desc: String::from("DLT Log Level"),
                required: true,
                default: Some(stypes::Value::Integer(1)),
                interface: stypes::ValueInterface::DropList(Vec::new()),
            }),
            stypes::FieldDesc::Lazy(stypes::LazyFieldDesc {
                id: FIELD_STATISTICS.to_owned(),
                name: String::from("Statistics"),
                desc: String::from("Collected Statistis Data"),
            }),
        ])
    }
    pub fn statistits(
        _origin: &stypes::SourceOrigin,
        _cancel: &CancellationToken,
    ) -> components::LazyFieldsTask {
        Box::pin(async {
            Ok(vec![stypes::StaticFieldDesc {
                id: FIELD_LOG_LEVEL.to_owned(),
                name: String::from("Example"),
                desc: String::from("Example"),
                required: true,
                default: Some(stypes::Value::Integer(1)),
                interface: stypes::ValueInterface::DropList(Vec::new()),
            }])
        })
    }
}

impl components::Component for DltParser<'_> {
    fn ident() -> stypes::Ident {
        stypes::Ident {
            name: String::from("DLT Parser"),
            desc: String::from("DLT Parser"),
            uuid: DLT_PARSER_UUID,
        }
    }
    fn register(components: &mut components::Components) -> Result<(), stypes::NativeError> {
        components.register_parser(
            &Self::ident(),
            Some(DltParser::fields),
            Some(DltParser::statistits),
        )?;
        Ok(())
    }
}

const DLT_RANGE_PARSER_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x01, 0x02, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
]);

impl components::Component for DltRangeParser {
    fn ident() -> stypes::Ident {
        stypes::Ident {
            name: String::from("DLT Range Parser"),
            desc: String::from("DLT Range Parser"),
            uuid: DLT_RANGE_PARSER_UUID,
        }
    }
    fn register(_components: &mut components::Components) -> Result<(), stypes::NativeError> {
        Ok(())
    }
}

const DLT_RAW_PARSER_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x01, 0x03, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
]);

impl components::Component for DltRawParser {
    fn ident() -> stypes::Ident {
        stypes::Ident {
            name: String::from("DLT Raw Parser"),
            desc: String::from("DLT Raw Parser"),
            uuid: DLT_RAW_PARSER_UUID,
        }
    }
    fn register(_components: &mut components::Components) -> Result<(), stypes::NativeError> {
        Ok(())
    }
}
