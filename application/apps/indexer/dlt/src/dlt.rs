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
#![allow(clippy::unit_arg)]

use crate::proptest_strategies::*;
use byteorder::{BigEndian, ByteOrder, LittleEndian};
use bytes::{BufMut, BytesMut};
use indexer_base::error_reporter::*;
use serde::Serialize;
use std::{io, io::Error, str};

use proptest::prelude::*;
use proptest_derive::Arbitrary;

#[derive(Debug, PartialEq, Eq, Hash, Clone, Copy, PartialOrd, Ord, Serialize, Arbitrary)]
pub enum Endianness {
    /// Little Endian
    Little,
    /// Big Endian
    Big,
}

/// represents a DLT message including all headers
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Message {
    pub storage_header: Option<StorageHeader>,
    pub header: StandardHeader,
    pub extended_header: Option<ExtendedHeader>,
    pub payload: PayloadContent,
}

#[derive(Debug, Clone, PartialEq, Arbitrary, Serialize)]
pub struct StorageHeader {
    pub timestamp: DltTimeStamp,
    #[proptest(strategy = "\"[a-zA-Z 0-9]{4}\"")]
    pub ecu_id: String,
}

/// The Standard Header shall be in big endian format
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct StandardHeader {
    pub version: u8,
    pub endianness: Endianness,
    pub has_extended_header: bool,
    pub message_counter: u8,
    pub ecu_id: Option<String>,
    pub session_id: Option<u32>,
    pub timestamp: Option<u32>,
    pub payload_length: u16,
}

/// The Extended Header shall be in big endian format
#[derive(Debug, Clone, PartialEq, Arbitrary, Serialize)]
pub struct ExtendedHeader {
    pub verbose: bool,
    #[proptest(strategy = "0..=5u8")]
    pub argument_count: u8,
    pub message_type: MessageType,

    #[proptest(strategy = "\"[a-zA-Z]{1,3}\"")]
    pub application_id: String,
    #[proptest(strategy = "\"[a-zA-Z]{1,3}\"")]
    pub context_id: String,
}

/// There are 3 different types of payload:
///     * one for verbose messages,
///     * one for non-verbose messages,
///     * one for control-messages
///
/// For Non-Verbose mode (without Extended Header), a fibex file provides an
/// additional description for the payload.
/// With the combination of a Message ID and an external fibex description,
/// following information is be recoverable (otherwise provided
/// in the Extended Header):
///     * Message Type (MSTP)
///     * Message Info (MSIN)
///     * Number of arguments (NOAR)
///     * Application ID (APID)
///     * Context ID (CTID)
///
/// Control messages are normal Dlt messages with a Standard Header, an Extended Header,
/// and payload. The payload contains of the Service ID and the contained parameters.
///
#[derive(Debug, Clone, PartialEq, Arbitrary, Serialize)]
pub enum PayloadContent {
    #[proptest(strategy = "argument_vector_strategy().prop_map(PayloadContent::Verbose)")]
    Verbose(Vec<Argument>),
    #[proptest(
        strategy = "(0..10u32, prop::collection::vec(any::<u8>(), 0..5)).prop_map(|(a, b)| PayloadContent::NonVerbose(a,b))"
    )]
    NonVerbose(u32, Vec<u8>), // (message_id, payload)
    #[proptest(
        strategy = "(any::<ControlType>(), prop::collection::vec(any::<u8>(), 0..5)).prop_map(|(a, b)| PayloadContent::ControlMsg(a,b))"
    )]
    ControlMsg(ControlType, Vec<u8>),
}

#[derive(Debug, Clone, PartialEq, Arbitrary, Serialize)]
pub struct DltTimeStamp {
    pub seconds: u32,
    #[proptest(strategy = "0..=1_000_000u32")]
    pub microseconds: u32,
}

impl DltTimeStamp {
    pub fn from_ms(ms: u64) -> Self {
        DltTimeStamp {
            seconds: (ms / 1000) as u32,
            microseconds: (ms % 1000) as u32 * 1000,
        }
    }
    pub fn from_us(us: u64) -> Self {
        DltTimeStamp {
            seconds: (us / (1000 * 1000)) as u32,
            microseconds: (us % (1000 * 1000)) as u32 * 1000 * 1000,
        }
    }
}

trait BytesMutExt {
    fn put_zero_terminated_string(&mut self, s: &str, max: usize);
}

impl BytesMutExt for BytesMut {
    fn put_zero_terminated_string(&mut self, s: &str, max: usize) {
        self.extend_from_slice(s.as_bytes());
        if max > s.len() {
            for _ in 0..(max - s.len()) {
                self.put_u8(0x0);
            }
        }
    }
}

impl StorageHeader {
    #[allow(dead_code)]
    pub fn as_bytes(self: &StorageHeader) -> Vec<u8> {
        let mut buf = BytesMut::with_capacity(STORAGE_HEADER_LENGTH as usize);
        buf.extend_from_slice(b"DLT");
        buf.put_u8(0x01);
        buf.put_u32_le(self.timestamp.seconds);
        buf.put_u32_le(self.timestamp.microseconds as u32);
        buf.put_zero_terminated_string(&self.ecu_id[..], 4);
        buf.to_vec()
    }
}

impl StandardHeader {
    pub fn header_type_byte(&self) -> u8 {
        standard_header_type(
            self.has_extended_header,
            self.endianness,
            self.ecu_id.is_some(),
            self.session_id.is_some(),
            self.timestamp.is_some(),
            self.version,
        )
    }

    /// compute length of complete dlt message without storage header
    /// header + extended-header + payload
    pub fn overall_length(&self) -> u16 {
        // header length
        let mut length: u16 = HEADER_MIN_LENGTH;
        if self.ecu_id.is_some() {
            length += 4;
        }
        if self.session_id.is_some() {
            length += 4;
        }
        if self.timestamp.is_some() {
            length += 4;
        }
        // add ext header length
        if self.has_extended_header {
            length += EXTENDED_HEADER_LENGTH
        }
        // payload length
        length += self.payload_length;
        length
    }
}

fn standard_header_type(
    has_extended_header: bool,
    endianness: Endianness,
    with_ecu_id: bool,
    with_session_id: bool,
    with_timestamp: bool,
    version: u8,
) -> u8 {
    let mut header_type = 0u8;
    if has_extended_header {
        header_type |= WITH_EXTENDED_HEADER_FLAG
    }
    if endianness == Endianness::Big {
        header_type |= BIG_ENDIAN_FLAG
    }
    if with_ecu_id {
        header_type |= WITH_ECU_ID_FLAG
    }
    if with_session_id {
        header_type |= WITH_SESSION_ID_FLAG
    }
    if with_timestamp {
        header_type |= WITH_TIMESTAMP_FLAG
    }
    header_type |= (version & 0b111) << 5;
    header_type
}
impl StandardHeader {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        version: u8,
        endianness: Endianness,
        message_counter: u8,
        has_extended_header: bool,
        payload_length: u16,
        ecu_id: Option<String>,
        session_id: Option<u32>,
        timestamp: Option<u32>,
    ) -> Self {
        StandardHeader {
            // version: header_type_byte >> 5 & 0b111,
            // big_endian: (header_type_byte & BIG_ENDIAN_FLAG) != 0,
            version,
            endianness,
            has_extended_header,
            message_counter,
            ecu_id,
            session_id,
            timestamp,
            payload_length,
        }
    }

    #[allow(dead_code)]
    pub fn as_bytes(&self) -> Vec<u8> {
        let header_type_byte = self.header_type_byte();
        let size = calculate_standard_header_length(header_type_byte);
        let mut buf = BytesMut::with_capacity(size as usize);
        buf.put_u8(header_type_byte);
        buf.put_u8(self.message_counter);
        buf.put_u16(self.overall_length());
        if let Some(id) = &self.ecu_id {
            buf.put_zero_terminated_string(&id[..], 4);
        }
        if let Some(id) = &self.session_id {
            buf.put_u32(*id);
        }
        if let Some(time) = &self.timestamp {
            buf.put_u32(*time);
        }
        buf.to_vec()
    }
}

#[derive(Debug, PartialEq, PartialOrd, Clone, Copy, Serialize, Arbitrary)]
pub enum LogLevel {
    Fatal,
    Error,
    Warn,
    Info,
    Debug,
    Verbose,
    #[proptest(strategy = "(7..=15u8).prop_map(LogLevel::Invalid)")]
    Invalid(u8),
}

#[derive(Debug, PartialEq, Clone, Arbitrary, Serialize)]
pub enum ApplicationTraceType {
    Variable,
    FunctionIn,
    FunctionOut,
    State,
    Vfb,
    #[proptest(strategy = "(6..15u8).prop_map(ApplicationTraceType::Invalid)")]
    Invalid(u8),
}

#[derive(Debug, PartialEq, Clone, Arbitrary, Serialize)]
pub enum NetworkTraceType {
    Ipc,
    Can,
    Flexray,
    Most,
    Ethernet,
    Someip,
    Invalid,
    #[proptest(strategy = "(7..15u8).prop_map(NetworkTraceType::UserDefined)")]
    UserDefined(u8),
}

const CTRL_TYPE_REQUEST: u8 = 0x1;
const CTRL_TYPE_RESPONSE: u8 = 0x2;
#[derive(Debug, PartialEq, Clone, Arbitrary, Serialize)]
pub enum ControlType {
    Request,  // represented by 0x1
    Response, // represented by 0x2
    #[proptest(strategy = "(3..15u8).prop_map(ControlType::Unknown)")]
    Unknown(u8),
}
impl ControlType {
    pub(crate) fn value(&self) -> u8 {
        match *self {
            ControlType::Request => CTRL_TYPE_REQUEST,
            ControlType::Response => CTRL_TYPE_RESPONSE,
            ControlType::Unknown(n) => n,
        }
    }
    pub fn from_value(t: u8) -> Self {
        match t {
            CTRL_TYPE_REQUEST => ControlType::Request,
            CTRL_TYPE_RESPONSE => ControlType::Response,
            t => ControlType::Unknown(t),
        }
    }
}

#[derive(Debug, PartialEq, Clone, Arbitrary, Serialize)]
pub enum MessageType {
    Log(LogLevel),
    ApplicationTrace(ApplicationTraceType),
    NetworkTrace(NetworkTraceType),
    Control(ControlType),
    #[proptest(strategy = "((0b100u8..0b111u8),(0..0b1111u8)).prop_map(MessageType::Unknown)")]
    Unknown((u8, u8)),
}

impl MessageType {
    pub(crate) fn try_new_from_fibex_message_info(message_info: &str) -> Option<MessageType> {
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
}

pub const DLT_TYPE_LOG: u8 = 0b000;
pub const DLT_TYPE_APP_TRACE: u8 = 0b001;
pub const DLT_TYPE_NW_TRACE: u8 = 0b010;
pub const DLT_TYPE_CONTROL: u8 = 0b011;

impl ExtendedHeader {
    #[allow(dead_code)]
    pub fn as_bytes(self: &ExtendedHeader) -> Vec<u8> {
        let mut buf = BytesMut::with_capacity(EXTENDED_HEADER_LENGTH as usize);
        buf.put_u8(u8::from(&self.message_type) | if self.verbose { 1 } else { 0 });
        buf.put_u8(self.argument_count);
        buf.put_zero_terminated_string(&self.application_id[..], 4);
        buf.put_zero_terminated_string(&self.context_id[..], 4);
        buf.to_vec()
    }
    pub fn skip_with_level(self: &ExtendedHeader, level: LogLevel) -> bool {
        match self.message_type {
            MessageType::Log(n) => match (n, level) {
                (LogLevel::Invalid(a), LogLevel::Invalid(b)) => a < b,
                (LogLevel::Invalid(_), _) => false,
                (_, LogLevel::Invalid(_)) => true,
                _ => level < n,
            },
            _ => false,
        }
    }
}

/// Fixed-Point representation. only supports 32 bit and 64 bit values
/// according to the spec 128 bit are possible but we don't support it
#[derive(Debug, PartialEq, Clone, Arbitrary, Serialize)]
pub enum FixedPointValue {
    I32(i32),
    I64(i64),
}
pub fn fixed_point_value_width(v: &FixedPointValue) -> usize {
    match v {
        FixedPointValue::I32(_) => 4,
        FixedPointValue::I64(_) => 8,
    }
}
#[derive(Debug, PartialEq, Clone, Serialize)]
pub enum Value {
    Bool(u8),
    U8(u8),
    U16(u16),
    U32(u32),
    U64(u64),
    U128(u128),
    I8(i8),
    I16(i16),
    I32(i32),
    I64(i64),
    I128(i128),
    F32(f32),
    F64(f64),
    StringVal(String),
    Raw(Vec<u8>),
}

#[derive(Debug, Clone, PartialEq, Arbitrary, Serialize)]
pub enum StringCoding {
    ASCII,
    UTF8,
    #[proptest(strategy = "(2..=7u8).prop_map(StringCoding::Reserved)")]
    Reserved(u8),
}
#[derive(Debug, Clone, PartialEq, Copy, Arbitrary, Serialize)]
pub enum FloatWidth {
    Width32 = 32,
    Width64 = 64,
}
pub fn float_width_to_type_length(width: FloatWidth) -> TypeLength {
    match width {
        FloatWidth::Width32 => TypeLength::BitLength32,
        FloatWidth::Width64 => TypeLength::BitLength64,
    }
}

#[derive(Debug, Clone, PartialEq, Copy, Arbitrary, Serialize)]
pub enum TypeLength {
    BitLength8 = 8,
    BitLength16 = 16,
    BitLength32 = 32,
    BitLength64 = 64,
    BitLength128 = 128,
}

impl FloatWidth {
    pub fn width_in_bytes(self) -> usize {
        match self {
            FloatWidth::Width32 => 4,
            FloatWidth::Width64 => 8,
        }
    }
}

impl TypeLength {
    pub fn width_in_bytes(self) -> usize {
        match self {
            TypeLength::BitLength8 => 1,
            TypeLength::BitLength16 => 2,
            TypeLength::BitLength32 => 4,
            TypeLength::BitLength64 => 8,
            TypeLength::BitLength128 => 16,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Arbitrary, Serialize)]
pub enum TypeInfoKind {
    Bool,
    #[proptest(strategy = "signed_strategy()")]
    Signed(TypeLength),
    SignedFixedPoint(FloatWidth),
    #[proptest(strategy = "unsigned_strategy()")]
    Unsigned(TypeLength),
    UnsignedFixedPoint(FloatWidth),
    Float(FloatWidth),
    // Array, NYI
    StringType,
    Raw,
}

///
/// TypeInfo is a 32 bit field. It is encoded the following way:
///     * Bit0-3    Type Length (TYLE)  -> TypeKindInfo
///     * Bit 4     Type Bool (BOOL)    -> TypeKindInfo
///     * Bit 5     Type Signed (SINT)  -> TypeKindInfo
///     * Bit 6     Type Unsigned (UINT) -> TypeKindInfo
///     * Bit 7     Type Float (FLOA)   -> TypeKindInfo
///     * Bit 8     Type Array (ARAY)   -> TypeKindInfo
///     * Bit 9     Type String (STRG)  -> TypeKindInfo
///     * Bit 10    Type Raw (RAWD)     -> TypeKindInfo
///     * Bit 11    Variable Info (VARI)
///     * Bit 12    Fixed Point (FIXP)  -> TypeKindInfo
///     * Bit 13    Trace Info (TRAI)
///     * Bit 14    Type Struct (STRU)  -> TypeKindInfo
///     * Bit15–17  String Coding (SCOD)
///     * Bit18–31  reserved for future use
///
/// has_variable_info: If Variable Info (VARI) is set, the name and the unit of a variable can be added.
/// Both always contain a length information field and a field with the text (of name or unit).
/// The length field contains the number of characters of the associated name or unit filed.
/// The unit information is to add only in some data types.
#[derive(Debug, Clone, PartialEq, Arbitrary, Serialize)]
pub struct TypeInfo {
    pub kind: TypeInfoKind,
    pub coding: StringCoding,
    pub has_variable_info: bool,
    pub has_trace_info: bool,
}
impl TypeInfo {
    pub fn type_length_bits_float(len: FloatWidth) -> u32 {
        match len {
            FloatWidth::Width32 => 0b011,
            FloatWidth::Width64 => 0b100,
        }
    }
    pub fn type_length_bits(len: TypeLength) -> u32 {
        match len {
            TypeLength::BitLength8 => 0b001,
            TypeLength::BitLength16 => 0b010,
            TypeLength::BitLength32 => 0b011,
            TypeLength::BitLength64 => 0b100,
            TypeLength::BitLength128 => 0b101,
        }
    }
    pub fn type_width(self: &TypeInfo) -> usize {
        match self.kind {
            TypeInfoKind::Signed(v) => v as usize,
            TypeInfoKind::SignedFixedPoint(v) => v as usize,
            TypeInfoKind::Unsigned(v) => v as usize,
            TypeInfoKind::UnsignedFixedPoint(v) => v as usize,
            TypeInfoKind::Float(v) => v as usize,
            _ => 0,
        }
    }
    pub fn is_fixed_point(self: &TypeInfo) -> bool {
        matches!(
            self.kind,
            TypeInfoKind::SignedFixedPoint(_) | TypeInfoKind::UnsignedFixedPoint(_)
        )
    }
    pub fn as_bytes<T: ByteOrder>(self: &TypeInfo) -> Vec<u8> {
        // ptrace!("TypeInfo::as_bytes: {:?}", self);
        let mut info: u32 = 0;
        // encode length
        match self.kind {
            TypeInfoKind::Float(len) => info |= TypeInfo::type_length_bits_float(len),
            TypeInfoKind::Signed(len) => info |= TypeInfo::type_length_bits(len),
            TypeInfoKind::SignedFixedPoint(len) => info |= TypeInfo::type_length_bits_float(len),
            TypeInfoKind::Unsigned(len) => info |= TypeInfo::type_length_bits(len),
            TypeInfoKind::UnsignedFixedPoint(len) => info |= TypeInfo::type_length_bits_float(len),
            _ => (),
        }
        match self.kind {
            TypeInfoKind::Bool => info |= TYPE_INFO_BOOL_FLAG,
            TypeInfoKind::Signed(_) => info |= TYPE_INFO_SINT_FLAG,
            TypeInfoKind::SignedFixedPoint(_) => info |= TYPE_INFO_SINT_FLAG,
            TypeInfoKind::Unsigned(_) => info |= TYPE_INFO_UINT_FLAG,
            TypeInfoKind::UnsignedFixedPoint(_) => info |= TYPE_INFO_UINT_FLAG,
            TypeInfoKind::Float(_) => info |= TYPE_INFO_FLOAT_FLAG,
            // TypeInfoKind::Array => info |= TYPE_INFO_ARRAY_FLAG,
            TypeInfoKind::StringType => info |= TYPE_INFO_STRING_FLAG,
            TypeInfoKind::Raw => info |= TYPE_INFO_RAW_FLAG,
        }
        if self.has_variable_info {
            info |= TYPE_INFO_VARIABLE_INFO
        }
        if self.is_fixed_point() {
            info |= TYPE_INFO_FIXED_POINT_FLAG
        }
        if self.has_trace_info {
            info |= TYPE_INFO_TRACE_INFO_FLAG
        }
        match self.coding {
            StringCoding::ASCII => info |= 0b000 << 15,
            StringCoding::UTF8 => info |= 0b001 << 15,
            StringCoding::Reserved(v) => info |= ((0b111 & v) as u32) << 15,
        }
        trace!("writing type info: {:#b}", info);

        let mut buf = BytesMut::with_capacity(4);
        let mut b = [0; 4];
        T::write_u32(&mut b, info);
        trace!("type info bytes: {:02X?}", b);
        buf.put_slice(&b);
        buf.to_vec()
    }
}
///    Bit Representation               0b0011_1111_1111_1111_1111
///    string coding .......................^^_^||| |||| |||| ||||
///    type struct .............................^|| |||| |||| ||||
///    trace info ...............................^| |||| |||| ||||
///    fixed point ...............................^ |||| |||| ||||
///    variable info................................^||| |||| ||||
///    type raw .....................................^|| |||| ||||
///    type string ...................................^| |||| ||||
///    type array .....................................^ |||| ||||
///    type float .......................................^||| ||||
///    type unsigned .....................................^|| ||||
///    type signed ........................................^| ||||
///    type bool ...........................................^ ||||
///    type length ...........................................^^^^
impl TryFrom<u32> for TypeInfo {
    type Error = Error;
    fn try_from(info: u32) -> Result<TypeInfo, Error> {
        fn type_len(info: u32) -> Result<TypeLength, Error> {
            match info & 0b1111 {
                0x01 => Ok(TypeLength::BitLength8),
                0x02 => Ok(TypeLength::BitLength16),
                0x03 => Ok(TypeLength::BitLength32),
                0x04 => Ok(TypeLength::BitLength64),
                0x05 => Ok(TypeLength::BitLength128),
                v => Err(Error::new(
                    io::ErrorKind::Other,
                    format!("Unknown type_len in TypeInfo {:b}", v),
                )),
            }
        }
        fn type_len_float(info: u32) -> Result<FloatWidth, Error> {
            match info & 0b1111 {
                0x03 => Ok(FloatWidth::Width32),
                0x04 => Ok(FloatWidth::Width64),
                v => Err(Error::new(
                    io::ErrorKind::Other,
                    format!("Unknown type_len_float in TypeInfo {:b}", v),
                )),
            }
        }

        let is_fixed_point = (info & TYPE_INFO_FIXED_POINT_FLAG) != 0;
        let kind = match (info >> 4) & 0b111_1111 {
            0b000_0001 => Ok(TypeInfoKind::Bool),
            0b000_0010 => Ok(if is_fixed_point {
                TypeInfoKind::SignedFixedPoint(type_len_float(info)?)
            } else {
                TypeInfoKind::Signed(type_len(info)?)
            }),
            0b000_0100 => Ok(if is_fixed_point {
                TypeInfoKind::UnsignedFixedPoint(type_len_float(info)?)
            } else {
                TypeInfoKind::Unsigned(type_len(info)?)
            }),
            0b000_1000 => Ok(TypeInfoKind::Float(type_len_float(info)?)),
            // 0b001_0000 => Ok(TypeInfoKind::Array),
            0b010_0000 => Ok(TypeInfoKind::StringType),
            0b100_0000 => Ok(TypeInfoKind::Raw),
            v => Err(Error::new(
                io::ErrorKind::Other,
                format!("Unknown TypeInfoKind in TypeInfo {:b}", v),
            )),
        }?;
        let coding = match (info >> 15) & 0b111 {
            0x00 => (StringCoding::ASCII),
            0x01 => (StringCoding::UTF8),
            v => {
                trace!("Unknown coding in TypeInfo, assume UTF8");
                StringCoding::Reserved(v as u8)
            }
        };
        Ok(TypeInfo {
            has_variable_info: (info & TYPE_INFO_VARIABLE_INFO) != 0,
            has_trace_info: (info & TYPE_INFO_TRACE_INFO_FLAG) != 0,
            kind,
            coding,
        })
    }
}
/// The following equation defines the relation between the logical value (log_v) and
/// the physical value (phy_v), offset and quantization:
///     log_v = phy_v * quantization + offset
///
/// * phy_v is what we received in the dlt message
/// * log_v is the real value
/// example: the degree celcius is transmitted,
/// quantization = 0.01, offset = -50
/// now the transmitted value phy_v = (log_v - offset)/quantization = 7785
///
/// The width depends on the TYLE value
///     * i32 bit if Type Length (TYLE) equals 1,2 or 3
///     * i64 bit if Type Length (TYLE) equals 4
///     * i128 bit if Type Length (TYLE) equals 5 (unsupported)
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct FixedPoint {
    pub quantization: f32,
    pub offset: FixedPointValue,
}
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Argument {
    pub type_info: TypeInfo,
    pub name: Option<String>,
    pub unit: Option<String>,
    pub fixed_point: Option<FixedPoint>,
    pub value: Value,
}
impl Argument {
    fn value_as_f64(&self) -> Option<f64> {
        match self.value {
            Value::I8(v) => Some(v as f64),
            Value::I16(v) => Some(v as f64),
            Value::I32(v) => Some(v as f64),
            Value::I64(v) => Some(v as f64),
            Value::U8(v) => Some(v as f64),
            Value::U16(v) => Some(v as f64),
            Value::U32(v) => Some(v as f64),
            Value::U64(v) => Some(v as f64),
            _ => None,
        }
    }
    fn log_v(&self) -> Option<u64> {
        match &self.fixed_point {
            Some(FixedPoint {
                quantization,
                offset,
            }) => {
                if let Some(value) = self.value_as_f64() {
                    match offset {
                        FixedPointValue::I32(v) => {
                            Some((value * *quantization as f64) as u64 + *v as u64)
                        }
                        FixedPointValue::I64(v) => {
                            Some((value * *quantization as f64) as u64 + *v as u64)
                        }
                    }
                } else {
                    None
                }
            }
            _ => None,
        }
    }
    pub(crate) fn to_real_value(&self) -> Option<u64> {
        match (&self.type_info.kind, &self.fixed_point) {
            (TypeInfoKind::SignedFixedPoint(_), Some(_)) => self.log_v(),
            (TypeInfoKind::UnsignedFixedPoint(_), Some(_)) => self.log_v(),
            _ => None,
        }
    }
    #[allow(dead_code)]
    pub fn valid(&self) -> bool {
        let mut valid = true;
        match self.type_info.kind {
            TypeInfoKind::Bool => match self.value {
                Value::Bool(_) => (),
                _ => valid = false,
            },
            TypeInfoKind::Float(FloatWidth::Width32) => match self.value {
                Value::F32(_) => (),
                _ => valid = false,
            },
            TypeInfoKind::Float(FloatWidth::Width64) => match self.value {
                Value::F64(_) => (),
                _ => valid = false,
            },
            _ => (),
        }
        valid
    }
    pub fn len_old<T: ByteOrder>(&self) -> usize {
        self.as_bytes::<T>().len()
    }
    fn fixed_point_capacity(&self, float_width: FloatWidth) -> usize {
        let mut capacity = float_width.width_in_bytes();
        if let Some(fp) = &self.fixed_point {
            capacity += 4 /*quantixation */ + fixed_point_value_width(&fp.offset);
        }
        capacity
    }

    pub fn len_new(self: &Argument) -> usize {
        let name_space = match &self.name {
            Some(n) => 2 /* length of name */ + n.len() + 1,
            _ => 0,
        };
        let unit_space = match &self.unit {
            Some(u) => 2 /* length of unit */ + u.len() + 1,
            _ => 0,
        };
        let without_type_info = match self.type_info.kind {
            TypeInfoKind::Bool => name_space + 1,
            TypeInfoKind::Signed(bit_width) => name_space + unit_space + bit_width.width_in_bytes(),
            TypeInfoKind::Unsigned(bit_width) => {
                name_space + unit_space + bit_width.width_in_bytes()
            }
            TypeInfoKind::SignedFixedPoint(float_width) => {
                name_space + unit_space + self.fixed_point_capacity(float_width)
            }
            TypeInfoKind::UnsignedFixedPoint(float_width) => {
                name_space + unit_space + self.fixed_point_capacity(float_width)
            }
            TypeInfoKind::Float(float_width) => {
                name_space + unit_space + float_width.width_in_bytes()
            }
            TypeInfoKind::StringType => {
                let mut capacity = 2 /* length of string and termination char */ + name_space;
                match &self.value {
                    Value::StringVal(sv) => {
                        capacity += sv.len() + 1;
                    }
                    _ => {
                        error!("Found typeinfokind StringType but no StringValue!");
                    }
                }
                capacity
            }
            TypeInfoKind::Raw => {
                let mut capacity = 2 /* length of string and termination char */ + name_space;
                match &self.value {
                    Value::Raw(bytes) => capacity += bytes.len(),
                    _ => {
                        error!("Found typeinfokind StringType but no StringValue!");
                    }
                }
                capacity
            }
        };
        without_type_info + TYPE_INFO_LENGTH
    }

    pub fn is_empty<T: ByteOrder>(&self) -> bool {
        let old_len = self.len_old::<T>();
        let new_len = self.len_new();
        assert_eq!(old_len, new_len);
        new_len == 0
    }

    fn mut_buf_with_typeinfo_name<T: ByteOrder>(
        &self,
        info: &TypeInfo,
        name: &Option<String>,
    ) -> BytesMut {
        let mut capacity = TYPE_INFO_LENGTH + info.type_width();
        if let Some(n) = name {
            capacity += 2 /* length name */ + n.len() + 1;
        }
        let mut buf = BytesMut::with_capacity(capacity);
        buf.extend_from_slice(&info.as_bytes::<T>()[..]);
        if let Some(n) = name {
            let mut tmp_buf = [0; 2];
            T::write_u16(&mut tmp_buf, n.len() as u16 + 1);
            buf.extend_from_slice(&tmp_buf);
            buf.extend_from_slice(n.as_bytes());
            buf.put_u8(0x0); // null termination
        }
        buf
    }
    fn mut_buf_with_typeinfo_name_unit<T: ByteOrder>(
        &self,
        info: &TypeInfo,
        name: &Option<String>,
        unit: &Option<String>,
        fixed_point: &Option<FixedPoint>,
    ) -> BytesMut {
        // trace!(
        //     "mut_buf_with_typeinfo_name_unit (info: {:?}) {:?}/{:?} (fp: {:?})",
        //     info,
        //     name,
        //     unit,
        //     fixed_point
        // );
        let mut capacity = TYPE_INFO_LENGTH;
        if info.has_variable_info {
            if let Some(n) = name {
                capacity += 2 /* length name */ + n.len() + 1;
            } else {
                capacity += 2 + 1; // only length field and \0 termination
            }
            if let Some(u) = unit {
                capacity += 2 /* length unit */ + u.len() + 1;
            } else {
                capacity += 2 + 1; // only length field and \0 termination
            }
        }
        if let Some(fp) = fixed_point {
            capacity += 4 /* quantization */ + fixed_point_value_width(&fp.offset);
        }
        capacity += info.type_width();
        let mut buf = BytesMut::with_capacity(capacity);
        buf.extend_from_slice(&info.as_bytes::<T>()[..]);
        if info.has_variable_info {
            let mut tmp_buf = [0; 2];
            if let Some(n) = name {
                T::write_u16(&mut tmp_buf, n.len() as u16 + 1);
                buf.extend_from_slice(&tmp_buf);
            // trace!("put name len: {:02X?}", buf.to_vec());
            } else {
                T::write_u16(&mut tmp_buf, 1u16);
                buf.extend_from_slice(&tmp_buf);
            }
            if let Some(u) = unit {
                T::write_u16(&mut tmp_buf, u.len() as u16 + 1);
                buf.extend_from_slice(&tmp_buf);
            // trace!("put unit len: {:02X?}", buf.to_vec());
            } else {
                T::write_u16(&mut tmp_buf, 1u16);
                buf.extend_from_slice(&tmp_buf);
            }
            if let Some(n) = name {
                buf.extend_from_slice(n.as_bytes());
                buf.put_u8(0x0); // null termination
                                 // trace!("put name: {:02X?}", buf.to_vec());
            } else {
                buf.put_u8(0x0); // only null termination
            }
            if let Some(u) = unit {
                buf.extend_from_slice(u.as_bytes());
                buf.put_u8(0x0); // null termination
                                 // trace!("put unit: {:02X?}", buf.to_vec());
            } else {
                buf.put_u8(0x0); // only null termination
            }
        }
        if let Some(fp) = fixed_point {
            #[allow(deprecated)]
            let mut tmp_buf = [0; 4];
            T::write_f32(&mut tmp_buf, fp.quantization);
            buf.extend_from_slice(&tmp_buf);
            match fp.offset {
                FixedPointValue::I32(v) => {
                    T::write_i32(&mut tmp_buf, v);
                    buf.extend_from_slice(&tmp_buf);
                }
                FixedPointValue::I64(v) => {
                    let mut tmp_buf8 = [0; 8];
                    T::write_i64(&mut tmp_buf8, v);
                    buf.extend_from_slice(&tmp_buf8);
                }
            }
        }
        // trace!("typeinfo + name + unit as bytes: {:02X?}", buf.to_vec());
        buf
    }

    pub fn as_bytes<T: ByteOrder>(self: &Argument) -> Vec<u8> {
        match self.type_info.kind {
            TypeInfoKind::Bool => {
                let mut buf = self.mut_buf_with_typeinfo_name::<T>(&self.type_info, &self.name);
                let v = match self.value {
                    Value::Bool(x) => x,
                    _ => {
                        error!("Argument typeinfokind was bool but value was not!");
                        0x0
                    }
                };
                buf.put_u8(v);
                dbg_bytes("bool argument", &buf.to_vec()[..]);
                buf.to_vec()
            }
            TypeInfoKind::Signed(_) => {
                let mut buf = self.mut_buf_with_typeinfo_name_unit::<T>(
                    &self.type_info,
                    &self.name,
                    &self.unit,
                    &self.fixed_point,
                );
                put_signed_value::<T>(&self.value, &mut buf);
                dbg_bytes("signed argument", &buf.to_vec()[..]);
                buf.to_vec()
            }
            TypeInfoKind::SignedFixedPoint(_) => {
                let mut buf = self.mut_buf_with_typeinfo_name_unit::<T>(
                    &self.type_info,
                    &self.name,
                    &self.unit,
                    &self.fixed_point,
                );
                put_signed_value::<T>(&self.value, &mut buf);
                dbg_bytes("signed fixed point argument", &buf.to_vec()[..]);
                buf.to_vec()
            }
            TypeInfoKind::Unsigned(_) => {
                let mut buf = self.mut_buf_with_typeinfo_name_unit::<T>(
                    &self.type_info,
                    &self.name,
                    &self.unit,
                    &self.fixed_point,
                );
                put_unsigned_value::<T>(&self.value, &mut buf);
                dbg_bytes("unsigned argument", &buf.to_vec()[..]);
                buf.to_vec()
            }
            TypeInfoKind::UnsignedFixedPoint(_) => {
                let mut buf = self.mut_buf_with_typeinfo_name_unit::<T>(
                    &self.type_info,
                    &self.name,
                    &self.unit,
                    &self.fixed_point,
                );
                put_unsigned_value::<T>(&self.value, &mut buf);
                dbg_bytes("unsigned FP argument", &buf.to_vec()[..]);
                buf.to_vec()
            }
            TypeInfoKind::Float(_) => {
                fn write_value<T: ByteOrder>(value: &Value, buf: &mut BytesMut) {
                    match value {
                        Value::F32(v) => {
                            let mut b = [0; 4];
                            T::write_f32(&mut b, *v);
                            buf.put_slice(&b)
                        }
                        Value::F64(v) => {
                            let mut b = [0; 8];
                            T::write_f64(&mut b, *v);
                            buf.put_slice(&b)
                        }
                        _ => (),
                    }
                }
                let mut buf = self.mut_buf_with_typeinfo_name_unit::<T>(
                    &self.type_info,
                    &self.name,
                    &self.unit,
                    &self.fixed_point,
                );
                write_value::<T>(&self.value, &mut buf);
                dbg_bytes("float argument", &buf.to_vec()[..]);
                buf.to_vec()
            }
            // TypeInfoKind::Array => {
            //     // TODO dlt array type not yet implemented NYI
            //     warning!("found dlt array type...not yet supported");
            //     BytesMut::with_capacity(STORAGE_HEADER_LENGTH).to_vec()
            // }
            TypeInfoKind::StringType => {
                match (self.type_info.has_variable_info, &self.name) {
                    (true, Some(var_name)) => {
                        match &self.value {
                            Value::StringVal(s) => {
                                let name_len_with_termination: u16 = var_name.len() as u16 + 1;
                                let mut buf = BytesMut::with_capacity(
                                    TYPE_INFO_LENGTH +
                                    2 /* length string */ +
                                    2 /* length name */ +
                                    name_len_with_termination as usize +
                                    s.len() + 1,
                                );
                                buf.extend_from_slice(&self.type_info.as_bytes::<T>()[..]);
                                let mut tmp_buf = [0; 2];
                                T::write_u16(&mut tmp_buf, s.len() as u16 + 1);
                                buf.extend_from_slice(&tmp_buf);
                                T::write_u16(&mut tmp_buf, name_len_with_termination);
                                buf.extend_from_slice(&tmp_buf);

                                buf.extend_from_slice(var_name.as_bytes());
                                buf.put_u8(0x0); // null termination
                                buf.extend_from_slice(s.as_bytes());
                                buf.put_u8(0x0); // null termination
                                dbg_bytes("StringType with variable info", &buf.to_vec()[..]);
                                buf.to_vec()
                            }
                            v => {
                                error!("found invalid dlt entry for StringType ({:?}", v);
                                BytesMut::with_capacity(0).to_vec()
                            }
                        }
                    }
                    (false, None) => {
                        match &self.value {
                            Value::StringVal(s) => {
                                let mut buf = BytesMut::with_capacity(
                                    TYPE_INFO_LENGTH +
                                    2 /* length string */ +
                                    s.len() + 1,
                                );
                                buf.extend_from_slice(&self.type_info.as_bytes::<T>()[..]);

                                let mut tmp_buf = [0; 2];
                                T::write_u16(&mut tmp_buf, s.len() as u16 + 1);
                                buf.extend_from_slice(&tmp_buf);

                                buf.extend_from_slice(s.as_bytes());
                                buf.put_u8(0x0); // null termination
                                dbg_bytes_with_info(
                                    "StringType, no variable info",
                                    &buf.to_vec()[..],
                                    Some(s),
                                );
                                buf.to_vec()
                            }
                            _ => {
                                error!("found invalid dlt entry for StringType ({:?}", self);
                                BytesMut::with_capacity(0).to_vec()
                            }
                        }
                    }
                    _ => {
                        error!("found invalid dlt entry ({:?}", self);
                        BytesMut::with_capacity(0).to_vec()
                    }
                }
            }
            TypeInfoKind::Raw => {
                match (self.type_info.has_variable_info, &self.name) {
                    (true, Some(var_name)) => {
                        match &self.value {
                            Value::Raw(bytes) => {
                                let name_len_with_termination: u16 = var_name.len() as u16 + 1;
                                let mut buf = BytesMut::with_capacity(
                                    TYPE_INFO_LENGTH +
                                    2 /* length bytes */ +
                                    2 /* length name */ +
                                    name_len_with_termination as usize +
                                    bytes.len(),
                                );
                                buf.extend_from_slice(&self.type_info.as_bytes::<T>()[..]);

                                let mut tmp_buf = [0; 2];
                                T::write_u16(&mut tmp_buf, bytes.len() as u16);
                                buf.extend_from_slice(&tmp_buf);
                                T::write_u16(&mut tmp_buf, name_len_with_termination);
                                buf.extend_from_slice(&tmp_buf);

                                buf.extend_from_slice(var_name.as_bytes());
                                buf.put_u8(0x0); // null termination
                                buf.extend_from_slice(bytes);
                                dbg_bytes("Raw, with variable info", &buf.to_vec()[..]);
                                buf.to_vec()
                            }
                            _ => {
                                error!("found invalid dlt entry for Raw ({:?}", self);
                                BytesMut::with_capacity(0).to_vec()
                            }
                        }
                    }
                    (false, None) => {
                        match &self.value {
                            Value::Raw(bytes) => {
                                let mut buf = BytesMut::with_capacity(
                                    TYPE_INFO_LENGTH +
                                    2 /* length string */ +
                                    bytes.len(),
                                );
                                buf.extend_from_slice(&self.type_info.as_bytes::<T>()[..]);

                                let mut tmp_buf = [0; 2];
                                T::write_u16(&mut tmp_buf, bytes.len() as u16);
                                buf.extend_from_slice(&tmp_buf);

                                buf.extend_from_slice(bytes);
                                dbg_bytes("Raw, no variable info", &buf.to_vec()[..]);
                                buf.to_vec()
                            }
                            _ => {
                                error!("found invalid dlt entry for Raw ({:?}", self);
                                BytesMut::with_capacity(0).to_vec()
                            }
                        }
                    }
                    _ => {
                        error!("found invalid dlt entry ({:?}", self);
                        BytesMut::with_capacity(0).to_vec()
                    }
                }
            }
        }
    }
}
fn put_unsigned_value<T: ByteOrder>(value: &Value, buf: &mut BytesMut) {
    match value {
        Value::U8(v) => buf.put_u8(*v),
        Value::U16(v) => {
            let mut b = [0; 2];
            T::write_u16(&mut b, *v);
            buf.put_slice(&b)
        }
        Value::U32(v) => {
            let mut b = [0; 4];
            T::write_u32(&mut b, *v);
            buf.put_slice(&b)
        }
        Value::U64(v) => {
            let mut b = [0; 8];
            T::write_u64(&mut b, *v);
            buf.put_slice(&b)
        }
        Value::U128(v) => {
            let mut b = [0; 16];
            T::write_u128(&mut b, *v);
            buf.put_slice(&b);
        }
        _ => (),
    }
}
fn put_signed_value<T: ByteOrder>(value: &Value, buf: &mut BytesMut) {
    match value {
        Value::I8(v) => buf.put_i8(*v),
        Value::I16(v) => {
            let mut b = [0; 2];
            T::write_i16(&mut b, *v);
            buf.put_slice(&b)
        }
        Value::I32(v) => {
            let mut b = [0; 4];
            T::write_i32(&mut b, *v);
            buf.put_slice(&b)
        }
        Value::I64(v) => {
            let mut b = [0; 8];
            T::write_i64(&mut b, *v);
            buf.put_slice(&b)
        }
        Value::I128(v) => {
            let mut b = [0; 16];
            T::write_i128(&mut b, *v);
            buf.put_slice(&b);
        }
        v => warn!("not a valid signed value: {:?}", v),
    }
}

impl PayloadContent {
    pub fn arg_count(&self) -> u8 {
        match &self {
            PayloadContent::Verbose(args) => std::cmp::min(args.len() as u8, u8::max_value()),
            _ => 0,
        }
    }

    #[allow(dead_code)]
    pub(crate) fn is_verbose(&self) -> bool {
        matches!(self, PayloadContent::Verbose(_))
    }

    #[allow(dead_code)]
    fn is_non_verbose(&self) -> bool {
        matches!(self, PayloadContent::NonVerbose(_, _))
    }

    #[allow(dead_code)]
    fn is_control_request(&self) -> Option<bool> {
        match self {
            PayloadContent::ControlMsg(ControlType::Request, _) => Some(true),
            _ => None,
        }
    }

    pub(crate) fn as_bytes<T: ByteOrder>(&self) -> Vec<u8> {
        let mut buf = BytesMut::with_capacity(payload_content_len::<T>(&self));
        match &self {
            PayloadContent::Verbose(args) => {
                for arg in args {
                    let arg_bytes = &arg.as_bytes::<T>();
                    buf.extend_from_slice(arg_bytes);
                }
            }
            PayloadContent::NonVerbose(msg_id, payload) => {
                // trace!(
                //     "...Payload2::as_bytes, writing nonverbose, buf.len = {}",
                //     buf.len()
                // );

                let mut tmp_buf = [0; 4];
                T::write_u32(&mut tmp_buf, *msg_id);
                buf.extend_from_slice(&tmp_buf);

                buf.extend_from_slice(&payload[..]);
            }
            PayloadContent::ControlMsg(ctrl_id, payload) => {
                // trace!(
                //     "...Payload2::as_bytes, writing ControlType, buf.len = {}",
                //     buf.len()
                // );
                #[allow(deprecated)]
                buf.put_u8(ctrl_id.value());
                buf.extend_from_slice(&payload[..]);
            }
        }
        buf.to_vec()
    }
}

fn payload_content_len<T: ByteOrder>(content: &PayloadContent) -> usize {
    match content {
        PayloadContent::Verbose(args) => args.iter().fold(0usize, |mut sum, arg| {
            let old_len = arg.len_old::<T>();
            let new_len = arg.len_new();
            assert_eq!(old_len, new_len);
            sum += new_len;
            sum
        }),
        PayloadContent::NonVerbose(_id, payload) => 4usize + payload.len(),
        PayloadContent::ControlMsg(_id, payload) => 1usize + payload.len(),
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ExtendedHeaderConfig {
    pub message_type: MessageType,
    pub app_id: String,
    pub context_id: String,
}
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct MessageConfig {
    pub version: u8,
    pub counter: u8,
    pub endianness: Endianness,
    pub ecu_id: Option<String>,
    pub session_id: Option<u32>,
    pub timestamp: Option<u32>,
    pub payload: PayloadContent,
    pub extended_header_info: Option<ExtendedHeaderConfig>,
}

#[inline]
fn dbg_bytes_with_info(_name: &str, _bytes: &[u8], _info: Option<&str>) {
    // #[cfg(feature = "debug_parser")]
    {
        trace!(
            "writing {}: {} {:02X?} {}",
            _name,
            _bytes.len(),
            _bytes,
            _info.unwrap_or("")
        );
    }
}
#[inline]
fn dbg_bytes(_name: &str, _bytes: &[u8]) {
    dbg_bytes_with_info(_name, _bytes, None);
}
impl Message {
    pub fn new(conf: MessageConfig, storage_header: Option<StorageHeader>) -> Self {
        let payload_length = if conf.endianness == Endianness::Big {
            conf.payload.as_bytes::<BigEndian>().len()
        } else {
            conf.payload.as_bytes::<LittleEndian>().len()
        } as u16;
        Message {
            header: StandardHeader {
                version: conf.version,
                endianness: conf.endianness,
                message_counter: conf.counter,
                ecu_id: conf.ecu_id,
                session_id: conf.session_id,
                timestamp: conf.timestamp,
                has_extended_header: conf.extended_header_info.is_some(),
                payload_length,
            },
            extended_header: match conf.extended_header_info {
                Some(ext_info) => Some(ExtendedHeader {
                    verbose: conf.payload.is_verbose(),
                    argument_count: conf.payload.arg_count(),
                    message_type: ext_info.message_type,
                    application_id: ext_info.app_id,
                    context_id: ext_info.context_id,
                }),
                None => None,
            },
            payload: conf.payload,
            storage_header,
        }
    }

    pub fn as_bytes(self: &Message) -> Vec<u8> {
        let mut capacity = self.header.overall_length() as u64;
        let mut buf = if let Some(storage_header) = &self.storage_header {
            capacity += STORAGE_HEADER_LENGTH;
            let mut b = BytesMut::with_capacity(capacity as usize);
            b.extend_from_slice(&storage_header.as_bytes()[..]);
            b
        } else {
            BytesMut::with_capacity(capacity as usize)
        };
        dbg_bytes("header", &self.header.as_bytes());
        buf.extend_from_slice(&self.header.as_bytes());
        if let Some(ext_header) = &self.extended_header {
            let ext_header_bytes = ext_header.as_bytes();
            dbg_bytes("ext_header", &ext_header_bytes);
            buf.extend_from_slice(&ext_header_bytes);
        }
        if self.header.endianness == Endianness::Big {
            let big_endian_payload = self.payload.as_bytes::<BigEndian>();
            dbg_bytes("--> big endian payload", &big_endian_payload);
            buf.extend_from_slice(&big_endian_payload);
        } else {
            let little_endian_payload = self.payload.as_bytes::<LittleEndian>();
            dbg_bytes("--> little endian payload", &little_endian_payload);
            buf.extend_from_slice(&little_endian_payload);
        }

        buf.to_vec()
    }

    pub fn byte_len(&self) -> u16 {
        self.header.overall_length()
    }

    pub fn add_storage_header(mut self, time_stamp: Option<DltTimeStamp>) -> Self {
        let timestamp = match time_stamp {
            Some(ts) => ts,
            None => {
                use std::time::{SystemTime, UNIX_EPOCH};
                let now = SystemTime::now();
                let since_the_epoch = now
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_else(|_| std::time::Duration::from_secs(0));
                let in_ms = since_the_epoch.as_millis();
                DltTimeStamp::from_ms(in_ms as u64)
            }
        };
        let ecu_id = self
            .header
            .ecu_id
            .clone()
            .unwrap_or_else(|| DEFAULT_ECU_ID.into());
        self = Message {
            storage_header: Some(StorageHeader { timestamp, ecu_id }),
            ..self
        };
        self
    }
}

impl From<&LogLevel> for u8 {
    fn from(t: &LogLevel) -> Self {
        let mut res: u8 = 0;
        match t {
            LogLevel::Fatal => res |= 0x1 << 4,
            LogLevel::Error => res |= 0x2 << 4,
            LogLevel::Warn => res |= 0x3 << 4,
            LogLevel::Info => res |= 0x4 << 4,
            LogLevel::Debug => res |= 0x5 << 4,
            LogLevel::Verbose => res |= 0x6 << 4,
            LogLevel::Invalid(v) => res |= (v & 0b1111) << 4,
        }
        res
    }
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
            LogLevel::Invalid(_) => log::Level::Trace,
        }
    }
}

pub trait TryFrom<T>: Sized {
    /// The type returned in the event of a conversion error.
    type Error;

    /// Performs the conversion. optionally supply an index to identify the
    /// dlt message in a log or stream
    fn try_from(value: T) -> Result<Self, Self::Error>;
}

pub const DEFAULT_ECU_ID: &str = "ECU";
// StorageHeader
pub const STORAGE_HEADER_PATTERN_LENGTH: u64 = 4;
pub const STORAGE_HEADER_LENGTH: u64 = 16;

// Standard header
pub const WITH_EXTENDED_HEADER_FLAG: u8 = 1;
pub const BIG_ENDIAN_FLAG: u8 = 1 << 1;
pub const WITH_ECU_ID_FLAG: u8 = 1 << 2;
pub const WITH_SESSION_ID_FLAG: u8 = 1 << 3;
pub const WITH_TIMESTAMP_FLAG: u8 = 1 << 4;
pub const HEADER_MIN_LENGTH: u16 = 4;

// Verbose Mode

// Extended header
pub const VERBOSE_FLAG: u8 = 1;
pub const EXTENDED_HEADER_LENGTH: u16 = 10;

// Arguments
pub const TYPE_INFO_LENGTH: usize = 4;
pub const TYPE_INFO_BOOL_FLAG: u32 = 1 << 4;
pub const TYPE_INFO_SINT_FLAG: u32 = 1 << 5;
pub const TYPE_INFO_UINT_FLAG: u32 = 1 << 6;
pub const TYPE_INFO_FLOAT_FLAG: u32 = 1 << 7;
pub const _TYPE_INFO_ARRAY_FLAG: u32 = 1 << 8;
pub const TYPE_INFO_STRING_FLAG: u32 = 1 << 9;
pub const TYPE_INFO_RAW_FLAG: u32 = 1 << 10;
pub const TYPE_INFO_VARIABLE_INFO: u32 = 1 << 11;
pub const TYPE_INFO_FIXED_POINT_FLAG: u32 = 1 << 12;
pub const TYPE_INFO_TRACE_INFO_FLAG: u32 = 1 << 13;
#[allow(dead_code)]
pub const TYPE_INFO_STRUCT_FLAG: u32 = 1 << 14;

// TODO use header struct not u8
pub fn calculate_standard_header_length(header_type: u8) -> u16 {
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
    length
}

// TODO use header struct not u8
pub fn calculate_all_headers_length(header_type: u8) -> u16 {
    let mut length = calculate_standard_header_length(header_type);
    if (header_type & WITH_EXTENDED_HEADER_FLAG) != 0 {
        length += EXTENDED_HEADER_LENGTH;
    }
    length
}

pub fn zero_terminated_string(raw: &[u8]) -> Result<String, Error> {
    let nul_range_end = raw
        .iter()
        .position(|&c| c == b'\0')
        .unwrap_or_else(|| raw.len()); // default to length if no `\0` present
    str::from_utf8(&raw[0..nul_range_end])
        .map(|v| v.to_owned())
        .map_err(|e| {
            report_warning(format!("Invalid zero_terminated_string: {}", e));
            Error::new(io::ErrorKind::Other, e)
        })
}

pub const LEVEL_FATAL: u8 = 0x1;
pub const LEVEL_ERROR: u8 = 0x2;
pub const LEVEL_WARN: u8 = 0x3;
pub const LEVEL_INFO: u8 = 0x4;
pub const LEVEL_DEBUG: u8 = 0x5;
pub const LEVEL_VERBOSE: u8 = 0x6;

pub fn u8_to_log_level(v: u8) -> Option<LogLevel> {
    match v {
        LEVEL_FATAL => Some(LogLevel::Fatal),
        LEVEL_ERROR => Some(LogLevel::Error),
        LEVEL_WARN => Some(LogLevel::Warn),
        LEVEL_INFO => Some(LogLevel::Info),
        LEVEL_DEBUG => Some(LogLevel::Debug),
        LEVEL_VERBOSE => Some(LogLevel::Verbose),
        _ => None,
    }
}
impl TryFrom<u8> for LogLevel {
    type Error = Error;
    fn try_from(message_info: u8) -> Result<LogLevel, Error> {
        let raw = message_info >> 4;
        let level = u8_to_log_level(raw);
        match level {
            Some(n) => Ok(n),
            None => Ok(LogLevel::Invalid(raw)),
        }
    }
}

impl From<&ApplicationTraceType> for u8 {
    fn from(t: &ApplicationTraceType) -> Self {
        match t {
            ApplicationTraceType::Variable => 0x1 << 4,
            ApplicationTraceType::FunctionIn => 0x2 << 4,
            ApplicationTraceType::FunctionOut => 0x3 << 4,
            ApplicationTraceType::State => 0x4 << 4,
            ApplicationTraceType::Vfb => 0x5 << 4,
            ApplicationTraceType::Invalid(n) => n << 4,
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
            n => Ok(ApplicationTraceType::Invalid(n)),
        }
    }
}

impl From<&NetworkTraceType> for u8 {
    fn from(t: &NetworkTraceType) -> Self {
        match t {
            NetworkTraceType::Invalid => 0x0 << 4,
            NetworkTraceType::Ipc => 0x1 << 4,
            NetworkTraceType::Can => 0x2 << 4,
            NetworkTraceType::Flexray => 0x3 << 4,
            NetworkTraceType::Most => 0x4 << 4,
            NetworkTraceType::Ethernet => 0x5 << 4,
            NetworkTraceType::Someip => 0x6 << 4,
            NetworkTraceType::UserDefined(v) => v << 4,
        }
    }
}

impl TryFrom<u8> for NetworkTraceType {
    type Error = Error;
    fn try_from(message_info: u8) -> Result<NetworkTraceType, Error> {
        match message_info >> 4 {
            0 => Ok(NetworkTraceType::Invalid),
            1 => Ok(NetworkTraceType::Ipc),
            2 => Ok(NetworkTraceType::Can),
            3 => Ok(NetworkTraceType::Flexray),
            4 => Ok(NetworkTraceType::Most),
            5 => Ok(NetworkTraceType::Ethernet),
            6 => Ok(NetworkTraceType::Someip),
            n => Ok(NetworkTraceType::UserDefined(n)),
        }
    }
}

impl From<&ControlType> for u8 {
    fn from(t: &ControlType) -> Self {
        let mut res: u8 = 0;
        match t {
            ControlType::Request => res |= 0x1 << 4,
            ControlType::Response => res |= 0x2 << 4,
            ControlType::Unknown(n) => res |= n << 4,
        }
        res
    }
}
impl TryFrom<u8> for ControlType {
    type Error = Error;
    fn try_from(message_info: u8) -> Result<ControlType, Error> {
        match message_info >> 4 {
            1 => Ok(ControlType::Request),
            2 => Ok(ControlType::Response),
            n => Ok(ControlType::Unknown(n)),
        }
    }
}

impl From<&MessageType> for u8 {
    fn from(t: &MessageType) -> Self {
        match t {
            MessageType::Log(x) =>
            /* 0x0 << 1 |*/
            {
                u8::from(x)
            }
            MessageType::ApplicationTrace(x) => 0x1 << 1 | u8::from(x),
            MessageType::NetworkTrace(x) => 0x2 << 1 | u8::from(x),
            MessageType::Control(x) => 0x3 << 1 | u8::from(x),
            MessageType::Unknown((mstp, mtin)) => mstp << 1 | mtin << 4,
        }
    }
}
/// The Message Type is encoded in bit 1-3 of the MessageInfo
/// xxxx 321x
impl TryFrom<u8> for MessageType {
    type Error = Error;
    fn try_from(message_info: u8) -> Result<MessageType, Error> {
        match (message_info >> 1) & 0b111 {
            DLT_TYPE_LOG => Ok(MessageType::Log(LogLevel::try_from(message_info)?)),
            DLT_TYPE_APP_TRACE => Ok(MessageType::ApplicationTrace(
                ApplicationTraceType::try_from(message_info)?,
            )),
            DLT_TYPE_NW_TRACE => Ok(MessageType::NetworkTrace(NetworkTraceType::try_from(
                message_info,
            )?)),
            DLT_TYPE_CONTROL => Ok(MessageType::Control(ControlType::try_from(message_info)?)),
            v => Ok(MessageType::Unknown((v, (message_info >> 4) & 0b1111))),
        }
    }
}
