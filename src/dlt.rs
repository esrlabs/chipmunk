// Copyright (c) 2019 E.S.R.Labs. All rights reserved.
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
use byteorder::{BigEndian, LittleEndian, ReadBytesExt};
use bytes::{Buf, ByteOrder, Bytes, BytesMut, IntoBuf};
use log::warn;
use std::fmt;
use std::fmt::{Formatter, Write};
use std::io;
use std::io::{Error, ErrorKind, Read};

use std::str;
use tokio::codec::{Decoder, Encoder};

#[derive(Debug)]
pub struct StorageHeader {
    pub timestamp: u64,
    pub ecu_id: String,
}

#[derive(Debug)]
pub struct Header {
    pub is_big_endian: bool,
    pub version: u8,
    pub message_counter: u8,
    pub ecu_id: Option<String>,
    pub session_id: Option<u32>,
    pub timestamp: Option<u32>,
}

#[derive(Debug, PartialEq)]
pub enum LogLevel {
    Fatal,
    Error,
    Warn,
    Info,
    Debug,
    Verbose,
}

#[derive(Debug, PartialEq)]
pub enum ApplicationTraceType {
    Variable,
    FunctionIn,
    FunctionOut,
    State,
    Vfb,
}

#[derive(Debug, PartialEq)]
pub enum NetworkTraceType {
    Ipc,
    Can,
    Flexray,
    Most,
    Ethernet,
    Someip,
    UserDefined(u8),
}

#[derive(Debug, PartialEq)]
pub enum ControlType {
    Request,
    Response,
}

#[derive(Debug, PartialEq)]
pub enum MessageType {
    Log(LogLevel),
    ApplicationTrace(ApplicationTraceType),
    NetworkTrace(NetworkTraceType),
    Control(ControlType),
}

#[derive(Debug)]
pub struct ExtendedHeader {
    pub message_type: MessageType,
    pub application_id: String,
    pub context_id: String,
}

#[derive(Debug, PartialEq)]
pub enum Value {
    Bool(bool),
    U8(u8),
    U16(u16),
    U32(u32),
    U64(u64),
    I8(i8),
    I16(i16),
    I32(i32),
    I64(i64),
    String(String),
}

#[derive(Debug)]
pub struct Argument {
    pub name: Option<String>,
    pub unit: Option<String>,
    pub value: Value,
}

#[derive(Debug)]
pub enum Payload {
    Verbose(Vec<Argument>),
    NonVerbose(u32, Vec<u8>),
}

#[derive(Debug)]
pub struct Message {
    pub storage_header: Option<StorageHeader>,
    pub header: Header,
    pub extended_header: Option<ExtendedHeader>,
    pub payload: Payload,
}

// Convert dlt::LogLevel into log::Level
impl Into<log::Level> for LogLevel {
    fn into(self) -> log::Level {
        match self {
            LogLevel::Fatal | LogLevel::Error => log::Level::Error,
            LogLevel::Warn => log::Level::Warn,
            LogLevel::Info => log::Level::Info,
            LogLevel::Debug => log::Level::Debug,
            LogLevel::Verbose => log::Level::Trace,
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
            Value::I8(value) => value.fmt(f),
            Value::I16(value) => value.fmt(f),
            Value::I32(value) => value.fmt(f),
            Value::I64(value) => value.fmt(f),
            Value::String(value) => value.fmt(f),
        }
    }
}

impl fmt::Display for Argument {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        if let Some(value) = &self.name {
            value.fmt(f)?;
            f.write_str(": ")?;
        }

        self.value.fmt(f)?;

        if let Some(value) = &self.unit {
            value.fmt(f)?;
        }

        Ok(())
    }
}

trait TryFrom<T>: Sized {
    /// The type returned in the event of a conversion error.
    type Error;

    /// Performs the conversion.
    fn try_from(value: T) -> Result<Self, Self::Error>;
}

#[derive(Default)]
pub struct Codec;

// StorageHeader
const STORAGE_HEADER_PATTERN_LENGTH: usize = 4;
const STORAGE_HEADER_LENGTH: usize = 16;

// Header
const WITH_EXTENDED_HEADER_FLAG: u8 = 1;
const BIG_ENDIAN_FLAG: u8 = 1 << 1;
const WITH_ECU_ID_FLAG: u8 = 1 << 2;
const WITH_SESSION_ID_FLAG: u8 = 1 << 3;
const WITH_TIMESTAMP_FLAG: u8 = 1 << 4;
const HEADER_MIN_LENGTH: usize = 4;

// Extended header
const VERBOSE_FLAG: u8 = 1;
const EXTENDED_HEADER_LENGTH: usize = 10;

// Arguments
const BOOL_FLAG: u32 = 1 << 4;
const SINT_FLAG: u32 = 1 << 5;
const UINT_FLAG: u32 = 1 << 6;
//const FLOAT_FLAG: u32 = 1 << 7;
const ARRAY_FLAG: u32 = 1 << 8;
const STRING_FLAG: u32 = 1 << 9;
//const RAW_FLAG: u32 = 1 << 10;
const INFO_FLAG: u32 = 1 << 11;
const FIXED_POINT_FLAG: u32 = 1 << 12;
//const TRACE_INFO_FLAG: u32 = 1 << 13;
//const STRUCT_FLAG: u32 = 1 << 14;

fn calculate_all_headers_length(header_type: u8) -> usize {
    let mut length = HEADER_MIN_LENGTH;
    if (header_type & WITH_ECU_ID_FLAG) != 0 {
        length += 4;
    }
    if (header_type & WITH_SESSION_ID_FLAG) != 0 {
        length += 4;
    }
    if (header_type & WITH_TIMESTAMP_FLAG) != 0 {
        length += 4;
    }
    if (header_type & WITH_EXTENDED_HEADER_FLAG) != 0 {
        length += EXTENDED_HEADER_LENGTH;
    }
    length
}

fn zero_terminated_string(raw: &[u8]) -> Result<String, Error> {
    let nul_range_end = raw
        .iter()
        .position(|&c| c == b'\0')
        .unwrap_or_else(|| raw.len()); // default to length if no `\0` present
    str::from_utf8(&raw[0..nul_range_end])
        .map(|v| v.to_owned())
        .map_err(|e| Error::new(io::ErrorKind::Other, e))
}

impl TryFrom<u8> for LogLevel {
    type Error = Error;
    fn try_from(message_info: u8) -> Result<LogLevel, Error> {
        match message_info >> 4 {
            1 => Ok(LogLevel::Fatal),
            2 => Ok(LogLevel::Error),
            3 => Ok(LogLevel::Warn),
            4 => Ok(LogLevel::Info),
            5 => Ok(LogLevel::Debug),
            6 => Ok(LogLevel::Verbose),
            _ => Err(Error::new(
                io::ErrorKind::Other,
                format!("Unknown log level {}", message_info >> 4),
            )),
        }
    }
}

impl TryFrom<u8> for ApplicationTraceType {
    type Error = Error;
    fn try_from(message_info: u8) -> Result<ApplicationTraceType, Error> {
        match message_info >> 4 {
            1 => Ok(ApplicationTraceType::Variable),
            2 => Ok(ApplicationTraceType::FunctionIn),
            3 => Ok(ApplicationTraceType::FunctionOut),
            4 => Ok(ApplicationTraceType::State),
            5 => Ok(ApplicationTraceType::Vfb),
            _ => Err(Error::new(
                io::ErrorKind::Other,
                format!("Unknown application trace type {}", message_info >> 4),
            )),
        }
    }
}

impl TryFrom<u8> for NetworkTraceType {
    type Error = Error;
    fn try_from(message_info: u8) -> Result<NetworkTraceType, Error> {
        match message_info >> 4 {
            0 => Err(Error::new(
                io::ErrorKind::Other,
                "Unknown network trace type 0",
            )),
            1 => Ok(NetworkTraceType::Ipc),
            2 => Ok(NetworkTraceType::Can),
            3 => Ok(NetworkTraceType::Flexray),
            4 => Ok(NetworkTraceType::Most),
            5 => Ok(NetworkTraceType::Ethernet),
            6 => Ok(NetworkTraceType::Someip),
            _ => Ok(NetworkTraceType::UserDefined(message_info >> 4)),
        }
    }
}

impl TryFrom<u8> for ControlType {
    type Error = Error;
    fn try_from(message_info: u8) -> Result<ControlType, Error> {
        match message_info >> 4 {
            1 => Ok(ControlType::Request),
            2 => Ok(ControlType::Response),
            _ => Err(Error::new(
                io::ErrorKind::Other,
                format!("Unknown control type {}", message_info >> 4),
            )),
        }
    }
}

impl TryFrom<u8> for MessageType {
    type Error = Error;
    fn try_from(message_info: u8) -> Result<MessageType, Error> {
        match (message_info >> 1) & 0b111 {
            0 => Ok(MessageType::Log(LogLevel::try_from(message_info)?)),
            1 => Ok(MessageType::ApplicationTrace(
                ApplicationTraceType::try_from(message_info)?,
            )),
            2 => Ok(MessageType::NetworkTrace(NetworkTraceType::try_from(
                message_info,
            )?)),
            3 => Ok(MessageType::Control(ControlType::try_from(message_info)?)),
            _ => Err(Error::new(
                io::ErrorKind::Other,
                format!("Unknown message trace type {}", (message_info >> 1) & 0b111),
            )),
        }
    }
}

fn decode_storage_header(src: &mut BytesMut) -> Result<Option<StorageHeader>, Error> {
    let mut buf = Bytes::from(src.as_ref()).into_buf();
    if buf.remaining() < STORAGE_HEADER_PATTERN_LENGTH {
        return Ok(None);
    }
    // read dlt storage header
    let byte_1 = buf.get_u8();
    let byte_2 = buf.get_u8();
    let byte_3 = buf.get_u8();
    let byte_4 = buf.get_u8();
    let has_storage_header = byte_1 == 0x44 && byte_2 == 0x4C && byte_3 == 0x54 && byte_4 == 0x01; // "DLT" + 0x01

    if has_storage_header {
        if buf.remaining() < (STORAGE_HEADER_LENGTH - STORAGE_HEADER_PATTERN_LENGTH) {
            return Ok(None); // we swallow an error in the dlt file
        }
        let timestamp_s = buf.get_u32_be();
        let timestamp_ms = buf.get_u32_be();
        let mut ecu_id = [0u8; 4];
        buf.read_exact(&mut ecu_id)?;
        let ecuid = str::from_utf8(&ecu_id).map_err(|e| Error::new(ErrorKind::Other, e))?;
        src.advance(STORAGE_HEADER_LENGTH);
        Ok(Some(StorageHeader {
            timestamp: u64::from(timestamp_s) * 1000 * 1000 + u64::from(timestamp_ms),
            ecu_id: ecuid.to_string(),
        }))
    } else {
        Ok(None)
    }
}

fn decode_header(buf: &mut Buf, header_type: u8, message_counter: u8) -> Result<Header, Error> {
    let ecu_id = if (header_type & WITH_ECU_ID_FLAG) != 0 {
        let ecu_id = Some(zero_terminated_string(&buf.bytes()[..4])?);
        buf.advance(4);
        ecu_id
    } else {
        None
    };

    let session_id = if (header_type & WITH_SESSION_ID_FLAG) != 0 {
        Some(buf.get_u32_be())
    } else {
        None
    };

    let timestamp = if (header_type & WITH_TIMESTAMP_FLAG) != 0 {
        Some(buf.get_u32_be())
    } else {
        None
    };

    Ok(Header {
        is_big_endian: (header_type & BIG_ENDIAN_FLAG) != 0,
        version: header_type >> 5,
        message_counter,
        ecu_id,
        session_id,
        timestamp,
    })
}

fn decode_extended_header(buf: &mut Buf) -> Result<(bool, usize, Option<ExtendedHeader>), Error> {
    let message_info = buf.get_u8();
    let argument_count = buf.get_u8() as usize;
    let application_id = zero_terminated_string(&buf.bytes()[..4])?;
    buf.advance(4);
    let context_id = zero_terminated_string(&buf.bytes()[..4])?;
    buf.advance(4);

    let verbose = (message_info & VERBOSE_FLAG) != 0;
    let message_type = MessageType::try_from(message_info)?;
    let extended_header = ExtendedHeader {
        message_type,
        application_id,
        context_id,
    };

    Ok((verbose, argument_count, Some(extended_header)))
}

fn decode_variable_name<T: ByteOrder>(
    rdr: &mut Read,
    with_variable_info: bool,
) -> Result<Option<String>, Error> {
    if with_variable_info {
        let size = rdr.read_u16::<T>()?;
        let mut raw = vec![0; size as usize];
        rdr.read_exact(&mut raw)?;
        Ok(Some(zero_terminated_string(&raw)?))
    } else {
        Ok(None)
    }
}

fn decode_variable_info<T: ByteOrder>(
    rdr: &mut Read,
    with_variable_info: bool,
) -> Result<(Option<String>, Option<String>), Error> {
    if with_variable_info {
        let name_size = rdr.read_u16::<T>()?;
        let unit_size = rdr.read_u16::<T>()?;

        let mut raw = vec![0; name_size as usize];
        rdr.read_exact(&mut raw)?;
        let name = zero_terminated_string(&raw)?;

        let mut raw = vec![0; unit_size as usize];
        rdr.read_exact(&mut raw)?;
        let unit = zero_terminated_string(&raw)?;

        Ok((Some(name), Some(unit)))
    } else {
        Ok((None, None))
    }
}

fn decode_argument<T: ByteOrder>(buf: &mut Buf) -> Result<Argument, Error> {
    let mut rdr = buf.reader();

    let info = rdr.read_u32::<T>()?;
    let with_variable_info = (info & INFO_FLAG) != 0;

    let arg = if (info & FIXED_POINT_FLAG) != 0 {
        return Err(Error::new(
            ErrorKind::Other,
            "Fixed point is not implemented",
        ));
    } else if (info & ARRAY_FLAG) != 0 {
        return Err(Error::new(ErrorKind::Other, "Arrays are not implemented"));
    } else if (info & BOOL_FLAG) != 0 {
        let name = decode_variable_name::<T>(&mut rdr, with_variable_info)?;

        Argument {
            name,
            unit: None,
            value: Value::Bool(rdr.read_u8()? != 0),
        }
    } else if (info & SINT_FLAG) != 0 {
        let (name, unit) = decode_variable_info::<T>(&mut rdr, with_variable_info)?;

        let value = match info & 0xF {
            1 => rdr.read_i8().map(Value::I8)?,
            2 => rdr.read_i16::<T>().map(Value::I16)?,
            3 => rdr.read_i32::<T>().map(Value::I32)?,
            4 => rdr.read_i64::<T>().map(Value::I64)?,
            _ => return Err(Error::new(ErrorKind::Other, "Unknown size signed integer")),
        };
        Argument { name, unit, value }
    } else if (info & UINT_FLAG) != 0 {
        let (name, unit) = decode_variable_info::<T>(&mut rdr, with_variable_info)?;

        let value = match info & 0xF {
            1 => rdr.read_u8().map(Value::U8)?,
            2 => rdr.read_u16::<T>().map(Value::U16)?,
            3 => rdr.read_u32::<T>().map(Value::U32)?,
            4 => rdr.read_u64::<T>().map(Value::U64)?,
            _ => {
                return Err(Error::new(
                    ErrorKind::Other,
                    "Unknown size unsigned integer",
                ));
            }
        };
        Argument { name, unit, value }
    } else if (info & STRING_FLAG) != 0 {
        let size = rdr.read_u16::<T>()?;
        let name = decode_variable_name::<T>(&mut rdr, with_variable_info)?;

        let mut raw = vec![0; size as usize];
        rdr.read_exact(&mut raw)?;
        let value = zero_terminated_string(&raw)?;

        Argument {
            name,
            unit: None,
            value: Value::String(value),
        }
    } else {
        return Err(Error::new(ErrorKind::Other, "Unknown argument type"));
    };

    Ok(arg)
}

#[derive(Default)]
pub struct DltFileCodec {
    dlt_codec: Codec,
}
impl Decoder for DltFileCodec {
    type Item = Message;
    type Error = Error;
    fn decode(&mut self, src: &mut BytesMut) -> Result<Option<Self::Item>, Self::Error> {
        let storage_header = decode_storage_header(src)?;
        let msg = self.dlt_codec.decode(src)?;
        match msg {
            Some(inner) => Ok(Some(Message {
                storage_header,
                header: inner.header,
                extended_header: inner.extended_header,
                payload: inner.payload,
            })),
            None => Ok(None),
        }
    }

}

impl Encoder for DltFileCodec {
    type Item = Message;
    type Error = Error;

    fn encode(&mut self, msg: Self::Item, dest: &mut BytesMut) -> Result<(), Self::Error> {
        // Messages without extended header (non-verbose) are unimplemented
        if let Some(ext) = msg.extended_header {
            let level = match ext.message_type {
                MessageType::Log(level) => level.into(),
                MessageType::ApplicationTrace(_) | MessageType::NetworkTrace(_) => {
                    log::Level::Trace
                }
                // Ignore everything else
                _ => return Ok(()),
            };

            dest.reserve(1024); // TODO reserve correct amount
                                // Format message: Join arguments as strings
            if let Payload::Verbose(arguments) = msg.payload {
                // Format tag by concatenating ecu_id, application_id and context_id
                write!(
                    dest,
                    "{}{}{}-{}",
                    msg.storage_header
                        .map_or(String::new(), |storage_header| format!(
                            "{}: ",
                            storage_header.timestamp
                        )),
                    msg.header
                        .ecu_id
                        .map(|id| format!("{}-", id))
                        .unwrap_or_else(|| "".into()),
                    ext.application_id,
                    ext.context_id
                )
                .map_err(|e| Error::new(ErrorKind::Other, e))?;

                // Format payload
                arguments
                    .iter()
                    .try_for_each(|arg| write!(dest, " {}", arg))
                    .map_err(|e| Error::new(ErrorKind::Other, e))?;
            }
            writeln!(dest).map_err(|e| Error::new(ErrorKind::Other, e))
        } else {
            Ok(())
        }
    }
}
impl Decoder for Codec {
    type Item = Message;
    type Error = Error;

    fn decode(&mut self, src: &mut BytesMut) -> Result<Option<Self::Item>, Self::Error> {
        let mut buf = Bytes::from(src.as_ref()).into_buf();

        if buf.remaining() < HEADER_MIN_LENGTH {
            return Ok(None);
        }
        let header_type = buf.get_u8();
        let message_counter = buf.get_u8();
        let message_length = buf.get_u16_be() as usize;

        let headers_length = calculate_all_headers_length(header_type);
        if message_length < headers_length {
            return Err(Error::new(ErrorKind::Other, "Invalid header length"));
        }

        if buf.remaining() + HEADER_MIN_LENGTH < message_length {
            return Ok(None);
        }

        let message = decode_message(
            &mut buf,
            header_type,
            message_counter,
            message_length,
            headers_length,
        )
        .map(Option::Some)
        .unwrap_or_else(|e| {
            warn!("Failed to parse message: {}", e);
            None
        });
        src.advance(message_length);
        Ok(message)
    }
}

fn decode_message(
    buf: &mut Buf,
    header_type: u8,
    message_counter: u8,
    message_length: usize,
    headers_length: usize,
) -> Result<Message, Error> {
    let header = decode_header(buf, header_type, message_counter)?;

    let has_extended_header = (header_type & WITH_EXTENDED_HEADER_FLAG) != 0;
    let (verbose, arg_count, extended_header) = if has_extended_header {
        decode_extended_header(buf)?
    } else {
        (false, 0, None)
    };

    let payload_length = message_length - headers_length;

    let payload = if header.is_big_endian {
        decode_payload::<BigEndian>(buf, verbose, arg_count, payload_length)
    } else {
        decode_payload::<LittleEndian>(buf, verbose, arg_count, payload_length)
    }?;

    Ok(Message {
        storage_header: None,
        header,
        extended_header,
        payload,
    })
}

fn decode_payload<T: ByteOrder>(
    buf: &mut Buf,
    verbose: bool,
    arg_count: usize,
    payload_length: usize,
) -> Result<Payload, Error> {
    if !verbose {
        let message_id = buf.reader().read_u32::<T>()?;
        let payload = buf.bytes()[..(payload_length - 4)].to_vec();
        Ok(Payload::NonVerbose(message_id, payload))
    } else {
        let mut arguments = Vec::with_capacity(arg_count);
        for _ in 0..arg_count {
            let arg = decode_argument::<T>(buf)?;
            arguments.push(arg);
        }

        Ok(Payload::Verbose(arguments))
    }
}

impl Encoder for Codec {
    type Item = Message;
    type Error = Error;

    fn encode(&mut self, _: Self::Item, _: &mut BytesMut) -> Result<(), Self::Error> {
        unimplemented!()
    }
}
