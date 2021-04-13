use crate::{
    dlt::*,
    dlt_parse::{dlt_fint, dlt_fixed_point, dlt_sint, dlt_uint},
    fibex::*,
    service_id::*,
};
use byteorder::{BigEndian, ByteOrder, LittleEndian};
use chrono::{
    prelude::{DateTime, Utc},
    NaiveDateTime,
};
use std::{
    fmt::{self, Formatter},
    str,
};

pub const DLT_COLUMN_SENTINAL: char = '\u{0004}';
pub const DLT_ARGUMENT_SENTINAL: char = '\u{0005}';
pub const DLT_NEWLINE_SENTINAL_SLICE: &[u8] = &[0x6];

lazy_static! {
    static ref DLT_NEWLINE_SENTINAL_STR: &'static str =
        unsafe { str::from_utf8_unchecked(DLT_NEWLINE_SENTINAL_SLICE) };
}

impl fmt::Display for MessageType {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        match self {
            MessageType::ApplicationTrace(app_type) => app_type.fmt(f),
            MessageType::Control(c) => c.fmt(f),
            MessageType::Log(log_level) => log_level.fmt(f),
            MessageType::NetworkTrace(trace_type) => trace_type.fmt(f),
            MessageType::Unknown(v) => write!(f, "Unkown MSTP {:?}", v),
        }
    }
}
//   EColumn.DATETIME,
//   EColumn.ECUID,
impl fmt::Display for StorageHeader {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        write!(
            f,
            "{}{}{}",
            self.timestamp, DLT_COLUMN_SENTINAL, self.ecu_id
        )
    }
}

impl fmt::Display for ApplicationTraceType {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        match self {
            ApplicationTraceType::Variable => f.write_str("VARIABLE"),
            ApplicationTraceType::FunctionIn => f.write_str("FUNC_IN"),
            ApplicationTraceType::FunctionOut => f.write_str("FUNC_OUT"),
            ApplicationTraceType::State => f.write_str("STATE"),
            ApplicationTraceType::Vfb => f.write_str("VFB"),
            ApplicationTraceType::Invalid(n) => write!(f, "invalid({})", n),
        }
    }
}

impl fmt::Display for NetworkTraceType {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        match self {
            NetworkTraceType::Invalid => f.write_str("INVALID"),
            NetworkTraceType::Ipc => f.write_str("IPC"),
            NetworkTraceType::Can => f.write_str("CAN"),
            NetworkTraceType::Flexray => f.write_str("FLEXRAY"),
            NetworkTraceType::Most => f.write_str("MOST"),
            NetworkTraceType::Ethernet => f.write_str("ETHERNET"),
            NetworkTraceType::Someip => f.write_str("SOMEIP"),
            NetworkTraceType::UserDefined(v) => write!(f, "USERDEFINED({})", v),
        }
    }
}

impl fmt::Display for ControlType {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        match self {
            ControlType::Request => f.write_str("REQ"),
            ControlType::Response => f.write_str("RES"),
            ControlType::Unknown(n) => write!(f, "{}", n),
        }
    }
}

impl fmt::Display for Value {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        match self {
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
            Value::StringVal(s) => write!(
                f,
                "{}",
                s.lines()
                    .collect::<Vec<&str>>()
                    .join(&DLT_NEWLINE_SENTINAL_STR)
            ),
            Value::Raw(value) => write!(f, "{:02X?}", value),
        }
    }
}

impl fmt::Display for Argument {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        if let Some(n) = &self.name {
            write!(f, "{}: ", n)?;
        }
        if let Some(u) = &self.unit {
            u.fmt(f)?;
        }
        if let Some(v) = self.to_real_value() {
            write!(f, "{}", v)?;
        } else {
            self.value.fmt(f)?;
        }

        Ok(())
    }
}

impl fmt::Display for DltTimeStamp {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        let naive: Option<NaiveDateTime> =
            NaiveDateTime::from_timestamp_opt(i64::from(self.seconds), self.microseconds * 1000);
        match naive {
            Some(n) => {
                let datetime: DateTime<Utc> = DateTime::from_utc(n, Utc);
                let system_time: std::time::SystemTime = std::time::SystemTime::from(datetime);
                write!(f, "{}", humantime::format_rfc3339(system_time))
            }
            None => write!(
                f,
                "no valid timestamp for {}s/{}us",
                self.seconds, self.microseconds
            ),
        }
    }
}

//   EColumn.DATETIME,
//   EColumn.ECUID,
impl fmt::Display for StandardHeader {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        write!(f, "{}{}", self.version, DLT_COLUMN_SENTINAL,)?;
        if let Some(id) = &self.session_id {
            write!(f, "{}", id)?;
        }
        write!(
            f,
            "{}{}{}",
            DLT_COLUMN_SENTINAL, self.message_counter, DLT_COLUMN_SENTINAL,
        )?;
        if let Some(t) = &self.timestamp {
            write!(f, "{}", t)?;
        }
        write!(f, "{}", DLT_COLUMN_SENTINAL,)?;
        if let Some(id) = &self.ecu_id {
            write!(f, "{}", id)?;
        }
        Ok(())
    }
}

impl fmt::Display for LogLevel {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        match self {
            LogLevel::Fatal => f.write_str("FATAL"),
            LogLevel::Error => f.write_str("Error"),
            LogLevel::Warn => f.write_str("WARN"),
            LogLevel::Info => f.write_str("INFO"),
            LogLevel::Debug => f.write_str("DEBUG"),
            LogLevel::Verbose => f.write_str("VERBOSE"),
            LogLevel::Invalid(v) => write!(f, "INVALID (0x{:02X?})", v),
        }
    }
}
pub struct FormattableMessage<'a> {
    pub message: Message,
    pub fibex_metadata: Option<&'a FibexMetadata>,
}

impl<'a> fmt::Display for FormattableMessage<'a> {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        self.message.fmt_as_text(f, self.fibex_metadata)
    }
}

impl Message {
    /// will format dlt Message with those fields:
    /// StorageHeader *************
    ///     - EColumn.DATETIME,
    ///     - EColumn.ECUID,
    /// Version: EColumn.VERS,
    /// SessionId: EColumn.SID,
    /// message-count: EColumn.MCNT,
    /// timestamp: EColumn.TMS,
    /// EColumn.EID,
    /// EColumn.APID,
    /// EColumn.CTID,
    /// EColumn.MSTP,
    /// EColumn.PAYLOAD,
    pub fn fmt_as_text(
        &self,
        f: &mut fmt::Formatter,
        fibex_metadata: Option<&FibexMetadata>,
    ) -> fmt::Result {
        if let Some(h) = &self.storage_header {
            write!(f, "{}", h)?;
        }
        write!(f, "{}", DLT_COLUMN_SENTINAL,)?;
        write!(f, "{}", self.header)?;
        write!(f, "{}", DLT_COLUMN_SENTINAL,)?;

        match &self.payload {
            PayloadContent::Verbose(arguments) => {
                self.write_app_id_context_id_and_message_type(f)?;
                arguments
                    .iter()
                    .try_for_each(|arg| write!(f, "{}{}", DLT_ARGUMENT_SENTINAL, arg))
            }
            PayloadContent::NonVerbose(id, data) => {
                self.format_nonverbose_data(*id, data, f, fibex_metadata)
            }
            PayloadContent::ControlMsg(ctrl_id, _data) => {
                self.write_app_id_context_id_and_message_type(f)?;
                match SERVICE_ID_MAPPING.get(&ctrl_id.value()) {
                    Some((name, _desc)) => write!(f, "[{}]", name),
                    None => write!(f, "[Unknown CtrlCommand]"),
                }
            }
        }
    }

    fn write_app_id_context_id_and_message_type(
        &self,
        f: &mut fmt::Formatter,
    ) -> Result<(), fmt::Error> {
        match self.extended_header.as_ref() {
            Some(ext) => {
                write!(
                    f,
                    "{}{}{}{}{}{}",
                    ext.application_id,
                    DLT_COLUMN_SENTINAL,
                    ext.context_id,
                    DLT_COLUMN_SENTINAL,
                    ext.message_type,
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
        fibex_metadata: Option<&FibexMetadata>,
    ) -> fmt::Result {
        trace!("format_nonverbose_data");
        let mut is_written = false;
        if let Some(fibex_metadata) = fibex_metadata {
            let id_text = format!("ID_{}", id);
            let frame_metadata = if let Some(extended_header) = &self.extended_header {
                fibex_metadata.frame_map_with_key.get(&(
                    ContextId(extended_header.context_id.clone()),
                    ApplicationId(extended_header.application_id.clone()),
                    FrameId(id_text),
                )) // TODO: avoid cloning here (Cow or Borrow)
            } else {
                fibex_metadata.frame_map.get(&FrameId(id_text))
            };
            if let Some(frame_metadata) = frame_metadata {
                let FrameMetadata {
                    application_id,
                    context_id,
                    message_info,
                    ..
                } = &frame_metadata;
                write!(
                    f,
                    "{}{}{}{}",
                    application_id
                        .as_ref()
                        .map(|id| &**id)
                        .or_else(|| self
                            .extended_header
                            .as_ref()
                            .map(|h| h.application_id.as_ref()))
                        .unwrap_or("-"),
                    DLT_COLUMN_SENTINAL,
                    context_id
                        .as_ref()
                        .map(|id| &**id)
                        .or_else(|| self.extended_header.as_ref().map(|h| h.context_id.as_ref()))
                        .unwrap_or("-"),
                    DLT_COLUMN_SENTINAL
                )?;
                if let Some(v) = message_info
                    .as_ref()
                    .and_then(|mi| MessageType::try_new_from_fibex_message_info(&*mi))
                {
                    write!(f, "{}", v)?;
                } else if let Some(message_type) =
                    self.extended_header.as_ref().map(|h| &h.message_type)
                {
                    write!(f, "{}", message_type)?;
                } else {
                    write!(f, "-")?;
                }
                write!(f, "{}", DLT_COLUMN_SENTINAL)?;
                for pdu in &frame_metadata.pdus {
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
                        write!(f, "{}{} ", DLT_ARGUMENT_SENTINAL, arg)?;
                    } else {
                        let arguments = self.construct_arguments(&pdu.signal_types, data)?;
                        warn!("Constructed {} arguments", arguments.len());
                        for arg in arguments {
                            write!(f, "{}{} ", DLT_ARGUMENT_SENTINAL, arg)?;
                        }
                    };
                    is_written = true;
                }
            } else {
                self.write_app_id_context_id_and_message_type(f)?;
            }
        } else {
            self.write_app_id_context_id_and_message_type(f)?;
        }
        if !is_written {
            if let Err(_e) = f.write_str(
                &format!(
                    "{}[{}]{} {}",
                    DLT_ARGUMENT_SENTINAL,
                    id,
                    DLT_ARGUMENT_SENTINAL,
                    get_message_type_string(&self.extended_header),
                )[..],
            ) {}
        }
        Ok(())
    }

    fn construct_arguments(
        &self,
        pdu_signal_types: &[TypeInfo],
        data: &[u8],
    ) -> Result<Vec<Argument>, fmt::Error> {
        let mut offset = 0;
        let mut arguments = vec![];
        for signal_type in pdu_signal_types {
            let argument = {
                let (value, fixed_point) = {
                    let mut fixed_point = None;
                    match signal_type.kind {
                        TypeInfoKind::StringType | TypeInfoKind::Raw => {
                            if data.len() < offset + 2 {
                                return Err(fmt::Error);
                            }
                            let length = if self.header.endianness == Endianness::Big {
                                BigEndian::read_u16(&data[offset..offset + 2]) as usize
                            } else {
                                LittleEndian::read_u16(&data[offset..offset + 2]) as usize
                            };
                            offset += 2;
                            if data.len() < offset + length {
                                return Err(fmt::Error);
                            }
                            let v = if signal_type.kind == TypeInfoKind::StringType {
                                Value::StringVal(
                                    String::from_utf8(data[offset..offset + length].to_vec())
                                        .map_err(|_| fmt::Error)?,
                                )
                            } else {
                                Value::Raw(Vec::from(&data[offset..offset + length]))
                            };
                            offset += length;
                            Ok((v, fixed_point))
                        }
                        TypeInfoKind::Bool => {
                            offset += 1;
                            if data.len() < offset {
                                return Err(fmt::Error);
                            }
                            Ok((Value::Bool(data[offset - 1]), fixed_point))
                        }
                        TypeInfoKind::Float(width) => {
                            let length = width as usize / 8;
                            if data.len() < offset + length {
                                return Err(fmt::Error);
                            }
                            let v = if self.header.endianness == Endianness::Big {
                                dlt_fint::<BigEndian>(width)(&data[offset..offset + length])
                            } else {
                                dlt_fint::<LittleEndian>(width)(&data[offset..offset + length])
                            }
                            .map_err(|_| fmt::Error)?
                            .1;
                            offset += length;
                            Ok((v, fixed_point)) as Result<(Value, Option<FixedPoint>), fmt::Error>
                        }
                        TypeInfoKind::Signed(length) => {
                            let byte_length = length as usize / 8;
                            if data.len() < offset + byte_length {
                                return Err(fmt::Error);
                            }
                            let value_offset = &data[offset..];
                            let (_, v) = if self.header.endianness == Endianness::Big {
                                dlt_sint::<BigEndian>(length)(value_offset)
                            } else {
                                dlt_sint::<LittleEndian>(length)(value_offset)
                            }
                            .map_err(|_| fmt::Error)?;
                            offset += byte_length;
                            Ok((v, fixed_point))
                        }
                        TypeInfoKind::SignedFixedPoint(length) => {
                            let byte_length = length as usize / 8;
                            if data.len() < offset + byte_length {
                                return Err(fmt::Error);
                            }
                            let (value_offset, fp) = if self.header.endianness == Endianness::Big {
                                dlt_fixed_point::<BigEndian>(
                                    &data[offset..offset + byte_length],
                                    length,
                                )
                            } else {
                                dlt_fixed_point::<LittleEndian>(
                                    &data[offset..offset + byte_length],
                                    length,
                                )
                            }
                            .map_err(|_| fmt::Error)?;
                            fixed_point = Some(fp);
                            let (_, v) = if self.header.endianness == Endianness::Big {
                                dlt_sint::<BigEndian>(float_width_to_type_length(length))(
                                    value_offset,
                                )
                            } else {
                                dlt_sint::<LittleEndian>(float_width_to_type_length(length))(
                                    value_offset,
                                )
                            }
                            .map_err(|_| fmt::Error)?;
                            offset += byte_length;
                            Ok((v, fixed_point))
                        }
                        TypeInfoKind::Unsigned(length) => {
                            let byte_length = length as usize / 8;
                            if data.len() < offset + byte_length {
                                return Err(fmt::Error);
                            }
                            let value_offset = &data[offset..];
                            let (_, v) = if self.header.endianness == Endianness::Big {
                                dlt_uint::<BigEndian>(length)(value_offset)
                            } else {
                                dlt_uint::<LittleEndian>(length)(value_offset)
                            }
                            .map_err(|_| fmt::Error)?;
                            offset += byte_length;
                            Ok((v, fixed_point))
                        }
                        TypeInfoKind::UnsignedFixedPoint(length) => {
                            let byte_length = length as usize / 8;
                            if data.len() < offset + byte_length {
                                return Err(fmt::Error);
                            }
                            let value_offset = {
                                let (r, fp) = if self.header.endianness == Endianness::Big {
                                    dlt_fixed_point::<BigEndian>(
                                        &data[offset..offset + byte_length],
                                        length,
                                    )
                                } else {
                                    dlt_fixed_point::<LittleEndian>(
                                        &data[offset..offset + byte_length],
                                        length,
                                    )
                                }
                                .map_err(|_| fmt::Error)?;
                                fixed_point = Some(fp);
                                r
                            };
                            let (_, v) = if self.header.endianness == Endianness::Big {
                                dlt_uint::<BigEndian>(float_width_to_type_length(length))(
                                    value_offset,
                                )
                            } else {
                                dlt_uint::<LittleEndian>(float_width_to_type_length(length))(
                                    value_offset,
                                )
                            }
                            .map_err(|_| fmt::Error)?;
                            offset += byte_length;
                            Ok((v, fixed_point))
                        }
                    }
                }?;
                Argument {
                    type_info: signal_type.clone(),
                    name: None,
                    unit: None,
                    fixed_point,
                    value,
                }
            };
            arguments.push(argument);
        }
        Ok(arguments)
    }
}

impl fmt::Display for TypeInfo {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        let kind = match self.kind {
            TypeInfoKind::Bool => "Bool".into(),
            TypeInfoKind::Signed(type_length) => format!("Signed ({:?})", type_length),
            TypeInfoKind::SignedFixedPoint(float_width) => format!("Signed FP ({:?})", float_width),
            TypeInfoKind::Unsigned(type_length) => format!("Unsigned ({:?})", type_length),
            TypeInfoKind::UnsignedFixedPoint(float_width) => {
                format!("Signed FP ({:?})", float_width)
            }
            TypeInfoKind::Float(float_width) => format!("Float ({:?})", float_width),
            TypeInfoKind::StringType => "String".into(),
            TypeInfoKind::Raw => "Raw".into(),
        };
        write!(f, "TypeInfo {}", kind)
    }
}
fn get_message_type_string<'a>(extended_header: &Option<ExtendedHeader>) -> &'a str {
    let mut as_string = "- fibex missing -";
    if let Some(ext) = extended_header {
        match &ext.message_type {
            MessageType::Control(ct) => match ct {
                ControlType::Request => as_string = "control request",
                ControlType::Response => as_string = "control response",
                ControlType::Unknown(_) => as_string = "unknown control",
            },
            MessageType::NetworkTrace(ntt) => match ntt {
                NetworkTraceType::Ipc => as_string = "Ipc",
                NetworkTraceType::Can => as_string = "Can",
                NetworkTraceType::Flexray => as_string = "Flexray",
                NetworkTraceType::Most => as_string = "Most",
                NetworkTraceType::Ethernet => as_string = "Ethernet",
                NetworkTraceType::Someip => as_string = "Someip",
                NetworkTraceType::Invalid => as_string = "Invalid",
                _ => as_string = "unknown network trace",
            },
            _ => (),
        }
    }
    as_string
}
