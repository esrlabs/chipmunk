// Copyright (c) 2021 ESR Labs GmbH. All rights reserved.
//
// NOTICE:  All information contained herein is, and remains
// the property of E.S.R.Labs and its suppliers, if any.
// The intellectual and technical concepts contained herein are
// proprietary to E.S.R.Labs and its suppliers and may be covered
// by German and Foreign Patents, patents in process, and are protected
// by trade secret or copyright law.
// Dissemination of this information or reproduction of this material
// is strictly forbidden unless prior written permission is obtained
// from E.S.R.Labs.

//! # Formatting dlt messages as text
use chrono::{
    prelude::{DateTime, Utc},
    NaiveDateTime,
};
use chrono_tz::Tz;
use dlt_core::{
    dlt::{
        Argument, ControlType, DltTimeStamp, ExtendedHeader, LogLevel, Message, MessageType,
        NetworkTraceType, PayloadContent, StandardHeader, StorageHeader, StringCoding, TypeInfo,
        TypeInfoKind, Value,
    },
    fibex::{extract_metadata, FibexMetadata},
    parse::construct_arguments,
    service_id::service_id_lookup,
};
use log::trace;

use serde::ser::{Serialize, SerializeStruct, Serializer};

use std::{
    fmt::{self, Formatter},
    str,
};

const DLT_COLUMN_SENTINAL: char = '\u{0004}';
const DLT_ARGUMENT_SENTINAL: char = '\u{0005}';
const DLT_NEWLINE_SENTINAL_SLICE: &[u8] = &[0x6];

lazy_static::lazy_static! {
    static ref DLT_NEWLINE_SENTINAL_STR: &'static str =
        unsafe { str::from_utf8_unchecked(DLT_NEWLINE_SENTINAL_SLICE) };
}

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

impl<'a> fmt::Display for DltMessageType<'a> {
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
impl<'a> fmt::Display for DltStorageHeader<'a> {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        write!(
            f,
            "{}{}{}",
            DltDltTimeStamp(&self.0.timestamp),
            DLT_COLUMN_SENTINAL,
            self.0.ecu_id
        )
    }
}

struct DltValue<'a>(&'a Value);

impl<'a> fmt::Display for DltValue<'a> {
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
                    write!(f, "{}~", line)?;
                }
                Ok(())
            }
            Value::Raw(value) => write!(f, "{:02X?}", value),
        }
    }
}

struct DltArgument<'a>(&'a Argument);

impl<'a> fmt::Display for DltArgument<'a> {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        if let Some(n) = &self.0.name {
            write!(f, "name: {} ", n)?;
        }
        if let Some(u) = &self.0.unit {
            write!(f, "unit: {} ", u)?;
        }
        if let Some(v) = self.0.to_real_value() {
            write!(f, "value: {} ", v)?;
        } else {
            write!(f, "value: {} ", DltValue(&self.0.value))?;
        }

        Ok(())
    }
}

struct DltDltTimeStamp<'a>(&'a DltTimeStamp);

impl<'a> fmt::Display for DltDltTimeStamp<'a> {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        let naive: Option<NaiveDateTime> = NaiveDateTime::from_timestamp_opt(
            i64::from(self.0.seconds),
            self.0.microseconds * 1000,
        );
        match naive {
            Some(n) => {
                let datetime: DateTime<Utc> = DateTime::from_utc(n, Utc);
                let system_time: std::time::SystemTime = std::time::SystemTime::from(datetime);
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

impl<'a> fmt::Display for DltStandardHeader<'a> {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        write!(f, "{}{}", self.0.version, DLT_COLUMN_SENTINAL)?;
        if let Some(id) = &self.0.session_id {
            write!(f, "{}", id)?;
        }
        write!(
            f,
            "{}{}{}",
            DLT_COLUMN_SENTINAL, self.0.message_counter, DLT_COLUMN_SENTINAL,
        )?;
        if let Some(t) = &self.0.timestamp {
            write!(f, "{}", t)?;
        }
        write!(f, "{}", DLT_COLUMN_SENTINAL,)?;
        if let Some(id) = &self.0.ecu_id {
            write!(f, "{}", id)?;
        }
        Ok(())
    }
}

#[derive(Default)]
pub struct FormatOptions {
    pub tz: Option<Tz>,
}

/// A dlt message that can be formatted with optional FIBEX data support
pub struct FormattableMessage<'a> {
    pub message: Message,
    pub fibex_metadata: Option<&'a FibexMetadata>,
    pub options: Option<&'a FormatOptions>,
}

impl<'a> Serialize for FormattableMessage<'a> {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("Message", 10)?;
        let header = &self.message.header;
        let storage_header = &self.message.storage_header;
        let ext_header = &self.message.extended_header;
        let ext_header_app_id = ext_header.as_ref().map(|eh| &eh.application_id);
        let ext_header_context_id = ext_header.as_ref().map(|eh| &eh.context_id);
        let ext_header_msg_type: Option<MessageType> =
            ext_header.as_ref().map(|eh| eh.message_type.clone());
        // let record = ByteRecord::from(vec![
        //     sh_timestamp,
        //     header_version,
        //     header_msg_cnt,
        //     header.ecu_id.as_deref().unwrap_or(""),
        //     session_id,
        //     timestamp,
        // ]);
        state.serialize_field(
            "date-time",
            &storage_header.as_ref().map(|sh| utc_string(&sh.timestamp)),
        )?;
        state.serialize_field("version", &header.version)?;
        state.serialize_field("message-counter", &header.message_counter)?;
        state.serialize_field("ecu-id", &header.ecu_id)?;
        state.serialize_field("session-id", &header.session_id)?;
        state.serialize_field("timestamp", &header.timestamp)?;
        match &self.message.payload {
            PayloadContent::Verbose(arguments) => {
                state.serialize_field("app-id", &ext_header_app_id)?;
                state.serialize_field("context-id", &ext_header_context_id)?;
                state.serialize_field("message-type", &ext_header_msg_type)?;
                let arg_string = arguments
                    .iter()
                    .map(|a| DltArgument(a).to_string())
                    .collect::<Vec<String>>()
                    .join("|");
                state.serialize_field("payload", &arg_string)?;
            }
            PayloadContent::NonVerbose(id, data) => {
                if let Some(non_verbose_info) = self.info_from_metadata(*id, data) {
                    state.serialize_field("app-id", &non_verbose_info.app_id)?;
                    state.serialize_field("context-id", &non_verbose_info.context_id)?;
                    state.serialize_field("message-type", &non_verbose_info.msg_type)?;
                    let arg_string = non_verbose_info
                        .arguments
                        .iter()
                        .map(|a| DltArgument(a).to_string())
                        .collect::<Vec<String>>()
                        .join("|");
                    state.serialize_field("payload", &arg_string)?;
                } else {
                    state.serialize_field("app-id", &ext_header_app_id)?;
                    state.serialize_field("context-id", &ext_header_context_id)?;
                    state.serialize_field("message-type", &ext_header_msg_type)?;
                    match get_message_type_string(&self.message.extended_header) {
                        Some(v) => state.serialize_field(
                            "payload",
                            &format!(
                                "{}[{}]{} {}",
                                DLT_ARGUMENT_SENTINAL, id, DLT_ARGUMENT_SENTINAL, v
                            ),
                        )?,
                        None => state.serialize_field(
                            "payload",
                            &format!(
                                "{}[{}]{} {:02X?}",
                                DLT_ARGUMENT_SENTINAL, id, DLT_ARGUMENT_SENTINAL, data
                            ),
                        )?,
                    };
                }
            }
            PayloadContent::ControlMsg(ctrl_id, _data) => {
                state.serialize_field("app-id", &ext_header_app_id)?;
                state.serialize_field("context-id", &ext_header_context_id)?;
                state.serialize_field("message-type", &ext_header_msg_type)?;
                match service_id_lookup(ctrl_id.value()) {
                    Some((name, _desc)) => state.serialize_field("payload", name)?,
                    None => state.serialize_field("payload", "[Unknown CtrlCommand]")?,
                }
            }
        }
        state.end()
    }
}

impl<'a> From<Message> for FormattableMessage<'a> {
    fn from(message: Message) -> Self {
        FormattableMessage {
            message,
            fibex_metadata: None,
            options: None,
        }
    }
}

pub struct PrintableMessage<'a> {
    pub app_id: &'a str,
    pub context_id: &'a str,
    pub message_type: Option<MessageType>,
    pub argument_string: String,
}

impl<'a> PrintableMessage<'a> {
    pub fn new(
        app_id: &'a str,
        context_id: &'a str,
        message_type: Option<MessageType>,
        argument_string: String,
    ) -> Self {
        Self {
            app_id,
            context_id,
            message_type,
            argument_string,
        }
    }
}

impl<'a> FormattableMessage<'a> {
    pub fn printable_parts<'b>(
        &'b self,
        ext_h_app_id: &'b str,
        ext_h_ctx_id: Option<&'b str>,
        ext_h_msg_type: Option<MessageType>,
        empty: &'b str,
    ) -> Result<PrintableMessage, fmt::Error> {
        let eh_ctx_id: &str = ext_h_ctx_id.unwrap_or(empty);
        match &self.message.payload {
            PayloadContent::Verbose(arguments) => {
                let arg_string = arguments
                    .iter()
                    .map(|a| DltArgument(a).to_string())
                    .collect::<Vec<String>>()
                    .join("|");
                Ok(PrintableMessage::new(
                    ext_h_app_id,
                    eh_ctx_id,
                    ext_h_msg_type,
                    arg_string,
                ))
            }
            PayloadContent::NonVerbose(id, data) => {
                if let Some(non_verbose_info) = self.info_from_metadata(*id, data) {
                    let arg_string = non_verbose_info
                        .arguments
                        .iter()
                        .map(|a| DltArgument(a).to_string())
                        .collect::<Vec<String>>()
                        .join("|");
                    Ok(PrintableMessage::new(
                        non_verbose_info.app_id.unwrap_or(ext_h_app_id),
                        non_verbose_info.context_id.unwrap_or(eh_ctx_id),
                        non_verbose_info.msg_type,
                        arg_string,
                    ))
                } else {
                    let payload_string =
                        match get_message_type_string(&self.message.extended_header) {
                            Some(v) => format!(
                                "{}[{}]{} {}",
                                DLT_ARGUMENT_SENTINAL, id, DLT_ARGUMENT_SENTINAL, v
                            ),
                            None => format!(
                                "{}[{}]{} {:02X?}",
                                DLT_ARGUMENT_SENTINAL, id, DLT_ARGUMENT_SENTINAL, data
                            ),
                        };
                    Ok(PrintableMessage::new(
                        ext_h_app_id,
                        eh_ctx_id,
                        ext_h_msg_type,
                        payload_string,
                    ))
                }
            }
            PayloadContent::ControlMsg(ctrl_id, _data) => {
                let payload_string: String = match service_id_lookup(ctrl_id.value()) {
                    Some((name, _desc)) => String::from(name),
                    None => "[Unknown CtrlCommand]".to_owned(),
                };
                Ok(PrintableMessage::new(
                    ext_h_app_id,
                    eh_ctx_id,
                    ext_h_msg_type,
                    payload_string,
                ))
            }
        }
    }

    fn write_app_id_context_id_and_message_type(
        &self,
        f: &mut fmt::Formatter,
    ) -> Result<(), fmt::Error> {
        match self.message.extended_header.as_ref() {
            Some(ext) => {
                write!(
                    f,
                    "{}{}{}{}{}{}",
                    ext.application_id,
                    DLT_COLUMN_SENTINAL,
                    ext.context_id,
                    DLT_COLUMN_SENTINAL,
                    DltMessageType(&ext.message_type),
                    DLT_COLUMN_SENTINAL,
                )?;
            }
            None => {
                write!(
                    f,
                    "-{}-{}-{}",
                    DLT_COLUMN_SENTINAL, DLT_COLUMN_SENTINAL, DLT_COLUMN_SENTINAL,
                )?;
            }
        };
        Ok(())
    }
    pub(crate) fn format_nonverbose_data(
        &self,
        id: u32,
        data: &[u8],
        f: &mut fmt::Formatter,
    ) -> fmt::Result {
        trace!("format_nonverbose_data");
        let mut fibex_info_added = false;
        if let Some(non_verbose_info) = self.info_from_metadata(id, data) {
            write!(
                f,
                "{}{}{}{}",
                non_verbose_info.app_id.unwrap_or("-"),
                DLT_COLUMN_SENTINAL,
                non_verbose_info.context_id.unwrap_or("-"),
                DLT_COLUMN_SENTINAL,
            )?;
            if let Some(v) = non_verbose_info.msg_type {
                write!(f, "{}", DltMessageType(&v))?;
            } else {
                write!(f, "-")?;
            }
            write!(f, "{}", DLT_COLUMN_SENTINAL)?;
            fibex_info_added = !non_verbose_info.arguments.is_empty();
            for arg in non_verbose_info.arguments {
                write!(f, "{}{} ", DLT_ARGUMENT_SENTINAL, DltArgument(&arg))?;
            }
        } else {
            self.write_app_id_context_id_and_message_type(f)?;
        }
        if !fibex_info_added {
            let _ = match get_message_type_string(&self.message.extended_header) {
                Some(v) => f.write_str(
                    &format!(
                        "{}[{}]{} {}",
                        DLT_ARGUMENT_SENTINAL, id, DLT_ARGUMENT_SENTINAL, v
                    )[..],
                ),
                None => f.write_str(
                    &format!(
                        "{}[{}]{} {:02X?}",
                        DLT_ARGUMENT_SENTINAL, id, DLT_ARGUMENT_SENTINAL, data
                    )[..],
                ),
            };
        }
        Ok(())
    }

    fn info_from_metadata<'b>(&'b self, id: u32, data: &[u8]) -> Option<NonVerboseInfo<'b>> {
        let fibex = self.fibex_metadata?;
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
}

impl<'a> fmt::Display for FormattableMessage<'a> {
    /// will format dlt Message with those fields:
    /// ********* storage-header ********
    /// date-time
    /// ecu-id (skip...contained in header section)
    /// ********* header ********
    /// Version
    /// message-counter
    /// timestamp
    /// ecu id
    /// session-id
    /// ********* ext-header ********
    /// message-type
    /// app-id
    /// context-id
    ///
    /// payload
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        if let Some(h) = &self.message.storage_header {
            let tz = self.options.map(|o| o.tz);
            match tz {
                Some(Some(tz)) => write_tz_string(f, &h.timestamp, &tz)?,
                _ => write!(f, "{}", DltStorageHeader(h))?,
            };
        }
        let header = DltStandardHeader(&self.message.header);
        write!(f, "{}", DLT_COLUMN_SENTINAL,)?;
        write!(f, "{}", header)?;
        write!(f, "{}", DLT_COLUMN_SENTINAL,)?;

        match &self.message.payload {
            PayloadContent::Verbose(arguments) => {
                self.write_app_id_context_id_and_message_type(f)?;
                arguments
                    .iter()
                    .try_for_each(|arg| write!(f, "{}{}", DLT_ARGUMENT_SENTINAL, DltArgument(arg)))
            }
            PayloadContent::NonVerbose(id, data) => self.format_nonverbose_data(*id, data, f),
            PayloadContent::ControlMsg(ctrl_id, _data) => {
                self.write_app_id_context_id_and_message_type(f)?;
                match service_id_lookup(ctrl_id.value()) {
                    Some((name, _desc)) => write!(f, "[{}]", name),
                    None => write!(f, "[Unknown CtrlCommand]"),
                }
            }
        }
    }
}

fn write_tz_string(
    f: &mut Formatter,
    time_stamp: &DltTimeStamp,
    tz: &Tz,
) -> Result<(), fmt::Error> {
    let naive: Option<NaiveDateTime> = NaiveDateTime::from_timestamp_opt(
        i64::from(time_stamp.seconds),
        time_stamp.microseconds * 1000,
    );
    match naive {
        Some(n) => write!(f, "{}", DateTime::<Utc>::from_utc(n, Utc).with_timezone(tz)),
        None => write!(
            f,
            "no valid timestamp for {}s/{}us",
            time_stamp.seconds, time_stamp.microseconds,
        ),
    }
}

pub fn utc_string(time_stamp: &DltTimeStamp) -> String {
    let naive: Option<NaiveDateTime> = NaiveDateTime::from_timestamp_opt(
        i64::from(time_stamp.seconds),
        time_stamp.microseconds * 1000,
    );
    match naive {
        Some(n) => {
            let datetime: DateTime<Utc> = DateTime::from_utc(n, Utc);
            let system_time: std::time::SystemTime = std::time::SystemTime::from(datetime);
            humantime::format_rfc3339(system_time).to_string()
        }
        None => format!(
            "no valid timestamp for {}s/{}us",
            time_stamp.seconds, time_stamp.microseconds,
        ),
    }
}

fn message_type(msg: &Message, message_info: Option<&str>) -> Option<MessageType> {
    if let Some(v) = message_info
        .as_ref()
        .and_then(|mi| try_new_from_fibex_message_info(*mi))
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
