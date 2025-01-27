//! # Formatting dlt messages as text
use chrono::prelude::{DateTime, Utc};
use chrono_tz::Tz;
use dlt_core::{
    dlt::{
        Argument, ControlType, DltTimeStamp, ExtendedHeader, LogLevel, Message, MessageType,
        NetworkTraceType, PayloadContent, StandardHeader, StorageHeader, StringCoding, TypeInfo,
        TypeInfoKind, Value,
    },
    fibex::{extract_metadata, FibexMetadata as FibexDltMetadata},
    parse::construct_arguments,
    service_id::service_id_lookup,
};
use plugins_api::{log::trace, parser::ParsedMessage};

use std::{
    fmt::{self, Formatter, Write},
    str,
};

const DLT_ARGUMENT_SENTINAL: char = '\u{0005}';
pub const COLUMN_LEN: usize = 11;

fn try_new_from_fibex_message_info(message_info: &str) -> Option<MessageType> {
    Some(MessageType::Log(match message_info {
        "DLT_LOG_FATAL" => LogLevel::Fatal,
        "DLT_LOG_ERROR" => LogLevel::Error,
        "DLT_LOG_WARN" => LogLevel::Warn,
        "DLT_LOG_INFO" => LogLevel::Info,
        "DLT_LOG_DEBUG" => LogLevel::Debug,
        "DLT_LOG_VERBOSE" => LogLevel::Verbose,
        _ => return None,
    }))
}

struct DltMessageType<'a>(&'a MessageType);

impl fmt::Display for DltMessageType<'_> {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        match &self.0 {
            MessageType::ApplicationTrace(app_type) => write!(f, "{} ", app_type.as_ref()),
            MessageType::Control(c) => write!(f, "{}", c.as_ref()),
            MessageType::Log(log_level) => write!(f, "{}", log_level.as_ref()),
            MessageType::NetworkTrace(trace_type) => write!(f, "{}", trace_type.as_ref()),
            MessageType::Unknown(v) => write!(f, "Unknown message type ({},{})", v.0, v.1),
        }
    }
}
//   EColumn.DATETIME,
//   EColumn.ECUID,
struct DltStorageHeader<'a>(&'a StorageHeader);
impl DltStorageHeader<'_> {
    fn fill_columns(&self, columns: &mut Vec<String>) {
        columns.push(DltDltTimeStamp(&self.0.timestamp).to_string());
        columns.push(self.0.ecu_id.clone());
    }
}

struct DltValue<'a>(&'a Value);

impl fmt::Display for DltValue<'_> {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        match &self.0 {
            Value::Bool(value) => value.fmt(f),
            Value::U8(value) => value.fmt(f),
            Value::U16(value) => value.fmt(f),
            Value::U32(value) => value.fmt(f),
            Value::U64(value) => value.fmt(f),
            Value::U128(value) => value.fmt(f),
            Value::I8(value) => value.fmt(f),
            Value::I16(value) => value.fmt(f),
            Value::I32(value) => value.fmt(f),
            Value::I64(value) => value.fmt(f),
            Value::I128(value) => value.fmt(f),
            Value::F32(value) => value.fmt(f),
            Value::F64(value) => value.fmt(f),
            Value::StringVal(s) => {
                for line in s.lines() {
                    write!(f, "{line}")?;
                }
                Ok(())
            }
            Value::Raw(value) => write!(f, "{value:02X?}"),
        }
    }
}

struct DltArgument<'a>(&'a Argument);

impl fmt::Display for DltArgument<'_> {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        if let Some(n) = &self.0.name {
            write!(f, "{n}")?;
        }
        if let Some(u) = &self.0.unit {
            write!(f, "{u}")?;
        }
        if let Some(v) = self.0.to_real_value() {
            write!(f, "{v}")?;
        } else {
            write!(f, "{}", DltValue(&self.0.value))?;
        }

        Ok(())
    }
}

struct DltDltTimeStamp<'a>(&'a DltTimeStamp);

impl fmt::Display for DltDltTimeStamp<'_> {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        let dt: Option<DateTime<Utc>> =
            DateTime::from_timestamp(i64::from(self.0.seconds), self.0.microseconds * 1000);
        match dt {
            Some(dt) => {
                let system_time: std::time::SystemTime = std::time::SystemTime::from(dt);
                write!(f, "{}", humantime::format_rfc3339(system_time))
            }
            None => write!(
                f,
                "no valid timestamp for {}s/{}us",
                self.0.seconds, self.0.microseconds
            ),
        }
    }
}

//   EColumn.DATETIME,
//   EColumn.ECUID,
struct DltStandardHeader<'a>(&'a StandardHeader);
impl DltStandardHeader<'_> {
    fn fill_columns(&self, columns: &mut Vec<String>) {
        columns.push(self.0.version.to_string());
        columns.push(
            self.0
                .session_id
                .map(|id| id.to_string())
                .unwrap_or_default(),
        );

        columns.push(self.0.message_counter.to_string());
        columns.push(self.0.timestamp.map(|s| s.to_string()).unwrap_or_default());
        columns.push(self.0.ecu_id.clone().unwrap_or_default());
    }
}

#[derive(Default, Debug, Clone)]
pub struct FormatOptions {
    pub tz: Option<Tz>,
}

impl From<Option<&String>> for FormatOptions {
    fn from(value: Option<&String>) -> Self {
        FormatOptions {
            tz: if let Some(tz) = value {
                tz.parse::<Tz>().map_or(None, Option::from)
            } else {
                None
            },
        }
    }
}

/// A dlt message that can be formatted with optional FIBEX data support
pub struct FormattableMessage<'a> {
    pub message: Message,
    pub fibex_dlt_metadata: Option<&'a FibexDltMetadata>,
    pub options: Option<&'a FormatOptions>,
}

impl From<Message> for FormattableMessage<'_> {
    fn from(message: Message) -> Self {
        FormattableMessage {
            message,
            fibex_dlt_metadata: None,
            options: None,
        }
    }
}

impl FormattableMessage<'_> {
    fn add_app_id_context_id_and_message_type(&self, columns: &mut Vec<String>) {
        let (app, context, msg_type) = self
            .message
            .extended_header
            .as_ref()
            .map(|ext| {
                (
                    ext.application_id.clone(),
                    ext.context_id.clone(),
                    DltMessageType(&ext.message_type).to_string(),
                )
            })
            .unwrap_or_default();
        columns.push(app);
        columns.push(context);
        columns.push(msg_type);
    }

    pub(crate) fn add_format_nonverbose_data(
        &self,
        id: u32,
        data: &[u8],
        columns: &mut Vec<String>,
    ) {
        trace!("format_nonverbose_data");
        let mut fibex_info_added = false;
        if let Some(non_verbose_info) = self.info_from_metadata(id, data) {
            columns.push(non_verbose_info.app_id.unwrap_or("-").to_string());
            columns.push(non_verbose_info.context_id.unwrap_or("-").to_string());
            let msg_type = non_verbose_info
                .msg_type
                .map(|v| DltMessageType(&v).to_string())
                .unwrap_or_default();
            columns.push(msg_type);

            fibex_info_added = !non_verbose_info.arguments.is_empty();

            // // Skip the first memory system calls.
            // let mut payload = String::with_capacity(8);
            let mut payload = String::new();

            for arg in non_verbose_info.arguments {
                // Writing to string never fails.
                _ = write!(
                    &mut payload,
                    "{}{} ",
                    DLT_ARGUMENT_SENTINAL,
                    DltArgument(&arg)
                );
            }
            columns.push(payload);
        } else {
            self.add_app_id_context_id_and_message_type(columns);
            let payload = String::new();
            columns.push(payload);
        }

        if !fibex_info_added {
            let payload = columns.last_mut().expect("Payload is already added above");
            let _ =
                match get_message_type_string(&self.message.extended_header) {
                    Some(v) => payload.write_str(
                        &format!("{DLT_ARGUMENT_SENTINAL}[{id}]{DLT_ARGUMENT_SENTINAL} {v}")[..],
                    ),
                    None => payload.write_str(
                        &format!(
                            "{DLT_ARGUMENT_SENTINAL}[{id}]{DLT_ARGUMENT_SENTINAL} {data:02X?}"
                        )[..],
                    ),
                };
        }
    }

    fn info_from_metadata<'b>(&'b self, id: u32, data: &[u8]) -> Option<NonVerboseInfo<'b>> {
        let fibex = self.fibex_dlt_metadata?;
        let md = extract_metadata(fibex, id, self.message.extended_header.as_ref())?;
        let msg_type: Option<MessageType> = message_type(&self.message, md.message_info.as_deref());
        let app_id = md.application_id.as_deref().or_else(|| {
            self.message
                .extended_header
                .as_ref()
                .map(|h| h.application_id.as_str())
        });
        let context_id = md.context_id.as_deref().or_else(|| {
            self.message
                .extended_header
                .as_ref()
                .map(|h| h.context_id.as_ref())
        });
        let mut arguments = vec![];
        for pdu in &md.pdus {
            if let Some(description) = &pdu.description {
                let arg = Argument {
                    type_info: TypeInfo {
                        kind: TypeInfoKind::StringType,
                        coding: StringCoding::UTF8,
                        has_trace_info: false,
                        has_variable_info: false,
                    },
                    name: None,
                    unit: None,
                    fixed_point: None,
                    value: Value::StringVal(description.to_string()),
                };
                arguments.push(arg);
            } else {
                if let Ok(mut new_args) =
                    construct_arguments(self.message.header.endianness, &pdu.signal_types, data)
                {
                    arguments.append(&mut new_args);
                }
                trace!("Constructed {} arguments", arguments.len());
            };
        }
        Some(NonVerboseInfo {
            app_id,
            context_id,
            msg_type,
            arguments,
        })
    }

    pub fn to_parse_msg(&self) -> ParsedMessage {
        let mut columns = Vec::with_capacity(COLUMN_LEN);

        if let Some(h) = &self.message.storage_header {
            let tz = self.options.map(|o| o.tz);
            match tz {
                Some(Some(tz)) => {
                    columns.push(get_tz_string(&h.timestamp, &tz));
                    columns.push(h.ecu_id.clone());
                }
                _ => DltStorageHeader(h).fill_columns(&mut columns),
            };
        } else {
            columns.push(String::new());
            columns.push(String::new());
        }

        let header = DltStandardHeader(&self.message.header);
        header.fill_columns(&mut columns);

        match &self.message.payload {
            PayloadContent::Verbose(arguments) => {
                self.add_app_id_context_id_and_message_type(&mut columns);
                //TODO AAZ: Select one approach for concatenating string with benchmarks.
                // Skip the first memory system calls.
                // let mut payload = String::with_capacity(8);
                let mut payload = String::new();
                arguments.iter().for_each(|arg| {
                    _ = write!(
                        &mut payload,
                        "{}{}",
                        DLT_ARGUMENT_SENTINAL,
                        DltArgument(arg)
                    )
                });
                columns.push(payload);
            }
            PayloadContent::NonVerbose(id, data) => {
                self.add_format_nonverbose_data(*id, data, &mut columns)
            }
            PayloadContent::ControlMsg(ctrl_id, _data) => {
                self.add_app_id_context_id_and_message_type(&mut columns);
                let payload = match service_id_lookup(ctrl_id.value()) {
                    Some((name, _desc)) => format!("[{name}]"),
                    None => String::from("[Unknown CtrlCommand]"),
                };
                columns.push(payload);
            }
            PayloadContent::NetworkTrace(slices) => {
                self.add_app_id_context_id_and_message_type(&mut columns);

                // Skip the first memory system calls.
                // let mut payload = String::with_capacity(8);
                let mut payload = String::new();

                slices.iter().for_each(|slice| {
                    _ = write!(payload, "{}{:02X?}", DLT_ARGUMENT_SENTINAL, slice)
                });

                columns.push(payload);
            }
        }

        ParsedMessage::Columns(columns)
    }
}

fn get_tz_string(time_stamp: &DltTimeStamp, tz: &Tz) -> String {
    let dt: Option<DateTime<Utc>> = DateTime::from_timestamp(
        i64::from(time_stamp.seconds),
        time_stamp.microseconds * 1000,
    );
    match dt {
        Some(dt) => dt.with_timezone(tz).to_string(),
        None => format!(
            "no valid timestamp for {}s/{}us",
            time_stamp.seconds, time_stamp.microseconds,
        ),
    }
}

fn message_type(msg: &Message, message_info: Option<&str>) -> Option<MessageType> {
    if let Some(v) = message_info
        .as_ref()
        .and_then(|mi| try_new_from_fibex_message_info(mi))
    {
        Some(v)
    } else {
        msg.extended_header.as_ref().map(|h| h.message_type.clone())
    }
}

fn get_message_type_string(extended_header: &Option<ExtendedHeader>) -> Option<&str> {
    if let Some(ext) = extended_header {
        match &ext.message_type {
            MessageType::Control(ct) => match ct {
                ControlType::Request => Some("control request"),
                ControlType::Response => Some("control response"),
                ControlType::Unknown(_) => Some("unknown control"),
            },
            MessageType::NetworkTrace(ntt) => match ntt {
                NetworkTraceType::Ipc => Some("Ipc"),
                NetworkTraceType::Can => Some("Can"),
                NetworkTraceType::Flexray => Some("Flexray"),
                NetworkTraceType::Most => Some("Most"),
                NetworkTraceType::Ethernet => Some("Ethernet"),
                NetworkTraceType::Someip => Some("Someip"),
                NetworkTraceType::Invalid => Some("Invalid"),
                _ => Some("unknown network trace"),
            },
            _ => None,
        }
    } else {
        None
    }
}

struct NonVerboseInfo<'a> {
    app_id: Option<&'a str>,
    context_id: Option<&'a str>,
    msg_type: Option<MessageType>,
    arguments: Vec<Argument>,
}
