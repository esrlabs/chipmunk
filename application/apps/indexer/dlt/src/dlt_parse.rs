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
use crate::{dlt::*, filtering};
use crossbeam_channel as cc;
use indexer_base::{chunks::ChunkResults, error_reporter::*, progress::*, utils};
use serde::Serialize;

use buf_redux::{policy::MinBuffered, BufReader as ReduxReader};
use byteorder::{BigEndian, LittleEndian};
use nom::{
    bytes::streaming::{tag, take, take_while_m_n},
    combinator::map,
    multi::count,
    number::streaming,
    sequence::tuple,
    IResult,
};
use rustc_hash::FxHashMap;
use std::{
    fs,
    io::{BufRead, Read},
};
use thiserror::Error;

use std::str;

const STOP_CHECK_LINE_THRESHOLD: usize = 250_000;
pub(crate) const DLT_READER_CAPACITY: usize = 10 * 1024 * 1024;
pub(crate) const DLT_MIN_BUFFER_SPACE: usize = 10 * 1024;
pub(crate) const DLT_PATTERN_SIZE: usize = 4;
pub(crate) const DLT_PATTERN: &[u8] = &[0x44, 0x4C, 0x54, 0x01];

pub(crate) fn parse_ecu_id(input: &[u8]) -> IResult<&[u8], &str> {
    dlt_zero_terminated_string(input, 4)
}
/// skip ahead in input array till we reach a storage header
/// return Some(dropped, rest_slice) that starts with the next storage header (if any)
/// or None if no more storage header could be found.
/// dropped is the number of bytes that were skipped
/// note: we won't skip anything if the input already begins
/// with a storage header
pub(crate) fn forward_to_next_storage_header(input: &[u8]) -> Option<(u64, &[u8])> {
    let mut found = false;
    let mut to_drop = 0usize;
    for v in input.windows(DLT_PATTERN_SIZE) {
        if v == DLT_PATTERN {
            found = true;
            break;
        }
        to_drop += 1;
    }

    if !found {
        debug!(
            "forward but no more storage header (input left {})",
            input.len()
        );
        return None;
    }
    if to_drop > 0 {
        trace!("Need to drop {} bytes to get to next message", to_drop);
    }
    trace!("forwarded {}", to_drop);
    Some((to_drop as u64, &input[to_drop..]))
}

/// parse the next DLT storage header
/// this function will move along the content until it finds a storage header
/// the amount of bytes we had to move forwared is the second part of the return value
pub(crate) fn dlt_storage_header(input: &[u8]) -> IResult<&[u8], Option<(StorageHeader, u64)>> {
    // trace!("dlt_storage_header (left: {} bytes)", input.len());
    match forward_to_next_storage_header(input) {
        Some((consumed, rest)) => {
            let (i, (_, _, seconds, microseconds)) = tuple((
                tag("DLT"),
                tag(&[0x01]),
                streaming::le_u32,
                streaming::le_u32,
            ))(rest)?;
            let (after_string, ecu_id) = dlt_zero_terminated_string(i, 4)?;
            Ok((
                after_string,
                Some((
                    StorageHeader {
                        timestamp: DltTimeStamp {
                            seconds,
                            microseconds,
                        },
                        ecu_id: ecu_id.to_string(),
                    },
                    consumed,
                )),
            ))
        }
        None => {
            warn!("Did not find another storage header in file");
            Err(nom::Err::Failure((&[], nom::error::ErrorKind::Verify)))
        }
    }
}

fn maybe_parse_ecu_id(a: bool) -> impl Fn(&[u8]) -> IResult<&[u8], Option<&str>> {
    fn parse_ecu_id_to_option(input: &[u8]) -> IResult<&[u8], Option<&str>> {
        map(parse_ecu_id, Some)(input)
    }
    #[allow(clippy::unnecessary_wraps)]
    fn parse_nothing_str(input: &[u8]) -> IResult<&[u8], Option<&str>> {
        Ok((input, None))
    }
    if a {
        parse_ecu_id_to_option
    } else {
        parse_nothing_str
    }
}
fn maybe_parse_u32(a: bool) -> impl Fn(&[u8]) -> IResult<&[u8], Option<u32>> {
    fn parse_u32_to_option(input: &[u8]) -> IResult<&[u8], Option<u32>> {
        map(streaming::be_u32, Some)(input)
    }
    #[allow(clippy::unnecessary_wraps)]
    fn parse_nothing_u32(input: &[u8]) -> IResult<&[u8], Option<u32>> {
        Ok((input, None))
    }
    if a {
        parse_u32_to_option
    } else {
        parse_nothing_u32
    }
}

/// The standard header is part of every DLT message
/// all big endian format [PRS_Dlt_00091]
pub(crate) fn dlt_standard_header(input: &[u8]) -> IResult<&[u8], StandardHeader> {
    let (rest, header_type_byte) = streaming::be_u8(input)?;
    let has_ecu_id = (header_type_byte & WITH_ECU_ID_FLAG) != 0;
    let has_session_id = (header_type_byte & WITH_SESSION_ID_FLAG) != 0;
    let has_timestamp = (header_type_byte & WITH_TIMESTAMP_FLAG) != 0;
    let (i, (message_counter, overall_length, ecu_id, session_id, timestamp)) = tuple((
        streaming::be_u8,
        streaming::be_u16,
        maybe_parse_ecu_id(has_ecu_id),
        maybe_parse_u32(has_session_id),
        maybe_parse_u32(has_timestamp),
    ))(rest)?;
    let has_extended_header = (header_type_byte & WITH_EXTENDED_HEADER_FLAG) != 0;
    let all_headers_length = calculate_all_headers_length(header_type_byte);
    if all_headers_length > overall_length {
        let err_ctx: (&[u8], nom::error::ErrorKind) = (input, nom::error::ErrorKind::Verify);
        let err = nom::Err::Error(err_ctx);
        return Err(err);
    }
    let payload_length = overall_length - all_headers_length;

    Ok((
        i,
        StandardHeader::new(
            header_type_byte >> 5 & 0b111,
            if (header_type_byte & BIG_ENDIAN_FLAG) != 0 {
                Endianness::Big
            } else {
                Endianness::Little
            },
            message_counter,
            has_extended_header,
            payload_length,
            ecu_id.map(|r| r.to_string()),
            session_id,
            timestamp,
        ),
    ))
}

pub(crate) fn dlt_extended_header<'a, T>(
    input: &'a [u8],
    index: Option<usize>,
    update_channel: Option<&cc::Sender<IndexingResults<T>>>,
) -> IResult<&'a [u8], ExtendedHeader> {
    let (i, (message_info, argument_count, app_id, context_id)) = tuple((
        streaming::be_u8,
        streaming::be_u8,
        parse_ecu_id,
        parse_ecu_id,
    ))(input)?;
    let verbose = (message_info & VERBOSE_FLAG) != 0;
    match MessageType::try_from(message_info) {
        Ok(message_type) => {
            if let Some(tx) = update_channel {
                match message_type {
                    MessageType::Unknown(n) => {
                        let _ = tx.send(Err(Notification {
                            severity: Severity::WARNING,
                            content: format!("unknown message type {:?}", n),
                            line: index,
                        }));
                    }
                    MessageType::Log(LogLevel::Invalid(n)) => {
                        warn!("unknown log level {}", n);
                    }
                    MessageType::Control(ControlType::Unknown(n)) => {
                        warn!("unknown control type {}", n);
                    }
                    MessageType::ApplicationTrace(ApplicationTraceType::Invalid(n)) => {
                        warn!("invalid application-trace type {}", n);
                    }
                    MessageType::NetworkTrace(NetworkTraceType::Invalid) => {
                        warn!("invalid application-trace type 0");
                    }
                    _ => (),
                };
            };
            Ok((
                i,
                ExtendedHeader {
                    verbose,
                    argument_count,
                    message_type,
                    application_id: app_id.to_string(),
                    context_id: context_id.to_string(),
                },
            ))
        }
        Err(e) => {
            if let Some(tx) = update_channel {
                let _ = tx.send(Err(Notification {
                    severity: Severity::ERROR,
                    content: format!("lineInvalid message type: {}", e),
                    line: index,
                }));
            }

            let err_ctx: (&[u8], nom::error::ErrorKind) = (input, nom::error::ErrorKind::Verify);
            let err = nom::Err::Error(err_ctx);
            Err(err)
        }
    }
}
#[inline]
pub fn is_not_null(chr: u8) -> bool {
    chr != 0x0
}
pub fn dlt_zero_terminated_string(s: &[u8], size: usize) -> IResult<&[u8], &str> {
    let (rest_with_null, content_without_null) = take_while_m_n(0, size, is_not_null)(s)?;
    let res_str = match nom::lib::std::str::from_utf8(content_without_null) {
        Ok(content) => content,
        Err(e) => {
            let (valid, _) = content_without_null.split_at(e.valid_up_to());
            unsafe { nom::lib::std::str::from_utf8_unchecked(valid) }
        }
    };
    let missing = size - content_without_null.len();
    let (rest, _) = take(missing)(rest_with_null)?;
    Ok((rest, res_str))
}

#[allow(clippy::type_complexity)]
fn dlt_variable_name_and_unit<T: NomByteOrder>(
    type_info: &TypeInfo,
) -> fn(&[u8]) -> IResult<&[u8], (Option<String>, Option<String>)> {
    if type_info.has_variable_info {
        |input| {
            let (i2, name_size_unit_size) = tuple((T::parse_u16, T::parse_u16))(input)?;
            dbg_parsed("namesize, unitsize", input, i2, &name_size_unit_size);
            let (i3, name) = dlt_zero_terminated_string(i2, name_size_unit_size.0 as usize)?;
            dbg_parsed("name", i2, i3, &name);
            let (rest, unit) = dlt_zero_terminated_string(i3, name_size_unit_size.1 as usize)?;
            dbg_parsed("unit", i3, rest, &unit);
            Ok((rest, (Some(name.to_string()), Some(unit.to_string()))))
        }
    } else {
        |input| Ok((input, (None, None)))
    }
}
fn dlt_variable_name<T: NomByteOrder>(input: &[u8]) -> IResult<&[u8], String> {
    let (i, size) = T::parse_u16(input)?;
    let (i2, name) = dlt_zero_terminated_string(i, size as usize)?;
    Ok((i2, name.to_string()))
}
pub trait NomByteOrder: Clone + Copy + Eq + Ord + PartialEq + PartialOrd {
    fn parse_u16(i: &[u8]) -> IResult<&[u8], u16>;
    fn parse_i16(i: &[u8]) -> IResult<&[u8], i16>;
    fn parse_u32(i: &[u8]) -> IResult<&[u8], u32>;
    fn parse_i32(i: &[u8]) -> IResult<&[u8], i32>;
    fn parse_f32(i: &[u8]) -> IResult<&[u8], f32>;
    fn parse_u64(i: &[u8]) -> IResult<&[u8], u64>;
    fn parse_i64(i: &[u8]) -> IResult<&[u8], i64>;
    fn parse_f64(i: &[u8]) -> IResult<&[u8], f64>;
    fn parse_u128(i: &[u8]) -> IResult<&[u8], u128>;
    fn parse_i128(i: &[u8]) -> IResult<&[u8], i128>;
}

impl NomByteOrder for BigEndian {
    #[inline]
    fn parse_u16(i: &[u8]) -> IResult<&[u8], u16> {
        streaming::be_u16(i)
    }
    #[inline]
    fn parse_i16(i: &[u8]) -> IResult<&[u8], i16> {
        streaming::be_i16(i)
    }
    #[inline]
    fn parse_u32(i: &[u8]) -> IResult<&[u8], u32> {
        streaming::be_u32(i)
    }
    #[inline]
    fn parse_i32(i: &[u8]) -> IResult<&[u8], i32> {
        streaming::be_i32(i)
    }
    #[inline]
    fn parse_f32(i: &[u8]) -> IResult<&[u8], f32> {
        streaming::be_f32(i)
    }
    #[inline]
    fn parse_u64(i: &[u8]) -> IResult<&[u8], u64> {
        streaming::be_u64(i)
    }
    #[inline]
    fn parse_i64(i: &[u8]) -> IResult<&[u8], i64> {
        streaming::be_i64(i)
    }
    #[inline]
    fn parse_f64(i: &[u8]) -> IResult<&[u8], f64> {
        streaming::be_f64(i)
    }
    #[inline]
    fn parse_u128(i: &[u8]) -> IResult<&[u8], u128> {
        streaming::be_u128(i)
    }
    #[inline]
    fn parse_i128(i: &[u8]) -> IResult<&[u8], i128> {
        streaming::be_i128(i)
    }
}

impl NomByteOrder for LittleEndian {
    #[inline]
    fn parse_u16(i: &[u8]) -> IResult<&[u8], u16> {
        streaming::le_u16(i)
    }
    #[inline]
    fn parse_i16(i: &[u8]) -> IResult<&[u8], i16> {
        streaming::le_i16(i)
    }
    #[inline]
    fn parse_u32(i: &[u8]) -> IResult<&[u8], u32> {
        streaming::le_u32(i)
    }
    #[inline]
    fn parse_i32(i: &[u8]) -> IResult<&[u8], i32> {
        streaming::le_i32(i)
    }
    #[inline]
    fn parse_f32(i: &[u8]) -> IResult<&[u8], f32> {
        streaming::le_f32(i)
    }
    #[inline]
    fn parse_u64(i: &[u8]) -> IResult<&[u8], u64> {
        streaming::le_u64(i)
    }
    #[inline]
    fn parse_i64(i: &[u8]) -> IResult<&[u8], i64> {
        streaming::le_i64(i)
    }
    #[inline]
    fn parse_f64(i: &[u8]) -> IResult<&[u8], f64> {
        streaming::le_f64(i)
    }
    #[inline]
    fn parse_u128(i: &[u8]) -> IResult<&[u8], u128> {
        streaming::le_u128(i)
    }
    #[inline]
    fn parse_i128(i: &[u8]) -> IResult<&[u8], i128> {
        streaming::le_i128(i)
    }
}

pub(crate) fn dlt_uint<T: NomByteOrder>(width: TypeLength) -> fn(&[u8]) -> IResult<&[u8], Value> {
    match width {
        TypeLength::BitLength8 => |i| map(streaming::be_u8, Value::U8)(i),
        TypeLength::BitLength16 => |i| map(T::parse_u16, Value::U16)(i),
        TypeLength::BitLength32 => |i| map(T::parse_u32, Value::U32)(i),
        TypeLength::BitLength64 => |i| map(T::parse_u64, Value::U64)(i),
        TypeLength::BitLength128 => |i| map(T::parse_u128, Value::U128)(i),
    }
}
pub(crate) fn dlt_sint<T: NomByteOrder>(width: TypeLength) -> fn(&[u8]) -> IResult<&[u8], Value> {
    match width {
        TypeLength::BitLength8 => |i| map(streaming::be_i8, Value::I8)(i),
        TypeLength::BitLength16 => |i| map(T::parse_i16, Value::I16)(i),
        TypeLength::BitLength32 => |i| map(T::parse_i32, Value::I32)(i),
        TypeLength::BitLength64 => |i| map(T::parse_i64, Value::I64)(i),
        TypeLength::BitLength128 => |i| map(T::parse_i128, Value::I128)(i),
    }
}
pub(crate) fn dlt_fint<T: NomByteOrder>(width: FloatWidth) -> fn(&[u8]) -> IResult<&[u8], Value> {
    match width {
        FloatWidth::Width32 => |i| map(T::parse_f32, Value::F32)(i),
        FloatWidth::Width64 => |i| map(T::parse_f64, Value::F64)(i),
    }
}
pub(crate) fn dlt_type_info<T: NomByteOrder>(input: &[u8]) -> IResult<&[u8], TypeInfo> {
    let (i, info) = T::parse_u32(input)?;
    match TypeInfo::try_from(info) {
        Ok(type_info) => {
            trace!("type_info parse input: {:02X?}", &input[..4]);
            trace!("type_info parsed: {:#b}", info);
            Ok((i, type_info))
        }
        Err(_) => {
            report_error(format!("dlt_type_info no type_info for 0x{:02X?}", info));
            Err(nom::Err::Error((input, nom::error::ErrorKind::Verify)))
        }
    }
}
pub(crate) fn dlt_fixed_point<T: NomByteOrder>(
    input: &[u8],
    width: FloatWidth,
) -> IResult<&[u8], FixedPoint> {
    let (i, quantization) = T::parse_f32(input)?;
    if width == FloatWidth::Width32 {
        let (rest, offset) = T::parse_i32(i)?;
        Ok((
            rest,
            FixedPoint {
                quantization,
                offset: FixedPointValue::I32(offset),
            },
        ))
    } else if width == FloatWidth::Width64 {
        let (rest, offset) = T::parse_i64(i)?;
        Ok((
            rest,
            FixedPoint {
                quantization,
                offset: FixedPointValue::I64(offset),
            },
        ))
    } else {
        report_error("error in dlt_fixed_point");
        Err(nom::Err::Error((input, nom::error::ErrorKind::Verify)))
    }
}
pub(crate) fn dlt_argument<T: NomByteOrder>(input: &[u8]) -> IResult<&[u8], Argument> {
    let (i, type_info) = dlt_type_info::<T>(input)?;
    dbg_parsed("type info", input, i, &type_info);
    match type_info.kind {
        TypeInfoKind::Signed(width) => {
            let (before_val, name_unit) = dlt_variable_name_and_unit::<T>(&type_info)(i)?;
            dbg_parsed("name and unit", i, before_val, &name_unit);
            let (rest, value) = dlt_sint::<T>(width)(before_val)?;
            dbg_parsed("sint", before_val, rest, &value);
            Ok((
                rest,
                Argument {
                    name: name_unit.0,
                    unit: name_unit.1,
                    value,
                    fixed_point: None,
                    type_info,
                },
            ))
        }
        TypeInfoKind::SignedFixedPoint(width) => {
            let (before_val, name_unit) = dlt_variable_name_and_unit::<T>(&type_info)(i)?;
            dbg_parsed("name and unit", i, before_val, &name_unit);
            let (r, fp) = dlt_fixed_point::<T>(before_val, width)?;
            let (after_fixed_point, fixed_point) = (r, Some(fp));
            dbg_parsed("fixed_point", before_val, after_fixed_point, &fixed_point);
            let (rest, value) =
                dlt_sint::<T>(float_width_to_type_length(width))(after_fixed_point)?;
            Ok((
                rest,
                Argument {
                    name: name_unit.0,
                    unit: name_unit.1,
                    value,
                    fixed_point,
                    type_info,
                },
            ))
        }
        TypeInfoKind::Unsigned(width) => {
            let (before_val, (name, unit)) = dlt_variable_name_and_unit::<T>(&type_info)(i)?;
            let (rest, value) = dlt_uint::<T>(width)(before_val)?;
            dbg_parsed("unsigned", before_val, rest, &value);
            Ok((
                rest,
                Argument {
                    name,
                    unit,
                    value,
                    fixed_point: None,
                    type_info,
                },
            ))
        }
        TypeInfoKind::UnsignedFixedPoint(width) => {
            let (before_val, (name, unit)) = dlt_variable_name_and_unit::<T>(&type_info)(i)?;
            let (after_fixed_point, fixed_point) = {
                let (r, fp) = dlt_fixed_point::<T>(before_val, width)?;
                (r, Some(fp))
            };
            let (rest, value) =
                dlt_uint::<T>(float_width_to_type_length(width))(after_fixed_point)?;
            Ok((
                rest,
                Argument {
                    name,
                    unit,
                    value,
                    fixed_point,
                    type_info,
                },
            ))
        }
        TypeInfoKind::Float(width) => {
            let (rest, ((name, unit), value)) = tuple((
                dlt_variable_name_and_unit::<T>(&type_info),
                dlt_fint::<T>(width),
            ))(i)?;
            Ok((
                rest,
                Argument {
                    name,
                    unit,
                    value,
                    fixed_point: None,
                    type_info,
                },
            ))
        }
        TypeInfoKind::Raw => {
            let (i2, raw_byte_cnt) = T::parse_u16(i)?;
            let (i3, name) = if type_info.has_variable_info {
                map(dlt_variable_name::<T>, Some)(i2)?
            } else {
                (i2, None)
            };
            let (rest, value) = map(take(raw_byte_cnt), |s: &[u8]| Value::Raw(s.to_vec()))(i3)?;
            Ok((
                rest,
                Argument {
                    name,
                    unit: None,
                    value,
                    fixed_point: None,
                    type_info,
                },
            ))
        }
        TypeInfoKind::Bool => {
            let (after_var_name, name) = if type_info.has_variable_info {
                map(dlt_variable_name::<T>, Some)(i)?
            } else {
                (i, None)
            };
            dbg_parsed("var name", i, after_var_name, &name);
            let (rest, bool_value) = streaming::be_u8(after_var_name)?;
            dbg_parsed("bool value", after_var_name, rest, &bool_value);
            Ok((
                rest,
                Argument {
                    type_info,
                    name,
                    unit: None,
                    fixed_point: None,
                    value: Value::Bool(bool_value),
                },
            ))
        }
        TypeInfoKind::StringType => {
            let (i2, size) = T::parse_u16(i)?;
            let (i3, name) = if type_info.has_variable_info {
                map(dlt_variable_name::<T>, Some)(i2)?
            } else {
                (i2, None)
            };
            let (rest, value) = dlt_zero_terminated_string(i3, size as usize)?;
            dbg_parsed("StringType", i3, rest, &value);
            // trace!(
            //     "was stringtype: \"{}\", size should have been {}",
            //     value, size
            // );
            Ok((
                rest,
                Argument {
                    name,
                    unit: None,
                    fixed_point: None,
                    value: Value::StringVal(value.to_string()),
                    type_info,
                },
            ))
        }
    }
}

#[allow(dead_code)]
struct DltArgumentParser {
    current_index: Option<usize>,
}

fn dlt_payload<T: NomByteOrder>(
    input: &[u8],
    verbose: bool,
    payload_length: u16,
    arg_cnt: u8,
    is_controll_msg: bool,
) -> IResult<&[u8], PayloadContent> {
    // trace!("try to parse dlt_payload for {:02X?}", input,);
    if verbose {
        // trace!("verbose, arg_cnt = {}", arg_cnt);
        let (rest, arguments) = count(dlt_argument::<T>, arg_cnt as usize)(input)?;
        Ok((rest, PayloadContent::Verbose(arguments)))
    } else if is_controll_msg {
        // trace!("is_controll_msg");
        if payload_length < 1 {
            // trace!("error, payload too short {}", payload_length);
            return Err(nom::Err::Failure((input, nom::error::ErrorKind::Verify)));
        }
        match tuple((nom::number::complete::be_u8, take(payload_length - 1)))(input) {
            Ok((rest, (control_msg_id, payload))) => Ok((
                rest,
                PayloadContent::ControlMsg(
                    ControlType::from_value(control_msg_id),
                    payload.to_vec(),
                ),
            )),
            Err(e) => {
                // trace!("error e {:?}", e);
                Err(e)
            }
        }
    } else {
        // trace!("non verbose (input.len = {})", input.len());
        // trace!(
        //     "not is_controll_msg, payload_length: {}, input left: {}",
        //     payload_length,
        //     input.len()
        // );
        if input.len() < 4 {
            // trace!("error, payload too short {}", input.len());
            return Err(nom::Err::Failure((input, nom::error::ErrorKind::Verify)));
        }
        match tuple((T::parse_u32, take(payload_length - 4)))(input) {
            Ok((rest, (message_id, payload))) => Ok((
                rest,
                PayloadContent::NonVerbose(message_id, payload.to_vec()),
            )),
            Err(e) => {
                // trace!("error e {:?}", e);
                Err(e)
            }
        }
    }
}

#[inline]
fn dbg_parsed<T: std::fmt::Debug>(_name: &str, _before: &[u8], _after: &[u8], _value: &T) {
    #[cfg(feature = "debug_parser")]
    {
        let input_len = _before.len();
        let now_len = _after.len();
        let parsed_len = input_len - now_len;
        if parsed_len == 0 {
            trace!("{}: not parsed", _name);
        } else {
            trace!(
                "parsed {} ({} bytes: {:02X?}) => {:?}",
                _name,
                parsed_len,
                &_before[0..parsed_len],
                _value
            );
        }
    }
}

#[derive(Debug, PartialEq)]
pub enum ParsedMessage {
    /// Regular message, could be parsed
    Item(Message),
    /// message was filtered out due to filter conditions (Log-Level etc.)
    FilteredOut(usize),
    /// Parsed message was invalid, no parse possible
    Invalid,
}

/// a DLT message looks like this: [STANDARD-HEADER][EXTENDED-HEADER][PAYLOAD]
/// if stored, an additional header is placed BEFORE all of this [storage-header][...]
/// example: 444C5401 262CC94D D8A20C00 45435500 3500001F 45435500 3F88623A 16014150 5000434F 4E001100 00000472 656D6F
/// --------------------------------------------
/// [STORAGE-HEADER]: 444C5401 262CC94D D8A20C00 45435500
///     444C5401 = DLT + 0x01 (DLT Pattern)
///  timestamp_sec: 262CC94D = 0x4DC92C26
///  timestamp_us: D8A20C00 = 0x000CA2D8
///  ecu-id: 45435500 = b"ECU\0"
///
/// 3500001F 45435500 3F88623A 16014150 5000434F 4E001100 00000472 656D6F (31 byte)
/// --------------------------------------------
/// [HEADER]: 35 00 001F 45435500 3F88623A
///   header type = 0x35 = 0b0011 0101
///       UEH: 1 - > using extended header
///       MSBF: 0 - > little endian
///       WEID: 1 - > with ecu id
///       WSID: 0 - > no session id
///       WTMS: 1 - > with timestamp
///   message counter = 0x00 = 0
///   length = 001F = 31
///   ecu-id = 45435500 = "ECU "
///   timestamp = 3F88623A = 106590265.0 ms since ECU startup (~30 h)
/// --------------------------------------------
/// [EXTENDED HEADER]: 16014150 5000434F 4E00
///   message-info MSIN = 0x16 = 0b0001 0110
///   0 -> non-verbose
///   011 (MSTP Message Type) = 0x3 = Dlt Control Message
///   0001 (MTIN Message Type Info) = 0x1 = Request Control Message
///   number of arguments NOAR = 0x01
///   application id = 41505000 = "APP "
///   context id = 434F4E00 = "CON "
/// --------------------------------------------
/// payload: 1100 00000472 656D6F
///   0x11 == SetDefaultLogLevel
///     00 == new log level (block all messages)
///
pub fn dlt_message<'a>(
    input: &'a [u8],
    filter_config_opt: Option<&filtering::ProcessedDltFilterConfig>,
    index: usize,
    update_channel: Option<&cc::Sender<ChunkResults>>,
    with_storage_header: bool,
) -> Result<(&'a [u8], ParsedMessage), DltParseError> {
    // trace!("starting to parse dlt_message==================");
    let (after_storage_header, storage_header_shifted): (&[u8], Option<(StorageHeader, u64)>) =
        if with_storage_header {
            dlt_storage_header(input)?
        } else {
            (input, None)
        };
    if let Some((storage_header, shifted)) = &storage_header_shifted {
        dbg_parsed(
            "storage header",
            &input[(*shifted as usize)..],
            &after_storage_header,
            &storage_header,
        )
    };
    let (after_storage_and_normal_header, header) = dlt_standard_header(after_storage_header)?;
    dbg_parsed(
        "normal header",
        &after_storage_header,
        &after_storage_and_normal_header,
        &header,
    );

    let payload_length_res = validated_payload_length(&header, input.len());

    let mut verbose: bool = false;
    let mut is_controll_msg = false;
    let mut arg_count = 0;
    let (after_headers, extended_header) = if header.has_extended_header {
        let (rest, ext_header) =
            dlt_extended_header(after_storage_and_normal_header, Some(index), update_channel)?;
        verbose = ext_header.verbose;
        arg_count = ext_header.argument_count;
        is_controll_msg = matches!(ext_header.message_type, MessageType::Control(_));
        dbg_parsed(
            "extended header",
            &after_storage_and_normal_header,
            &rest,
            &ext_header,
        );
        (rest, Some(ext_header))
    } else {
        (after_storage_and_normal_header, None)
    };
    // trace!(
    //     "extended header: {:?}",
    //     serde_json::to_string(&extended_header)
    // );
    let payload_length = match payload_length_res {
        Ok(length) => length,
        Err(e) => {
            warn!("No validated payload length: {}", e);
            return Ok((after_storage_and_normal_header, ParsedMessage::Invalid));
        }
    };
    if filtered_out(
        extended_header.as_ref(),
        filter_config_opt,
        header.ecu_id.as_ref(),
    ) {
        let (after_message, _) = take(payload_length)(after_headers)?;
        return Ok((
            after_message,
            ParsedMessage::FilteredOut(payload_length as usize),
        ));
    }
    let (i, payload) = if header.endianness == Endianness::Big {
        dlt_payload::<BigEndian>(
            after_headers,
            verbose,
            payload_length,
            arg_count,
            is_controll_msg,
        )?
    } else {
        dlt_payload::<LittleEndian>(
            after_headers,
            verbose,
            payload_length,
            arg_count,
            is_controll_msg,
        )?
    };
    dbg_parsed("payload", &after_headers, &i, &payload);
    Ok((
        i,
        ParsedMessage::Item(Message {
            storage_header: storage_header_shifted.map(|shs| shs.0),
            header,
            extended_header,
            payload,
        }),
    ))
}

fn filtered_out(
    extended_header: Option<&ExtendedHeader>,
    filter_config_opt: Option<&filtering::ProcessedDltFilterConfig>,
    ecu_id: Option<&String>,
) -> bool {
    if let Some(filter_config) = filter_config_opt {
        if let Some(h) = &extended_header {
            if let Some(min_filter_level) = filter_config.min_log_level {
                if h.skip_with_level(min_filter_level) {
                    // trace!("no need to parse further, skip payload (skipped level)");
                    return true;
                }
            }
            if let Some(only_these_components) = &filter_config.app_ids {
                if !only_these_components.contains(&h.application_id) {
                    // trace!("no need to parse further, skip payload (skipped app id)");
                    return true;
                }
            }
            if let Some(only_these_context_ids) = &filter_config.context_ids {
                if !only_these_context_ids.contains(&h.context_id) {
                    // trace!("no need to parse further, skip payload (skipped context id)");
                    return true;
                }
            }
            if let Some(only_these_ecu_ids) = &filter_config.ecu_ids {
                if let Some(ecu_id) = ecu_id {
                    if !only_these_ecu_ids.contains(ecu_id) {
                        // trace!("no need to parse further, skip payload (skipped ecu id)");
                        return true;
                    }
                }
            }
        } else {
            // filter out some messages when we do not have an extended header
            if let Some(app_id_set) = &filter_config.app_ids {
                if filter_config.app_id_count > app_id_set.len() as i64 {
                    // some app id was filtered, ignore this entry
                    return true;
                }
            }
            if let Some(context_id_set) = &filter_config.context_ids {
                if filter_config.context_id_count > context_id_set.len() as i64 {
                    // some context id was filtered, ignore this entry
                    return true;
                }
            }
        }
    }
    false
}

fn validated_payload_length(
    header: &StandardHeader,
    remaining_bytes: usize,
) -> Result<u16, DltParseError> {
    let message_length = header.overall_length();
    let headers_length = calculate_all_headers_length(header.header_type_byte());
    if message_length < headers_length {
        return Err(DltParseError::ParsingHickup(
            "Parsed message-length is less then the length of all headers".to_string(),
        ));
    }

    let payload_length = message_length - headers_length;
    if payload_length as usize > remaining_bytes {
        return Err(DltParseError::ParsingHickup (
            "Payload length seems to be longer then the remaining bytes, message-length is malformed".to_string(),
        ));
    }
    Ok(message_length - headers_length)
}

fn skip_till_after_next_storage_header(input: &[u8]) -> Result<(&[u8], u64), DltParseError> {
    match forward_to_next_storage_header(input) {
        Some((consumed, rest)) => {
            let (after_storage_header, skipped_bytes) = skip_storage_header(rest)?;
            Ok((after_storage_header, consumed + skipped_bytes))
        }
        None => Err(DltParseError::ParsingHickup(
            "did not find another storage header".into(),
        )),
    }
}

/// check if the DLT_PATTERN next and just skip the storage header if so
/// returns a slice where the storage header was removed
pub(crate) fn skip_storage_header(input: &[u8]) -> Result<(&[u8], u64), DltParseError> {
    let (i, (_, _, _)): (&[u8], _) = tuple((tag("DLT"), tag(&[0x01]), take(12usize)))(input)?;
    if input.len() - i.len() == STORAGE_HEADER_LENGTH as usize {
        Ok((i, STORAGE_HEADER_LENGTH))
    } else {
        Err(DltParseError::ParsingHickup(
            "did not match DLT pattern".into(),
        ))
    }
}

pub fn dlt_consume_msg(input: &[u8]) -> Result<(&[u8], Option<u64>), DltParseError> {
    let (after_storage_header, skipped_bytes) = skip_storage_header(input)?;
    let (_, header) = dlt_standard_header(after_storage_header)?;
    let overall_length_without_storage_header = header.overall_length() as u64;
    let (after_message, _) = take(overall_length_without_storage_header)(after_storage_header)?;
    let consumed = skipped_bytes + overall_length_without_storage_header;
    Ok((after_message, Some(consumed)))
}

pub fn dlt_statistic_row_info<'a, T>(
    input: &'a [u8],
    index: Option<usize>,
    with_storage_header: bool,
    update_channel: Option<&cc::Sender<IndexingResults<T>>>,
) -> Result<(&'a [u8], StatisticRowInfo), DltParseError> {
    let (after_storage_header, _) = if with_storage_header {
        skip_till_after_next_storage_header(input)?
    } else {
        (input, 0)
    };
    let (after_storage_and_normal_header, header) = dlt_standard_header(after_storage_header)?;

    let payload_length = match validated_payload_length(&header, input.len()) {
        Ok(length) => length,
        Err(_e) => {
            return Ok((
                after_storage_and_normal_header,
                StatisticRowInfo {
                    app_id_context_id: None,
                    ecu_id: header.ecu_id,
                    level: None,
                    verbose: false,
                },
            ));
        }
    };
    if !header.has_extended_header {
        // no app id, skip rest
        let (after_message, _) = take(payload_length)(after_storage_and_normal_header)?;
        return Ok((
            after_message,
            StatisticRowInfo {
                app_id_context_id: None,
                ecu_id: header.ecu_id,
                level: None,
                verbose: false,
            },
        ));
    }

    let (after_headers, extended_header) =
        dlt_extended_header(after_storage_and_normal_header, index, update_channel)?;
    // skip payload
    let (after_message, _) = take(payload_length)(after_headers)?;
    let level = match extended_header.message_type {
        MessageType::Log(level) => Some(level),
        _ => None,
    };
    Ok((
        after_message,
        StatisticRowInfo {
            app_id_context_id: Some((extended_header.application_id, extended_header.context_id)),
            ecu_id: header.ecu_id,
            level,
            verbose: extended_header.verbose,
        },
    ))
}

#[derive(Error, Debug, PartialEq)]
pub enum DltParseError {
    #[error("parsing stopped, cannot continue: {0}")]
    Unrecoverable(String),
    #[error("parsing error, try to continue: {0}")]
    ParsingHickup(String),
    #[error("parsing could not complete: {:?}", needed)]
    IncompleteParse { needed: Option<usize> },
}
impl From<std::io::Error> for DltParseError {
    fn from(err: std::io::Error) -> DltParseError {
        DltParseError::Unrecoverable(format!("{}", err))
    }
}
impl From<pcap_parser::PcapError> for DltParseError {
    fn from(err: pcap_parser::PcapError) -> DltParseError {
        DltParseError::Unrecoverable(format!("{}", err))
    }
}
impl From<anyhow::Error> for DltParseError {
    fn from(err: anyhow::Error) -> DltParseError {
        DltParseError::Unrecoverable(format!("{}", err))
    }
}
impl From<nom::Err<(&[u8], nom::error::ErrorKind)>> for DltParseError {
    fn from(err: nom::Err<(&[u8], nom::error::ErrorKind)>) -> DltParseError {
        match err {
            nom::Err::Incomplete(n) => {
                let needed = match n {
                    nom::Needed::Size(s) => Some(s),
                    nom::Needed::Unknown => None,
                };
                DltParseError::IncompleteParse { needed }
            }
            nom::Err::Error((input, kind)) => DltParseError::ParsingHickup(format!(
                "{:?} ({} bytes left in input)",
                kind,
                input.len()
            )),
            nom::Err::Failure((input, kind)) => DltParseError::Unrecoverable(format!(
                "{:?} ({} bytes left in input)",
                kind,
                input.len()
            )),
        }
    }
}

#[derive(Serialize, Debug, Default)]
struct LevelDistribution {
    non_log: usize,
    log_fatal: usize,
    log_error: usize,
    log_warning: usize,
    log_info: usize,
    log_debug: usize,
    log_verbose: usize,
    log_invalid: usize,
}
impl LevelDistribution {
    pub fn new(level: Option<LogLevel>) -> LevelDistribution {
        let all_zero = Default::default();
        match level {
            None => LevelDistribution {
                non_log: 1,
                ..all_zero
            },
            Some(LogLevel::Fatal) => LevelDistribution {
                log_fatal: 1,
                ..all_zero
            },
            Some(LogLevel::Error) => LevelDistribution {
                log_error: 1,
                ..all_zero
            },
            Some(LogLevel::Warn) => LevelDistribution {
                log_warning: 1,
                ..all_zero
            },
            Some(LogLevel::Info) => LevelDistribution {
                log_info: 1,
                ..all_zero
            },
            Some(LogLevel::Debug) => LevelDistribution {
                log_debug: 1,
                ..all_zero
            },
            Some(LogLevel::Verbose) => LevelDistribution {
                log_verbose: 1,
                ..all_zero
            },
            _ => LevelDistribution {
                log_invalid: 1,
                ..all_zero
            },
        }
    }
}
type IdMap = FxHashMap<String, LevelDistribution>;

fn add_for_level(level: Option<LogLevel>, ids: &mut IdMap, id: String) {
    if let Some(n) = ids.get_mut(&id) {
        match level {
            Some(LogLevel::Fatal) => {
                *n = LevelDistribution {
                    log_fatal: n.log_fatal + 1,
                    ..*n
                }
            }
            Some(LogLevel::Error) => {
                *n = LevelDistribution {
                    log_error: n.log_error + 1,
                    ..*n
                }
            }
            Some(LogLevel::Warn) => {
                *n = LevelDistribution {
                    log_warning: n.log_warning + 1,
                    ..*n
                }
            }
            Some(LogLevel::Info) => {
                *n = LevelDistribution {
                    log_info: n.log_info + 1,
                    ..*n
                }
            }
            Some(LogLevel::Debug) => {
                *n = LevelDistribution {
                    log_debug: n.log_debug + 1,
                    ..*n
                };
            }
            Some(LogLevel::Verbose) => {
                *n = LevelDistribution {
                    log_verbose: n.log_verbose + 1,
                    ..*n
                };
            }
            Some(LogLevel::Invalid(_)) => {
                *n = LevelDistribution {
                    log_invalid: n.log_invalid + 1,
                    ..*n
                };
            }
            None => {
                *n = LevelDistribution {
                    non_log: n.non_log + 1,
                    ..*n
                };
            }
        }
    } else {
        ids.insert(id, LevelDistribution::new(level));
    }
}
#[derive(Serialize, Debug)]
pub struct StatisticInfo {
    app_ids: Vec<(String, LevelDistribution)>,
    context_ids: Vec<(String, LevelDistribution)>,
    ecu_ids: Vec<(String, LevelDistribution)>,
    contained_non_verbose: bool,
}

pub type StatisticsResults = std::result::Result<IndexingProgress<StatisticInfo>, Notification>;
pub fn get_dlt_file_info(
    in_file: &std::path::PathBuf,
    update_channel: &cc::Sender<StatisticsResults>,
    shutdown_receiver: Option<crossbeam_channel::Receiver<()>>,
) -> Result<(), DltParseError> {
    let f = fs::File::open(in_file)?;

    let source_file_size = fs::metadata(&in_file)?.len();
    let mut reader = ReduxReader::with_capacity(DLT_READER_CAPACITY, f)
        .set_policy(MinBuffered(DLT_MIN_BUFFER_SPACE));

    let mut app_ids: IdMap = FxHashMap::default();
    let mut context_ids: IdMap = FxHashMap::default();
    let mut ecu_ids: IdMap = FxHashMap::default();
    let mut index = 0usize;
    let mut processed_bytes = 0u64;
    let mut contained_non_verbose = false;
    loop {
        match read_one_dlt_message_info(&mut reader, Some(index), true, Some(update_channel)) {
            Ok(Some((
                consumed,
                StatisticRowInfo {
                    app_id_context_id: Some((app_id, context_id)),
                    ecu_id: ecu,
                    level,
                    verbose,
                },
            ))) => {
                contained_non_verbose = contained_non_verbose || !verbose;
                reader.consume(consumed as usize);
                add_for_level(level, &mut app_ids, app_id);
                add_for_level(level, &mut context_ids, context_id);
                match ecu {
                    Some(id) => add_for_level(level, &mut ecu_ids, id),
                    None => add_for_level(level, &mut ecu_ids, "NONE".to_string()),
                };
                processed_bytes += consumed;
            }
            Ok(Some((
                consumed,
                StatisticRowInfo {
                    app_id_context_id: None,
                    ecu_id: ecu,
                    level,
                    verbose,
                },
            ))) => {
                contained_non_verbose = contained_non_verbose || !verbose;
                reader.consume(consumed as usize);
                add_for_level(level, &mut app_ids, "NONE".to_string());
                add_for_level(level, &mut context_ids, "NONE".to_string());
                match ecu {
                    Some(id) => add_for_level(level, &mut ecu_ids, id),
                    None => add_for_level(level, &mut ecu_ids, "NONE".to_string()),
                };
                processed_bytes += consumed;
            }
            Ok(None) => {
                break;
            }
            // Err(e) => {
            //     return Err(err_msg(format!(
            //         "error while parsing dlt messages[{}]: {}",
            //         index, e
            //     )))
            Err(e) => {
                // we couldn't parse the message. try to skip it and find the next.
                debug!("stats...try to skip and continue parsing: {}", e);
                match e {
                    DltParseError::ParsingHickup(reason) => {
                        // we couldn't parse the message. try to skip it and find the next.
                        reader.consume(4); // at least skip the magic DLT pattern
                        debug!(
                            "error parsing 1 dlt message, try to continue parsing: {}",
                            reason
                        );
                    }
                    DltParseError::Unrecoverable(cause) => {
                        warn!("cannot continue parsing: {}", cause);
                        let _ = update_channel.send(Err(Notification {
                            severity: Severity::ERROR,
                            content: format!("error parsing dlt file: {}", cause),
                            line: None,
                        }));
                        break;
                    }
                    DltParseError::IncompleteParse { needed } => {
                        warn!(
                            "cannot continue parsing, parse was incomplete: {:?}",
                            needed
                        );
                        let _ = update_channel.send(Err(Notification {
                            severity: Severity::ERROR,
                            content: format!("parse was incomplete: {:?}", needed),
                            line: None,
                        }));
                        break;
                    }
                }
            }
        }
        index += 1;
        if index % STOP_CHECK_LINE_THRESHOLD == 0 {
            if utils::check_if_stop_was_requested(shutdown_receiver.as_ref(), "dlt stats producer")
            {
                let _ = update_channel.send(Ok(IndexingProgress::Stopped));
                break;
            }
            let _ = update_channel.send(Ok(IndexingProgress::Progress {
                ticks: (processed_bytes, source_file_size),
            }));
        }
    }
    let res = StatisticInfo {
        app_ids: app_ids
            .into_iter()
            .collect::<Vec<(String, LevelDistribution)>>(),
        context_ids: context_ids
            .into_iter()
            .collect::<Vec<(String, LevelDistribution)>>(),
        ecu_ids: ecu_ids
            .into_iter()
            .collect::<Vec<(String, LevelDistribution)>>(),
        contained_non_verbose,
    };

    let _ = update_channel.send(Ok(IndexingProgress::GotItem { item: res }));
    let _ = update_channel.send(Ok(IndexingProgress::Finished));
    Ok(())
}

#[derive(Serialize, Debug)]
pub struct StatisticRowInfo {
    app_id_context_id: Option<(String, String)>,
    ecu_id: Option<String>,
    level: Option<LogLevel>,
    verbose: bool,
}
fn read_one_dlt_message_info<T: Read>(
    reader: &mut ReduxReader<T, MinBuffered>,
    index: Option<usize>,
    with_storage_header: bool,
    update_channel: Option<&cc::Sender<StatisticsResults>>,
) -> Result<Option<(u64, StatisticRowInfo)>, DltParseError> {
    match reader.fill_buf() {
        Ok(content) => {
            if content.is_empty() {
                return Ok(None);
            }
            let available = content.len();
            let r = dlt_statistic_row_info(content, index, with_storage_header, update_channel)?;
            let consumed = available - r.0.len();
            Ok(Some((consumed as u64, r.1)))
        }
        Err(e) => Err(DltParseError::ParsingHickup(format!(
            "error while parsing dlt messages: {}",
            e
        ))),
    }
}
