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

use bytes::{ByteOrder, BytesMut, BufMut};
use chrono::{NaiveDateTime};
use chrono::prelude::{Utc, DateTime};
use std::fmt;
use std::fmt::{Formatter};
use std::io;
use std::io::{Error};
use chrono::Datelike;
use chrono::Timelike;

use proptest_derive::Arbitrary;
use proptest::prelude::*;

use std::str;

#[derive(Debug, Clone, PartialEq, Arbitrary)]
pub struct DltTimeStamp {
    pub seconds: u32,
    #[proptest(strategy = "0..=1_000_000u32")]
    pub microseconds: u32,
}
impl fmt::Display for DltTimeStamp {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        let naive: Option<NaiveDateTime> =
            NaiveDateTime::from_timestamp_opt(i64::from(self.seconds), self.microseconds * 1000);
        match naive {
            Some(n) => {
                let datetime: DateTime<Utc> = DateTime::from_utc(n, Utc);
                write!(
                    f,
                    "{}/{}/{} {}:{}:{} {}",
                    datetime.year(),
                    datetime.month0(),
                    datetime.day0(),
                    datetime.hour(),
                    datetime.minute(),
                    datetime.second(),
                    datetime.timezone(),
                )
            }
            None => write!(
                f,
                "no valid timestamp for {}s/{}us",
                self.seconds, self.microseconds
            ),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Arbitrary)]
pub struct StorageHeader {
    pub timestamp: DltTimeStamp,
    #[proptest(strategy = "\"[a-zA-Z 0-9]{4}\"")]
    pub ecu_id: String,
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
        let mut buf = BytesMut::with_capacity(STORAGE_HEADER_LENGTH);
        buf.extend_from_slice(b"DLT");
        buf.put_u8(0x01);
        buf.put_u32_le(self.timestamp.seconds);
        buf.put_u32_le(self.timestamp.microseconds as u32);
        buf.put_zero_terminated_string(&self.ecu_id[..], 4);
        buf.to_vec()
    }
}
#[derive(Debug, Clone, PartialEq, Arbitrary)]
pub struct StandardHeader {
    pub has_extended_header: bool,
    #[proptest(strategy = "0..8u8")]
    pub version: u8,
    pub big_endian: bool,
    pub message_counter: u8,
    pub overall_length: u16,
    #[proptest(
        strategy = "\"[a-zA-Z]{2,5}\".prop_map(|v| if v.len() == 5 { None } else {Some(v)})"
    )]
    pub ecu_id: Option<String>,
    pub session_id: Option<u32>,
    pub timestamp: Option<u32>,
}

impl StandardHeader {
    pub fn header_type(self: &StandardHeader) -> u8 {
        let mut header_type = 0u8;
        if self.has_extended_header {
            header_type |= WITH_EXTENDED_HEADER_FLAG
        }
        if self.big_endian {
            header_type |= BIG_ENDIAN_FLAG
        }
        if self.ecu_id.is_some() {
            header_type |= WITH_ECU_ID_FLAG
        }
        if self.session_id.is_some() {
            header_type |= WITH_SESSION_ID_FLAG
        }
        if self.timestamp.is_some() {
            header_type |= WITH_TIMESTAMP_FLAG
        }
        header_type |= self.version << 5;
        header_type
    }

    #[allow(dead_code)]
    pub fn as_bytes(self: &StandardHeader) -> Vec<u8> {
        let header_type = self.header_type();
        let size = calculate_standard_header_length(header_type);
        let mut buf = BytesMut::with_capacity(size);
        buf.put_u8(header_type);
        buf.put_u8(self.message_counter);
        buf.put_u16_be(self.overall_length);
        if let Some(id) = &self.ecu_id {
            buf.put_zero_terminated_string(&id[..], 4);
        }
        if let Some(id) = &self.session_id {
            buf.put_u32_be(*id);
        }
        if let Some(time) = &self.timestamp {
            buf.put_u32_be(*time);
        }
        buf.to_vec()
    }
}

#[derive(Debug, PartialEq, PartialOrd, Clone, Copy, Arbitrary)]
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

#[derive(Debug, PartialEq, Clone, Arbitrary)]
pub enum ApplicationTraceType {
    Variable,
    FunctionIn,
    FunctionOut,
    State,
    Vfb,
}
impl fmt::Display for ApplicationTraceType {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        match self {
            ApplicationTraceType::Variable => f.write_str("VARIABLE"),
            ApplicationTraceType::FunctionIn => f.write_str("FUNC_IN"),
            ApplicationTraceType::FunctionOut => f.write_str("FUNC_OUT"),
            ApplicationTraceType::State => f.write_str("STATE"),
            ApplicationTraceType::Vfb => f.write_str("VFB"),
        }
    }
}

#[derive(Debug, PartialEq, Clone, Arbitrary)]
pub enum NetworkTraceType {
    Ipc,
    Can,
    Flexray,
    Most,
    Ethernet,
    Someip,
    #[proptest(strategy = "(7..15u8).prop_map(NetworkTraceType::UserDefined)")]
    UserDefined(u8),
}
impl fmt::Display for NetworkTraceType {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        match self {
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

#[derive(Debug, PartialEq, Clone, Arbitrary)]
pub enum ControlType {
    Request,
    Response,
}
impl fmt::Display for ControlType {
    fn fmt(&self, f: &mut Formatter) -> Result<(), fmt::Error> {
        match self {
            ControlType::Request => f.write_str("REQ"),
            ControlType::Response => f.write_str("RES"),
        }
    }
}

#[derive(Debug, PartialEq, Clone, Arbitrary)]
pub enum MessageType {
    Log(LogLevel),
    ApplicationTrace(ApplicationTraceType),
    NetworkTrace(NetworkTraceType),
    Control(ControlType),
    #[proptest(strategy = "((0b100u8..0b111u8),(0..0b1111u8)).prop_map(MessageType::Unknown)")]
    Unknown((u8, u8)),
}
pub const DLT_TYPE_LOG: u8 = 0b000;
pub const DLT_TYPE_APP_TRACE: u8 = 0b001;
pub const DLT_TYPE_NW_TRACE: u8 = 0b010;
pub const DLT_TYPE_CONTROL: u8 = 0b011;

#[derive(Debug, Clone, PartialEq, Arbitrary)]
pub struct ExtendedHeader {
    pub verbose: bool,
    pub argument_count: u8,
    pub message_type: MessageType,

    #[proptest(strategy = "\"[a-zA-Z]{1,3}\"")]
    pub application_id: String,
    #[proptest(strategy = "\"[a-zA-Z]{1,3}\"")]
    pub context_id: String,
}

impl ExtendedHeader {
    #[allow(dead_code)]
    pub fn as_bytes(self: &ExtendedHeader) -> Vec<u8> {
        let mut buf = BytesMut::with_capacity(EXTENDED_HEADER_LENGTH);
        buf.put_u8(u8::from(&self.message_type) | if self.verbose { 1 } else { 0 });
        buf.put_u8(self.argument_count);
        buf.put_zero_terminated_string(&self.application_id[..], 4);
        buf.put_zero_terminated_string(&self.context_id[..], 4);
        buf.to_vec()
    }
    pub fn skip_with_level(self: &ExtendedHeader, level: LogLevel) -> bool {
        match self.message_type {
            MessageType::Log(n) => level < n,
            _ => false,
        }
    }
}

/// Fixed-Point representation. only supports 32 bit and 64 bit values
/// according to the spec 128 bit are possible but we don't support it
#[derive(Debug, PartialEq, Clone, Arbitrary)]
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
#[derive(Debug, PartialEq, Clone)]
pub enum Value {
    Bool(bool),
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

#[derive(Debug, Clone, PartialEq, Arbitrary)]
pub enum StringCoding {
    ASCII,
    UTF8,
}
#[derive(Debug, Clone, PartialEq, Copy, Arbitrary)]
pub enum FloatWidth {
    Width32 = 32,
    Width64 = 64,
}

#[derive(Debug, Clone, PartialEq, Copy, Arbitrary)]
pub enum TypeLength {
    BitLength8 = 8,
    BitLength16 = 16,
    BitLength32 = 32,
    BitLength64 = 64,
    BitLength128 = 128,
}

// pub fn type_info_strategy() -> impl Strategy<Value = TypeInfo> {
//     any::<TypeInfoKind>()
//         .prop_flat_map(|kind|
//             (any::<StringCoding>(), any::<bool>(), Just())
//         )
// }

pub fn signed_strategy() -> impl Strategy<Value = TypeInfoKind> {
    (any::<TypeLength>(), any::<bool>()).prop_filter_map(
        "only permit fixed point for 32 and 64 bit",
        |(width, fp)| {
            if fp && !(width == TypeLength::BitLength32 || width == TypeLength::BitLength64) {
                None
            } else {
                Some(TypeInfoKind::Signed(width, fp))
            }
        },
    )
}
pub fn unsigned_strategy() -> impl Strategy<Value = TypeInfoKind> {
    (any::<TypeLength>(), any::<bool>()).prop_filter_map(
        "only permit fixed point for 32 and 64 bit",
        |(width, fp)| {
            if fp && !(width == TypeLength::BitLength32 || width == TypeLength::BitLength64) {
                None
            } else {
                Some(TypeInfoKind::Unsigned(width, fp))
            }
        },
    )
}
#[derive(Debug, Clone, PartialEq, Arbitrary)]
pub enum TypeInfoKind {
    Bool,
    #[proptest(strategy = "signed_strategy()")]
    Signed(TypeLength, bool), // FIXP
    #[proptest(strategy = "unsigned_strategy()")]
    Unsigned(TypeLength, bool), // FIXP
    Float(FloatWidth),
    // Array,
    StringType,
    Raw,
}

#[derive(Debug, Clone, PartialEq, Arbitrary)]
pub struct TypeInfo {
    pub kind: TypeInfoKind,
    pub coding: StringCoding,
    pub has_variable_info: bool,
    pub has_trace_info: bool,
    // TraceInfo,
    // TypeStruct,
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
            TypeInfoKind::Signed(v, _) => v as usize,
            TypeInfoKind::Unsigned(v, _) => v as usize,
            TypeInfoKind::Float(v) => v as usize,
            _ => 0,
        }
    }
    pub fn is_fixed_point(self: &TypeInfo) -> bool {
        match self.kind {
            TypeInfoKind::Signed(_, fp) => fp,
            TypeInfoKind::Unsigned(_, fp) => fp,
            _ => false,
        }
    }
    pub fn as_bytes<T: ByteOrder>(self: &TypeInfo) -> Vec<u8> {
        let mut info: u32 = 0;
        // encode length
        println!("TypeInfo::as_bytes, {:?}", self);
        match self.kind {
            TypeInfoKind::Float(len) => info |= TypeInfo::type_length_bits_float(len),
            TypeInfoKind::Signed(len, _) => info |= TypeInfo::type_length_bits(len),
            TypeInfoKind::Unsigned(len, _) => info |= TypeInfo::type_length_bits(len),
            TypeInfoKind::Bool => info |= TypeInfo::type_length_bits(TypeLength::BitLength8),
            _ => (),
        }
        match self.kind {
            TypeInfoKind::Bool => info |= TYPE_INFO_BOOL_FLAG,
            TypeInfoKind::Signed(_, _) => info |= TYPE_INFO_SINT_FLAG,
            TypeInfoKind::Unsigned(_, _) => info |= TYPE_INFO_UINT_FLAG,
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
        }

        let mut buf = BytesMut::with_capacity(4);
        let mut b = [0; 4];
        T::write_u32(&mut b, info);
        buf.put_slice(&b);
        // println!("TypeInfo::as_bytes {:?} => {:#b} {:02X?}", self, info, buf);
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
            0b000_0010 => Ok(TypeInfoKind::Signed(type_len(info)?, is_fixed_point)),
            0b000_0100 => Ok(TypeInfoKind::Unsigned(type_len(info)?, is_fixed_point)),
            0b000_1000 => Ok(TypeInfoKind::Float(type_len_float(info)?)),
            // 0b001_0000 => Ok(TypeInfoKind::Array),
            0b010_0000 => Ok(TypeInfoKind::StringType),
            0b100_0000 => Ok(TypeInfoKind::Raw),
            v => {
                eprintln!("Unknown TypeInfoKind in TypeInfo {:b}", v);
                Err(Error::new(
                    io::ErrorKind::Other,
                    format!("Unknown TypeInfoKind in TypeInfo {:b}", v),
                ))
            }
        }?;
        let coding = match (info >> 15) & 0b111 {
            0x00 => (StringCoding::ASCII),
            0x01 => (StringCoding::UTF8),
            _ => {
                // Unknown coding in TypeInfo, assume UTF8
                (StringCoding::UTF8)
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
#[derive(Debug, Clone, PartialEq, Arbitrary)]
pub struct FixedPoint {
    pub quantization: f32,
    pub offset: FixedPointValue,
}
fn my_enum_strategy() -> impl Strategy<Value = Value> {
    prop_oneof![
        any::<bool>().prop_map(Value::Bool),
        any::<u32>().prop_map(Value::U32),
    ]
}
#[derive(Debug, Clone, PartialEq, Arbitrary)]
pub struct Argument {
    pub type_info: TypeInfo,
    pub name: Option<String>,
    pub unit: Option<String>,
    pub fixed_point: Option<FixedPoint>,
    // #[proptest(strategy = "Just(Value::U8(22))")]
    #[proptest(strategy = "my_enum_strategy()")]
    pub value: Value,
}
impl Argument {
    #[allow(dead_code)]
    pub fn as_bytes<T: ByteOrder>(self: &Argument) -> Vec<u8> {
        fn mut_buf_with_typeinfo_name_unit<T: ByteOrder>(
            info: &TypeInfo,
            name: &Option<String>,
            unit: &Option<String>,
            fixed_point: &Option<FixedPoint>,
        ) -> BytesMut {
            let mut capacity = TYPE_INFO_LENGTH;
            if let Some(n) = name {
                capacity += 2 /* length name */ + n.len() + 1;
            }
            if let Some(u) = unit {
                capacity += 2 /* length unit */ + u.len() + 1;
            }
            if let Some(fp) = fixed_point {
                capacity += 4 /* quantization */ + fixed_point_value_width(&fp.offset);
            }
            capacity += info.type_width();
            let mut buf = BytesMut::with_capacity(capacity);
            buf.extend_from_slice(&info.as_bytes::<T>()[..]);
            if let Some(n) = name {
                #[allow(deprecated)]
                buf.put_u16::<T>(n.len() as u16 + 1);
            }
            if let Some(u) = unit {
                #[allow(deprecated)]
                buf.put_u16::<T>(u.len() as u16 + 1)
            }
            if let Some(n) = name {
                buf.extend_from_slice(n.as_bytes());
                buf.put_u8(0x0); // null termination
            }
            if let Some(u) = unit {
                buf.extend_from_slice(u.as_bytes());
                buf.put_u8(0x0); // null termination
            }
            if let Some(fp) = fixed_point {
                println!("as_bytes fixed point: {:?}", fp);
                println!(
                    "as_bytes, quantization f32: \t{:02X?}...add quantization: {:?}",
                    buf.to_vec(),
                    fp.quantization
                );
                #[allow(deprecated)]
                buf.put_f32::<T>(fp.quantization);
                println!(
                    "as_bytes, quantization f32: \t{:02X?}...add offset: {:?}",
                    buf.to_vec(),
                    fp.offset
                );
                match fp.offset {
                    FixedPointValue::I32(v) => {
                        #[allow(deprecated)]
                        buf.put_i32::<T>(v);
                        println!("as_bytes, after put i32: \t{:02X?}", buf.to_vec());
                    }
                    FixedPointValue::I64(v) => {
                        #[allow(deprecated)]
                        buf.put_i64::<T>(v);
                        println!("as_bytes, after put i64: \t{:02X?}", buf.to_vec());
                    }
                }
            }
            buf
        }
        match self.type_info.kind {
            TypeInfoKind::Bool => {
                let mut buf = mut_buf_with_typeinfo_name_unit::<T>(
                    &self.type_info,
                    &self.name,
                    &self.unit,
                    &None,
                );
                buf.put_u8(if self.value == Value::Bool(true) {
                    0x1
                } else {
                    0x0
                });
                buf.to_vec()
            }
            TypeInfoKind::Signed(_, _) => {
                fn write_value<T: ByteOrder>(value: &Value, buf: &mut BytesMut) {
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
                        _ => (),
                    }
                }
                let mut buf = mut_buf_with_typeinfo_name_unit::<T>(
                    &self.type_info,
                    &self.name,
                    &self.unit,
                    &self.fixed_point,
                );
                write_value::<T>(&self.value, &mut buf);
                buf.to_vec()
            }
            TypeInfoKind::Unsigned(_, _) => {
                let mut buf = mut_buf_with_typeinfo_name_unit::<T>(
                    &self.type_info,
                    &self.name,
                    &self.unit,
                    &self.fixed_point,
                );
                match self.value {
                    Value::U8(v) => buf.put_u8(v),
                    Value::U16(v) => {
                        let mut b = [0; 2];
                        T::write_u16(&mut b, v);
                        buf.put_slice(&b)
                    }
                    Value::U32(v) => {
                        let mut b = [0; 4];
                        T::write_u32(&mut b, v);
                        buf.put_slice(&b)
                    }
                    Value::U64(v) => {
                        let mut b = [0; 8];
                        T::write_u64(&mut b, v);
                        buf.put_slice(&b)
                    }
                    Value::U128(v) => {
                        let mut b = [0; 16];
                        T::write_u128(&mut b, v);
                        buf.put_slice(&b);
                    }
                    _ => (),
                }
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
                let mut buf = mut_buf_with_typeinfo_name_unit::<T>(
                    &self.type_info,
                    &self.name,
                    &self.unit,
                    &self.fixed_point,
                );
                write_value::<T>(&self.value, &mut buf);
                buf.to_vec()
            }
            // TypeInfoKind::Array => {
            //     // TODO dlt array type not yet implemented NYI
            //     eprintln!("found dlt array type...not yet supported");
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
                                #[allow(deprecated)]
                                buf.put_u16::<T>(s.len() as u16 + 1);
                                #[allow(deprecated)]
                                buf.put_u16::<T>(name_len_with_termination);
                                buf.extend_from_slice(var_name.as_bytes());
                                buf.put_u8(0x0); // null termination
                                buf.extend_from_slice(s.as_bytes());
                                buf.put_u8(0x0); // null termination
                                buf.to_vec()
                            }
                            _ => {
                                eprintln!("found invalid dlt entry ({:?}", self);
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
                                #[allow(deprecated)]
                                buf.put_u16::<T>(s.len() as u16 + 1);
                                buf.extend_from_slice(s.as_bytes());
                                buf.put_u8(0x0); // null termination
                                buf.to_vec()
                            }
                            _ => {
                                eprintln!("found invalid dlt entry ({:?}", self);
                                BytesMut::with_capacity(0).to_vec()
                            }
                        }
                    }
                    _ => {
                        eprintln!("found invalid dlt entry ({:?}", self);
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
                                #[allow(deprecated)]
                                buf.put_u16::<T>(bytes.len() as u16);
                                #[allow(deprecated)]
                                buf.put_u16::<T>(name_len_with_termination);
                                buf.extend_from_slice(var_name.as_bytes());
                                buf.put_u8(0x0); // null termination
                                buf.extend_from_slice(bytes);
                                buf.to_vec()
                            }
                            _ => {
                                eprintln!("found invalid dlt entry ({:?}", self);
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
                                #[allow(deprecated)]
                                buf.put_u16::<T>(bytes.len() as u16);
                                buf.extend_from_slice(bytes);
                                buf.to_vec()
                            }
                            _ => {
                                eprintln!("found invalid dlt entry ({:?}", self);
                                BytesMut::with_capacity(0).to_vec()
                            }
                        }
                    }
                    _ => {
                        eprintln!("found invalid dlt entry ({:?}", self);
                        BytesMut::with_capacity(0).to_vec()
                    }
                }
            }
        }
    }
}

#[derive(Debug, Clone, PartialEq, Arbitrary)]
pub enum Payload {
    Verbose(Vec<Argument>),
    #[proptest(
        strategy = "(0..10u32, prop::collection::vec(any::<u8>(), 0..20)).prop_map(|(a, b)| Payload::NonVerbose(a,b))"
    )]
    NonVerbose(u32, Vec<u8>),
}
impl Payload {
    #[allow(dead_code)]
    fn as_bytes<T: ByteOrder>(self: &Payload) -> Vec<u8> {
        let mut buf = BytesMut::with_capacity(STORAGE_HEADER_LENGTH);
        match self {
            Payload::Verbose(args) => {
                for arg in args {
                    buf.extend_from_slice(&arg.as_bytes::<T>());
                }
            }
            Payload::NonVerbose(msg_id, payload) => {
                #[allow(deprecated)]
                buf.put_u32::<T>(*msg_id);
                buf.extend_from_slice(payload);
            }
        }
        buf.to_vec()
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Message {
    pub storage_header: Option<StorageHeader>,
    pub header: StandardHeader,
    pub extended_header: Option<ExtendedHeader>,
    pub payload: Payload,
}
pub const DLT_COLUMN_SENTINAL: char = '\u{0004}';
pub const DLT_ARGUMENT_SENTINAL: char = '\u{0005}';
pub const DLT_NEWLINE_SENTINAL_SLICE: &[u8] = &[0x6];

lazy_static! {
    static ref DLT_NEWLINE_SENTINAL_STR: &'static str =
        unsafe { str::from_utf8_unchecked(DLT_NEWLINE_SENTINAL_SLICE) };
}

/// will format dlt Message with those fields:
/// EColumn.DATETIME,
/// EColumn.ECUID,
/// EColumn.VERS,
/// EColumn.SID,
/// EColumn.MCNT,
/// EColumn.TMS,
/// EColumn.EID,
/// EColumn.APID,
/// EColumn.CTID,
/// EColumn.MSTP,
/// EColumn.PAYLOAD,
impl fmt::Display for Message {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match &self.storage_header {
            Some(h) => {
                write!(f, "{}", h)?;
            }
            None => (),
        }
        write!(
            f,
            "{}{}{}",
            DLT_COLUMN_SENTINAL, self.header.version, DLT_COLUMN_SENTINAL,
        )?;
        match &self.header.session_id {
            Some(id) => {
                write!(f, "{}", id)?;
            }
            None => (),
        }
        write!(
            f,
            "{}{}{}",
            DLT_COLUMN_SENTINAL, self.header.message_counter, DLT_COLUMN_SENTINAL,
        )?;
        match &self.header.timestamp {
            Some(t) => {
                write!(f, "{}", t)?;
            }
            None => (),
        }
        write!(f, "{}", DLT_COLUMN_SENTINAL,)?;
        match &self.header.ecu_id {
            Some(id) => {
                write!(f, "{}", id)?;
            }
            None => (),
        }
        write!(f, "{}", DLT_COLUMN_SENTINAL,)?;

        if let Some(ext) = self.extended_header.as_ref() {
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
        match &self.payload {
            Payload::Verbose(arguments) => arguments
                .iter()
                .try_for_each(|arg| write!(f, "{}{}", DLT_ARGUMENT_SENTINAL, arg)),
            Payload::NonVerbose(id, data) => {
                let as_string = str::from_utf8(&data).unwrap_or("").trim();
                f.write_str(&format!("[non-verbose, id:{}]({:?})|{:02X?}", id, as_string, data)[..])
            }
        }
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
        self.value.fmt(f)?;

        Ok(())
    }
}

pub trait TryFrom<T>: Sized {
    /// The type returned in the event of a conversion error.
    type Error;

    /// Performs the conversion.
    fn try_from(value: T) -> Result<Self, Self::Error>;
}

// StorageHeader
pub const STORAGE_HEADER_PATTERN_LENGTH: usize = 4;
pub const STORAGE_HEADER_LENGTH: usize = 16;

// Standard header
pub const WITH_EXTENDED_HEADER_FLAG: u8 = 1;
pub const BIG_ENDIAN_FLAG: u8 = 1 << 1;
pub const WITH_ECU_ID_FLAG: u8 = 1 << 2;
pub const WITH_SESSION_ID_FLAG: u8 = 1 << 3;
pub const WITH_TIMESTAMP_FLAG: u8 = 1 << 4;
pub const HEADER_MIN_LENGTH: usize = 4;

// Verbose Mode

// Extended header
pub const VERBOSE_FLAG: u8 = 1;
pub const EXTENDED_HEADER_LENGTH: usize = 10;

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

pub fn calculate_standard_header_length(header_type: u8) -> usize {
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

pub fn calculate_all_headers_length(header_type: u8) -> usize {
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
            eprintln!("Invalid zero_terminated_string: {}", e);
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
            None => {
                eprintln!(
                    "unexpected LogLevel: {} in message info {:b}",
                    raw, message_info
                );
                Ok(LogLevel::Invalid(raw))
            }
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
            _ => {
                eprintln!("Invalid ApplicationTraceType");
                Err(Error::new(
                    io::ErrorKind::Other,
                    format!("Unknown application trace type {}", message_info >> 4),
                ))
            }
        }
    }
}

impl From<&NetworkTraceType> for u8 {
    fn from(t: &NetworkTraceType) -> Self {
        match t {
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
            0 => {
                eprintln!("Unknown network trace type 0");
                Err(Error::new(
                    io::ErrorKind::Other,
                    "Unknown network trace type 0",
                ))
            }
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

impl From<&ControlType> for u8 {
    fn from(t: &ControlType) -> Self {
        let mut res: u8 = 0;
        match t {
            ControlType::Request => res |= 0x1 << 4,
            ControlType::Response => res |= 0x2 << 4,
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
            _ => {
                eprintln!("Unknown control type {}", message_info >> 4);
                Err(Error::new(
                    io::ErrorKind::Other,
                    format!("Unknown control type {}", message_info >> 4),
                ))
            }
        }
    }
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
            v => {
                eprintln!(
                    "Unknown MSTP in Message Info (MSIN) {}",
                    (message_info >> 1) & 0b111
                );
                Ok(MessageType::Unknown((v, (message_info >> 4) & 0b1111)))
                // Err(Error::new(
                //     io::ErrorKind::Other,
                //     format!("Unknown MSTP in Message Info (MSIN) {}", (message_info >> 1) & 0b111),
                // ))
            }
        }
    }
}

#[allow(dead_code)]
#[inline]
pub fn create_message_line(
    out_buffer: &mut dyn std::io::Write,
    msg: Message,
) -> std::io::Result<()> {
    // Messages without extended header (non-verbose) are unimplemented
    if let Some(ext) = msg.extended_header {
        let _level = match ext.message_type {
            MessageType::Log(level) => level.into(),
            MessageType::ApplicationTrace(_) | MessageType::NetworkTrace(_) => log::Level::Trace,
            // Ignore everything else
            _ => return Ok(()),
        };

        // dest.reserve(1024); // TODO reserve correct amount
        // Format message: Join arguments as strings
        if let Payload::Verbose(arguments) = msg.payload {
            // Format tag by concatenating ecu_id, application_id and context_id
            write!(
                out_buffer,
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
            .map_err(|e| Error::new(io::ErrorKind::Other, e))?;

            // Format payload
            arguments
                .iter()
                .try_for_each(|arg| write!(out_buffer, " {}", arg))
                .map_err(|e| {
                    eprintln!("error iterating over messages: {}", e);
                    Error::new(io::ErrorKind::Other, e)
                })?;
        }
        writeln!(out_buffer).map_err(|e| Error::new(io::ErrorKind::Other, e))
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use pretty_assertions::assert_eq;
    use byteorder::{BigEndian, LittleEndian};

    proptest! {
        #[test]
        fn convert_type_info_to_bytes_doesnt_crash(type_info: TypeInfo) {
            let _ = type_info.as_bytes::<BigEndian>();
        }
    }

    #[test]
    fn test_convert_header_to_bytes() {
        let header: StandardHeader = StandardHeader {
            version: 1,
            has_extended_header: true,
            big_endian: true,
            message_counter: 0x33,
            overall_length: 0x1,
            ecu_id: Some("abc".to_string()),
            session_id: None,
            timestamp: Some(5),
        };
        assert_eq!(
            vec![
                0x37, // header-type
                0x33, // message-counter
                0x0, 0x1, // overall length
                0x61, 0x62, 0x63, 0x0, // ecu id "abc"
                0x0, 0x0, 0x0, 0x5, // timestamp
            ],
            header.as_bytes()
        );
    }
    #[test]
    fn test_filter_out_non_relevant_ext_headers() {
        let extended_header = ExtendedHeader {
            argument_count: 1,
            verbose: true,
            message_type: MessageType::Log(LogLevel::Debug),
            application_id: "abc".to_string(),
            context_id: "CON".to_string(),
        };
        assert!(!extended_header.skip_with_level(LogLevel::Verbose));
        assert!(!extended_header.skip_with_level(LogLevel::Debug));
        assert!(extended_header.skip_with_level(LogLevel::Info));
        assert!(extended_header.skip_with_level(LogLevel::Warn));
        assert!(extended_header.skip_with_level(LogLevel::Error));
        assert!(extended_header.skip_with_level(LogLevel::Fatal));
        let extended_header = ExtendedHeader {
            argument_count: 1,
            verbose: true,
            message_type: MessageType::Control(ControlType::Request),
            application_id: "abc".to_string(),
            context_id: "CON".to_string(),
        };
        // other message types should not be fitered
        assert!(!extended_header.skip_with_level(LogLevel::Fatal));
    }
    #[test]
    fn test_convert_extended_header_to_bytes() {
        let extended_header = ExtendedHeader {
            argument_count: 2,
            verbose: true,
            message_type: MessageType::Log(LogLevel::Warn),
            application_id: "abc".to_string(),
            context_id: "CON".to_string(),
        };
        assert_eq!(
            vec![
                0b0011_0001, // message info MSIN
                0x2,         // arg-count
                0x61,
                0x62,
                0x63,
                0x0, // app id
                0x43,
                0x4F,
                0x4E,
                0x0, // context id
            ],
            extended_header.as_bytes()
        );
    }
    #[test]
    fn test_convert_storage_header_to_bytes() {
        let timestamp = DltTimeStamp {
            seconds: 0x4DC9_2C26,
            microseconds: 0x000C_A2D8,
        };
        let storage_header = StorageHeader {
            timestamp,
            ecu_id: "abc".to_string(),
        };
        assert_eq!(
            vec![
                0x44, 0x4C, 0x54, 0x01, // dlt tag
                0x26, 0x2C, 0xC9, 0x4D, // timestamp seconds
                0xD8, 0xA2, 0x0C, 0x0, // timestamp microseconds
                0x61, 0x62, 0x63, 0x0, // ecu id "abc"
            ],
            storage_header.as_bytes()
        );
    }
    #[test]
    fn test_convert_typeinfo_to_bytes() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::Bool,
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let type_info2 = TypeInfo {
            kind: TypeInfoKind::Unsigned(TypeLength::BitLength32, true),
            coding: StringCoding::ASCII,
            has_variable_info: false,
            has_trace_info: false,
        };
        let type_info3 = TypeInfo {
            kind: TypeInfoKind::StringType,
            coding: StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        //                                                        vvvv..type lenght
        // type array .....................................v      ||||
        // type string ...................................v|      ||||
        // type raw .....................................v||      ||||
        // variable info................................v|||      ||||
        //0b 1000 0100 0101
        let expected1: u32 = 0b0000_0000_0000_0000_1000_1000_0001_0001;
        let expected2: u32 = 0b0000_0000_0000_0000_0001_0000_0100_0011;
        let expected3: u32 = 0b0000_0000_0000_0000_1000_0010_0000_0000;
        // string coding .......................^^.^|||      ||||
        // type struct .............................^||      ||||
        // trace info ...............................^|      ||||
        // fixed point ...............................^      ||||
        //                                         float.....^|||
        //                                         unsigned...^||
        //                                         signed......^|
        //                                         bool.........^
        println!("expected: {:#b}", expected2);
        println!(
            "got     : {:#b}",
            BigEndian::read_u32(&type_info2.as_bytes::<BigEndian>()[..])
        );
        assert_eq!(
            expected1,
            BigEndian::read_u32(&type_info.as_bytes::<BigEndian>()[..])
        );
        assert_eq!(
            expected1,
            LittleEndian::read_u32(&type_info.as_bytes::<LittleEndian>()[..])
        );
        assert_eq!(
            expected2,
            BigEndian::read_u32(&type_info2.as_bytes::<BigEndian>()[..])
        );
        assert_eq!(
            expected2,
            LittleEndian::read_u32(&type_info2.as_bytes::<LittleEndian>()[..])
        );
        assert_eq!(
            expected3,
            BigEndian::read_u32(&type_info3.as_bytes::<BigEndian>()[..])
        );
        assert_eq!(
            expected3,
            LittleEndian::read_u32(&type_info3.as_bytes::<LittleEndian>()[..])
        );
    }
    #[test]
    fn test_convert_bool_argument_to_bytes() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::Bool,
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let argument = Argument {
            type_info: type_info.clone(),
            name: Some("foo".to_string()),
            unit: None,
            fixed_point: None,
            value: Value::Bool(true),
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        expected.extend(vec![0x0, 0x4]); // length of name + zero
        expected.extend(b"foo\0");
        expected.extend(vec![0x1]); // value for bool (true == 1)
        assert_eq!(expected, argument.as_bytes::<BigEndian>());

        // now without variable info
        let type_info2 = TypeInfo {
            kind: TypeInfoKind::Bool,
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let mut expected2 = type_info2.as_bytes::<BigEndian>();
        let argument2 = Argument {
            type_info: type_info2,
            name: None,
            unit: None,
            fixed_point: None,
            value: Value::Bool(true),
        };
        expected2.extend(vec![0x1]); // value for bool (true == 1)
        assert_eq!(expected2, argument2.as_bytes::<BigEndian>());
    }
    #[test]
    fn test_convert_uint_argument_to_bytes() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::Unsigned(TypeLength::BitLength32, false),
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: Some("speed".to_string()),
            unit: Some("mph".to_string()),
            fixed_point: None,
            value: Value::U32(0x33),
        };
        expected.extend(vec![0x0, 0x6]); // length of name + zero
        expected.extend(vec![0x0, 0x4]); // length of unit + zero
        expected.extend(b"speed\0");
        expected.extend(b"mph\0");
        let mut buf = [0; 4];
        BigEndian::write_u32(&mut buf, 0x33);
        expected.extend(&buf); // value
        assert_eq!(expected, argument.as_bytes::<BigEndian>());

        // now without variable info
        let type_info = TypeInfo {
            kind: TypeInfoKind::Unsigned(TypeLength::BitLength32, false),
            coding: StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: None,
            unit: None,
            fixed_point: None,
            value: Value::U32(0x33),
        };
        let mut buf = [0; 4];
        BigEndian::write_u32(&mut buf, 0x33);
        expected.extend(&buf); // value
        assert_eq!(expected, argument.as_bytes::<BigEndian>());
    }

    #[test]
    fn test_convert_sint_argument_to_bytes() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::Signed(TypeLength::BitLength32, false),
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: Some("speed".to_string()),
            unit: Some("mph".to_string()),
            fixed_point: None,
            value: Value::I32(-0x33),
        };
        expected.extend(vec![0x0, 0x6]); // length of name + zero
        expected.extend(vec![0x0, 0x4]); // length of unit + zero
        expected.extend(b"speed\0");
        expected.extend(b"mph\0");
        let mut buf = [0; 4];
        BigEndian::write_i32(&mut buf, -0x33);
        expected.extend(&buf); // value
        assert_eq!(expected, argument.as_bytes::<BigEndian>());

        // now without variable info
        let type_info = TypeInfo {
            kind: TypeInfoKind::Signed(TypeLength::BitLength32, false),
            coding: StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: None,
            unit: None,
            fixed_point: None,
            value: Value::I32(-0x33),
        };
        let mut buf = [0; 4];
        BigEndian::write_i32(&mut buf, -0x33);
        expected.extend(&buf); // value
        assert_eq!(expected, argument.as_bytes::<BigEndian>());
    }

    #[test]
    fn test_convert_float_argument_to_bytes() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::Float(FloatWidth::Width32),
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: Some("speed".to_string()),
            unit: Some("mph".to_string()),
            fixed_point: None,
            value: Value::F32(123.98f32),
        };
        expected.extend(vec![0x0, 0x6]); // length of name + zero
        expected.extend(vec![0x0, 0x4]); // length of unit + zero
        expected.extend(b"speed\0");
        expected.extend(b"mph\0");
        let mut buf = [0; 4];
        BigEndian::write_f32(&mut buf, 123.98f32);
        expected.extend(&buf); // value
        assert_eq!(expected, argument.as_bytes::<BigEndian>());

        // now without variable info
        let type_info = TypeInfo {
            kind: TypeInfoKind::Float(FloatWidth::Width64),
            coding: StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: None,
            unit: None,
            fixed_point: None,
            value: Value::F64(123.98f64),
        };
        let mut buf = [0; 8];
        BigEndian::write_f64(&mut buf, 123.98f64);
        expected.extend(&buf); // value
        assert_eq!(expected, argument.as_bytes::<BigEndian>());
    }
    #[test]
    fn test_convert_string_argument_to_bytes() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::StringType,
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: Some("speed".to_string()),
            unit: None,
            fixed_point: None,
            value: Value::StringVal("foo".to_string()),
        };
        expected.extend(vec![0x0, 0x4]); // length of value + zero
        expected.extend(vec![0x0, 0x6]); // length of name + zero
        expected.extend(b"speed\0"); // name
        expected.extend(b"foo\0"); // value
        assert_eq!(expected, argument.as_bytes::<BigEndian>());

        // now without variable info
        let type_info = TypeInfo {
            kind: TypeInfoKind::StringType,
            coding: StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: None,
            unit: None,
            fixed_point: None,
            value: Value::StringVal("foo".to_string()),
        };
        expected.extend(vec![0x0, 0x4]); // length of value + zero
        expected.extend(b"foo\0"); // value
        let argument_bytes = argument.as_bytes::<BigEndian>();
        println!("{:02X?}", argument_bytes);
        assert_eq!(expected, argument_bytes);
    }
    #[test]
    fn test_convert_fixedpoint_argument_to_bytes() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::Signed(TypeLength::BitLength32, true),
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: Some("speed".to_string()),
            unit: Some("mph".to_string()),
            value: Value::I32(-44),
            fixed_point: Some(FixedPoint {
                quantization: 1.5,
                offset: FixedPointValue::I32(-200),
            }),
        };
        expected.extend(vec![0x0, 0x6]); // length of name + zero
        expected.extend(vec![0x0, 0x4]); // length of unit + zero
        expected.extend(b"speed\0");
        expected.extend(b"mph\0");
        let mut buf = [0; 4];
        BigEndian::write_f32(&mut buf, 1.5f32);
        expected.extend(&buf); // value
        BigEndian::write_i32(&mut buf, -200);
        expected.extend(&buf); // value
        BigEndian::write_i32(&mut buf, -44);
        expected.extend(&buf); // value
        assert_eq!(expected, argument.as_bytes::<BigEndian>());

        // now without variable info
        let type_info = TypeInfo {
            kind: TypeInfoKind::Signed(TypeLength::BitLength32, true),
            coding: StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: None,
            unit: None,
            value: Value::I32(-44),
            fixed_point: Some(FixedPoint {
                quantization: 1.5,
                offset: FixedPointValue::I32(-200),
            }),
        };
        let mut buf = [0; 4];
        BigEndian::write_f32(&mut buf, 1.5f32);
        expected.extend(&buf); // value
        BigEndian::write_i32(&mut buf, -200);
        expected.extend(&buf); // value
        BigEndian::write_i32(&mut buf, -44);
        expected.extend(&buf); // value
        assert_eq!(expected, argument.as_bytes::<BigEndian>());
    }
    #[test]
    fn test_convert_raw_argument_to_bytes() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::Raw,
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: Some("foo".to_string()),
            unit: None,
            value: Value::Raw(vec![0xD, 0xE, 0xA, 0xD]),
            fixed_point: Some(FixedPoint {
                quantization: 1.5,
                offset: FixedPointValue::I32(-200),
            }),
        };
        expected.extend(vec![0x0, 0x4]); // length of raw data bytes
        expected.extend(vec![0x0, 0x4]); // length of name + zero
        expected.extend(b"foo\0");
        expected.extend(vec![0xD, 0xE, 0xA, 0xD]);
        assert_eq!(expected, argument.as_bytes::<BigEndian>());

        // now without variable info
        let type_info = TypeInfo {
            kind: TypeInfoKind::Raw,
            coding: StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: None,
            unit: None,
            value: Value::Raw(vec![0xD, 0xE, 0xA, 0xD]),
            fixed_point: Some(FixedPoint {
                quantization: 1.5,
                offset: FixedPointValue::I32(-200),
            }),
        };
        expected.extend(vec![0x0, 0x4]); // length of raw data bytes
        expected.extend(vec![0xD, 0xE, 0xA, 0xD]);
        assert_eq!(expected, argument.as_bytes::<BigEndian>());
    }
}
