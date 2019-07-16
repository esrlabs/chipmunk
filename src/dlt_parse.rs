use crate::dlt;
use crate::dlt::TryFrom;

use nom::bytes::streaming::{tag, take, take_while_m_n};
use byteorder::{BigEndian, LittleEndian};
use nom::{
    number::streaming,
    combinator::{map},
    sequence::tuple,
    multi::count,
    IResult,
};

use std::str;
// use std::fmt;
// use std::io::{Read, BufRead};
// use buf_redux::BufReader;
// use buf_redux::policy::MinBuffered;

// pub struct MessageIter<'a, T: Read> {
//     reader: BufReader<T, MinBuffered>,
//     #[allow(dead_code)]
//     tag: &'a str,
//     #[allow(dead_code)]
//     processed_bytes: usize,
//     #[allow(dead_code)]
//     processed_lines: usize,
// }
// impl<'a, T: Read> MessageIter<'a, T> {
//     pub fn new(fh: T, tag: &'a str, processed_lines: usize) -> MessageIter<'a, T> {
//         let reader =
//             BufReader::with_capacity(10 * 1024 * 1024, fh).set_policy(MinBuffered(10 * 1024));
//         MessageIter {
//             reader,
//             tag,
//             processed_bytes: 0,
//             processed_lines,
//         }
//     }
// }

// pub struct CountedMessage {
//     pub dlt_message: dlt::Message,
//     pub line_index: usize,
//     pub byte_index: usize,
// }
// impl fmt::Display for CountedMessage {
//     fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
//         self.dlt_message.fmt(f)
//     }
// }
// impl<'a, T: Read> Iterator for MessageIter<'a, T> {
//     type Item = CountedMessage;
//     fn next(&mut self) -> Option<Self::Item> {
//         let res = loop {
//             match self.reader.fill_buf() {
//                 Ok(content) => {
//                     // println!("content: {}", content.len());
//                     if content.is_empty() {
//                         return None;
//                     }
//                     let available = content.len();
//                     let res: IResult<&[u8], dlt::Message> = dlt_message(content);
//                     match res {
//                         Ok(r) => {
//                             let consumed = available - r.0.len();
//                             break (consumed, r.1);
//                         }
//                         e => {
//                             if let Err(nom::Err::Incomplete(_)) = e {
//                                 continue;
//                             } else {
//                                 panic!(format!("error while iterating...{:?}", e));
//                             }
//                         }
//                     }
//                 }
//                 Err(e) => {
//                     panic!("error while iterating...{}", e);
//                 }
//             }
//         };
//         self.reader.consume(res.0);
//         let result = Some(CountedMessage {
//             dlt_message: res.1,
//             line_index: self.processed_lines,
//             byte_index: self.processed_bytes,
//         });
//         self.processed_lines += 1;
//         self.processed_bytes += res.0;
//         result
//     }
// }
fn parse_ecu_id(input: &[u8]) -> IResult<&[u8], &str> {
    dlt_zero_terminated_string(input, 4)
}
fn dlt_storage_header(input: &[u8]) -> IResult<&[u8], Option<dlt::StorageHeader>> {
    let (i, (_, _, seconds, microseconds)) = tuple((
        tag("DLT"),
        tag(&[0x01]),
        streaming::le_u32,
        streaming::le_u32,
    ))(input)?;
    let (rest, ecu_id) = dlt_zero_terminated_string(i, 4)?;
    Ok((
        rest,
        Some(dlt::StorageHeader {
            timestamp: dlt::DltTimeStamp {
                seconds,
                microseconds,
            },
            ecu_id: ecu_id.to_string(),
        }),
    ))
}

fn maybe_parse_ecu_id(a: bool) -> impl Fn(&[u8]) -> IResult<&[u8], Option<&str>> {
    fn parse_ecu_id_to_option(input: &[u8]) -> IResult<&[u8], Option<&str>> {
        map(parse_ecu_id, Some)(input)
    }
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
fn dlt_standard_header(input: &[u8]) -> IResult<&[u8], dlt::StandardHeader> {
    let (rest, header_type) = streaming::be_u8(input)?;
    let has_ecu_id = (header_type & dlt::WITH_ECU_ID_FLAG) != 0;
    let has_session_id = (header_type & dlt::WITH_SESSION_ID_FLAG) != 0;
    let has_timestamp = (header_type & dlt::WITH_TIMESTAMP_FLAG) != 0;
    let (i, (message_counter, len, ecu_id, session_id, timestamp)) = tuple((
        streaming::be_u8,
        streaming::be_u16,
        maybe_parse_ecu_id(has_ecu_id),
        maybe_parse_u32(has_session_id),
        maybe_parse_u32(has_timestamp),
    ))(rest)?;

    Ok((
        i,
        dlt::StandardHeader {
            version: header_type >> 5 & 0b111,
            has_extended_header: (header_type & dlt::WITH_EXTENDED_HEADER_FLAG) != 0,
            big_endian: (header_type & dlt::BIG_ENDIAN_FLAG) != 0,
            message_counter,
            overall_length: len,
            ecu_id: ecu_id.map(|r| r.to_string()),
            session_id,
            timestamp,
        },
    ))
}

fn dlt_extended_header(input: &[u8]) -> IResult<&[u8], dlt::ExtendedHeader> {
    let (i, (message_info, argument_count, app_id, context_id)) = tuple((
        streaming::be_u8,
        streaming::be_u8,
        parse_ecu_id,
        parse_ecu_id,
    ))(input)?;

    let verbose = (message_info & dlt::VERBOSE_FLAG) != 0;
    match dlt::MessageType::try_from(message_info) {
        Ok(message_type) => Ok((
            i,
            dlt::ExtendedHeader {
                verbose,
                argument_count,
                message_type,
                application_id: app_id.to_string(),
                context_id: context_id.to_string(),
            },
        )),
        Err(e) => {
            eprintln!("Invalid message type: {}", e);
            Err(nom::Err::Error((i, nom::error::ErrorKind::Verify)))
        }
    }
}
#[inline]
pub fn is_not_null(chr: u8) -> bool {
    chr != 0x0
}
#[inline]
pub fn is_null(chr: u8) -> bool {
    chr == 0x0
}
#[allow(clippy::type_complexity)]
pub fn zeros(max: usize) -> Box<dyn Fn(&[u8]) -> IResult<&[u8], &[u8]>> {
    Box::new(move |input| nom::bytes::streaming::take_while_m_n(max, max, is_null)(input))
}
fn dlt_zero_terminated_string(s: &[u8], size: usize) -> IResult<&[u8], &str> {
    let id_parser = map(take_while_m_n(0, size, is_not_null), |x| unsafe {
        nom::lib::std::str::from_utf8_unchecked(x)
    });
    let (rest, non_null) = id_parser(s)?;
    let missing = size - non_null.len();
    let (rest2, _) = zeros(missing)(rest)?;
    Ok((rest2, non_null))
}
#[allow(clippy::type_complexity)]
fn dlt_variable_name_and_unit<T: NomByteOrder>(
    type_info: &dlt::TypeInfo,
) -> fn(&[u8]) -> IResult<&[u8], (Option<String>, Option<String>)> {
    if type_info.has_variable_info {
        |input| {
            let (i2, (name_size, unit_size)) = tuple((T::parse_u16, T::parse_u16))(input)?;
            let (i3, name) = dlt_zero_terminated_string(i2, name_size as usize)?;
            let (rest, unit) = dlt_zero_terminated_string(i3, unit_size as usize)?;
            Ok((rest, (Some(name.to_string()), Some(unit.to_string()))))
        }
    } else {
        |input| Ok((input, (None, None)))
    }
}
fn dlt_variable_name<T: NomByteOrder>(input: &[u8]) -> IResult<&[u8], String> {
    // println!("{:02X?}", input);
    let (i, size) = T::parse_u16(input)?;
    // println!("{}", size);
    let (i2, name) = dlt_zero_terminated_string(i, size as usize)?;
    // println!("name: {}", name);
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

fn dlt_uint<T: NomByteOrder>(width: dlt::TypeLength) -> fn(&[u8]) -> IResult<&[u8], dlt::Value> {
    match width {
        dlt::TypeLength::BitLength8 => |i| map(streaming::be_u8, dlt::Value::U8)(i),
        dlt::TypeLength::BitLength16 => |i| map(T::parse_u16, dlt::Value::U16)(i),
        dlt::TypeLength::BitLength32 => |i| map(T::parse_u32, dlt::Value::U32)(i),
        dlt::TypeLength::BitLength64 => |i| map(T::parse_u64, dlt::Value::U64)(i),
        dlt::TypeLength::BitLength128 => |i| map(T::parse_u128, dlt::Value::U128)(i),
    }
}
fn dlt_sint<T: NomByteOrder>(width: dlt::TypeLength) -> fn(&[u8]) -> IResult<&[u8], dlt::Value> {
    match width {
        dlt::TypeLength::BitLength8 => |i| map(streaming::be_i8, dlt::Value::I8)(i),
        dlt::TypeLength::BitLength16 => |i| map(T::parse_i16, dlt::Value::I16)(i),
        dlt::TypeLength::BitLength32 => |i| map(T::parse_i32, dlt::Value::I32)(i),
        dlt::TypeLength::BitLength64 => |i| map(T::parse_i64, dlt::Value::I64)(i),
        dlt::TypeLength::BitLength128 => |i| map(T::parse_i128, dlt::Value::I128)(i),
    }
}
fn dlt_fint<T: NomByteOrder>(width: dlt::FloatWidth) -> fn(&[u8]) -> IResult<&[u8], dlt::Value> {
    match width {
        dlt::FloatWidth::Width32 => |i| map(T::parse_f32, dlt::Value::F32)(i),
        dlt::FloatWidth::Width64 => |i| map(T::parse_f64, dlt::Value::F64)(i),
    }
}
fn dlt_type_info<T: NomByteOrder>(input: &[u8]) -> IResult<&[u8], dlt::TypeInfo> {
    let (i, info) = T::parse_u32(input)?;
    // println!("get type info for {:b}", info);
    match dlt::TypeInfo::try_from(info) {
        Ok(type_info) => {
            // println!("was type_info {:?}", type_info);
            Ok((i, type_info))
        }
        Err(_) => {
            eprintln!("dlt_type_info no type_info for 0x{:02X?}", info);
            Err(nom::Err::Error((&[], nom::error::ErrorKind::Verify)))
        }
    }
}
fn dlt_fixed_point<T: NomByteOrder>(
    input: &[u8],
    width: dlt::TypeLength,
) -> IResult<&[u8], dlt::FixedPoint> {
    println!("width {:?} dlt_fixedpoint,input: \t{:02X?}", width, input);
    let (i, quantization) = T::parse_f32(input)?;
    println!("parsed quantization: {:?}", quantization);
    if width == dlt::TypeLength::BitLength32 {
        let (rest, offset) = T::parse_i32(i)?;
        println!("parsed offset: {:?}", offset);
        Ok((
            rest,
            dlt::FixedPoint {
                quantization,
                offset: dlt::FixedPointValue::I32(offset),
            },
        ))
    } else if width == dlt::TypeLength::BitLength64 {
        let (rest, offset) = T::parse_i64(i)?;
        Ok((
            rest,
            dlt::FixedPoint {
                quantization,
                offset: dlt::FixedPointValue::I64(offset),
            },
        ))
    } else {
        eprintln!("error in dlt_fixed_point");
        Err(nom::Err::Error((input, nom::error::ErrorKind::Verify)))
    }
}
fn dlt_argument<T: NomByteOrder>(input: &[u8]) -> IResult<&[u8], dlt::Argument> {
    // println!("before dlt_argument, input: \t{:02X?}", input);
    let (i, type_info) = dlt_type_info::<T>(input)?;
    // println!(
    //     "after dlt_type_info, input: \t{:02X?}, type_info: {:?}",
    //     i, type_info
    // );
    match type_info.kind {
        // dlt::TypeInfoKind::Array => {
        //     panic!("TODO: array not yet implemented"); // not yet impemented
        // }
        dlt::TypeInfoKind::Signed(width, fixed_point) => {
            let (before_val, (name, unit)) = dlt_variable_name_and_unit::<T>(&type_info)(i)?;
            let (after_fixed_point, fixed_point) = if fixed_point {
                let (r, fp) = dlt_fixed_point::<T>(before_val, width)?;
                (r, Some(fp))
            } else {
                (before_val, None)
            };
            let (rest, value) = dlt_sint::<T>(width)(after_fixed_point)?;
            Ok((
                rest,
                dlt::Argument {
                    name,
                    unit,
                    value,
                    fixed_point,
                    type_info,
                },
            ))
        }
        dlt::TypeInfoKind::Unsigned(width, fixed_point) => {
            let (before_val, (name, unit)) = dlt_variable_name_and_unit::<T>(&type_info)(i)?;
            let (after_fixed_point, fixed_point) = if fixed_point {
                let (r, fp) = dlt_fixed_point::<T>(before_val, width)?;
                (r, Some(fp))
            } else {
                (before_val, None)
            };
            let (rest, value) = dlt_uint::<T>(width)(after_fixed_point)?;
            Ok((
                rest,
                dlt::Argument {
                    name,
                    unit,
                    value,
                    fixed_point,
                    type_info,
                },
            ))
        }
        dlt::TypeInfoKind::Float(width) => {
            let (rest, ((name, unit), value)) = tuple((
                dlt_variable_name_and_unit::<T>(&type_info),
                dlt_fint::<T>(width),
            ))(i)?;
            Ok((
                rest,
                dlt::Argument {
                    name,
                    unit,
                    value,
                    fixed_point: None,
                    type_info,
                },
            ))
        }
        dlt::TypeInfoKind::Raw => {
            let (i2, raw_byte_cnt) = T::parse_u16(i)?;
            let (i3, name) = if type_info.has_variable_info {
                map(dlt_variable_name::<T>, Some)(i2)?
            } else {
                (i2, None)
            };
            let (rest, value) =
                map(take(raw_byte_cnt), |s: &[u8]| dlt::Value::Raw(s.to_vec()))(i3)?;
            Ok((
                rest,
                dlt::Argument {
                    name,
                    unit: None,
                    value,
                    fixed_point: None,
                    type_info,
                },
            ))
        }
        dlt::TypeInfoKind::Bool => {
            let (rest, name) = if type_info.has_variable_info {
                map(dlt_variable_name::<T>, Some)(i)?
            } else {
                (i, None)
            };
            let (rest, bool_value) = streaming::be_u8(rest)?;
            Ok((
                rest,
                dlt::Argument {
                    type_info,
                    name,
                    unit: None,
                    fixed_point: None,
                    value: dlt::Value::Bool(bool_value != 0),
                },
            ))
        }
        dlt::TypeInfoKind::StringType => {
            let (i2, size) = T::parse_u16(i)?;
            let (i3, name) = if type_info.has_variable_info {
                map(dlt_variable_name::<T>, Some)(i2)?
            } else {
                (i2, None)
            };
            let (rest, value) = dlt_zero_terminated_string(i3, size as usize)?;
            // println!("was stringtype: \"{}\", size should have been {}", value, size);
            Ok((
                rest,
                dlt::Argument {
                    name,
                    unit: None,
                    fixed_point: None,
                    value: dlt::Value::StringVal(value.to_string()),
                    type_info,
                },
            ))
        }
    }
}

fn dlt_payload<T: NomByteOrder>(
    input: &[u8],
    verbose: bool,
    payload_length: usize,
    arg_cnt: u8,
) -> IResult<&[u8], dlt::Payload> {
    if !verbose {
        let (rest, (message_id, payload)) = tuple((T::parse_u32, take(payload_length - 4)))(input)?;
        Ok((rest, dlt::Payload::NonVerbose(message_id, payload.to_vec())))
    } else {
        let (rest, arguments) = count(dlt_argument::<T>, arg_cnt as usize)(input)?;
        Ok((rest, dlt::Payload::Verbose(arguments)))
    }
}
/// a DLT message looks like this: [standard-header][extended-header][payload]
/// if stored, an additional header is placed BEFORE all of this [storage-header][...]
/// example: 444C5401 262CC94D D8A20C00 45435500 3500001F 45435500 3F88623A 16014150 5000434F 4E001100 00000472 656D6F
/// --------------------------------------------
/// storage-header: 444C5401 262CC94D D8A20C00 45435500
///     444C5401 = DLT + 0x01 (DLT Pattern)
///  timestamp_sec: 262CC94D = 0x4DC92C26
///  timestamp_us: D8A20C00 = 0x000CA2D8
///  ecu-id: 45435500 = b"ECU\0"
///
/// 3500001F 45435500 3F88623A 16014150 5000434F 4E001100 00000472 656D6F (31 byte)
/// --------------------------------------------
/// header: 35 00 001F 45435500 3F88623A
/// header type = 0x35 = 0b0011 0101
///     UEH: 1 - > using extended header
///     MSBF: 0 - > little endian
///     WEID: 1 - > with ecu id
///     WSID: 0 - > no session id
///     WTMS: 1 - > with timestamp
/// message counter = 0x00 = 0
/// length = 001F = 31
/// ecu-id = 45435500 = "ECU "
/// timestamp = 3F88623A = 106590265.0 ms since ECU startup (~30 h)
/// --------------------------------------------
/// extended header: 16014150 5000434F 4E00
/// message-info MSIN = 0x16 = 0b0001 0110
/// 0 -> non-verbose
/// 011 (MSTP Message Type) = 0x3 = Dlt Control Message
/// 0001 (MTIN Message Type Info) = 0x1 = Request Control Message
/// number of arguments NOAR = 0x01
/// application id = 41505000 = "APP "
/// context id = 434F4E00 = "CON "
/// --------------------------------------------
/// payload: 1100 00000472 656D6F
///
#[allow(dead_code)]
pub fn dlt_message(input: &[u8]) -> IResult<&[u8], dlt::Message> {
    let (after_storage_and_normal_header, (storage_header, header)) =
        tuple((dlt_storage_header, dlt_standard_header))(input)?;

    let message_length = header.overall_length as usize;
    let headers_length = dlt::calculate_all_headers_length(header.header_type());
    if message_length < headers_length {
        eprintln!("Invalid header length");
        return Err(nom::Err::Error((
            after_storage_and_normal_header,
            nom::error::ErrorKind::Verify,
        )));
    }

    let payload_length = message_length - headers_length;

    let mut verbose: bool = false;
    let mut arg_count = 0;
    let (after_headers, extended_header) = if header.has_extended_header {
        let (rest, ext_header) = dlt_extended_header(after_storage_and_normal_header)?;
        verbose = ext_header.verbose;
        arg_count = ext_header.argument_count;
        (rest, Some(ext_header))
    } else {
        (after_storage_and_normal_header, None)
    };
    let (i, payload) = if header.big_endian {
        dlt_payload::<BigEndian>(after_headers, verbose, payload_length, arg_count)?
    } else {
        dlt_payload::<LittleEndian>(after_headers, verbose, payload_length, arg_count)?
    };
    Ok((
        i,
        dlt::Message {
            storage_header,
            header,
            extended_header,
            payload,
        },
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    use pretty_assertions::assert_eq;
    use proptest::prelude::*;
    use bytes::{BytesMut};
    use byteorder::{BigEndian};

    static VALID_ECU_ID_FORMAT: &str = "[0-9a-zA-Z]{4}";

    proptest! {
        #[test]
        fn parse_ecu_id_doesnt_crash(s in "\\PC*") {
            let _ = parse_ecu_id(s.as_bytes());
        }
        #[test]
        fn parses_all_valid_ecu_ids(s in VALID_ECU_ID_FORMAT) {
            parse_ecu_id(s.as_bytes()).unwrap();
        }
    }

    #[test]
    fn test_ecu_id_parser() {
        let expected: IResult<&[u8], &str> = Ok((&[], "ecu1"));
        assert_eq!(expected, parse_ecu_id(b"ecu1"));
        assert_eq!(
            Err(nom::Err::Incomplete(nom::Needed::Size(1))),
            parse_ecu_id(b"ecu")
        );
        let sparkle_heart = vec![0, 159, 146, 150];
        assert!(parse_ecu_id(&sparkle_heart).is_err());
    }

    fn fp_val_strategy(width32bit: bool) -> impl Strategy<Value = dlt::FixedPointValue> {
        (any::<i32>(), any::<i64>()).prop_map(move |(v32, v64)| {
            if width32bit {
                dlt::FixedPointValue::I32(v32)
            } else {
                dlt::FixedPointValue::I64(v64)
            }
        })
    }

    fn fixedpoint_strategy(
        type_info: dlt::TypeInfo,
    ) -> impl Strategy<Value = Option<dlt::FixedPoint>> {
        let (is32_bit, is_fp) = match type_info.kind {
            dlt::TypeInfoKind::Signed(dlt::TypeLength::BitLength32, fp) => (true, fp),
            dlt::TypeInfoKind::Unsigned(dlt::TypeLength::BitLength32, fp) => (true, fp),
            dlt::TypeInfoKind::Signed(dlt::TypeLength::BitLength64, fp) => (false, fp),
            dlt::TypeInfoKind::Unsigned(dlt::TypeLength::BitLength64, fp) => (false, fp),
            _ => (false, false),
        };
        (any::<f32>(), fp_val_strategy(is32_bit)).prop_map(move |(quantization, offset)| {
            if !is_fp {
                None
            } else {
                Some(dlt::FixedPoint {
                    quantization,
                    offset,
                })
            }
        })
    }

    fn argument_strategy() -> impl Strategy<Value = dlt::Argument> {
        fn has_unit_info(kind: &dlt::TypeInfoKind) -> bool {
            match kind {
                dlt::TypeInfoKind::Unsigned(_, _) => true,
                dlt::TypeInfoKind::Signed(_, _) => true,
                dlt::TypeInfoKind::Float(_) => true,
                _ => false,
            }
        }
        create_arg_strategy().prop_flat_map(|(type_info, value)| {
            (
                fixedpoint_strategy(type_info.clone()),
                "[a-zA-Z0-9]{1,4}",
                "[a-zA-Z0-9]{1,4}",
            )
                .prop_map(move |(fp, name_val, unit_val)| dlt::Argument {
                    name: if type_info.has_variable_info {
                        Some(name_val)
                    } else {
                        None
                    },
                    fixed_point: fp,
                    unit: if type_info.has_variable_info && has_unit_info(&type_info.kind) {
                        Some(unit_val)
                    } else {
                        None
                    },
                    type_info: type_info.clone(),
                    value: value.clone(),
                })
        })
    }
    fn create_arg_strategy() -> impl Strategy<Value = (dlt::TypeInfo, dlt::Value)> {
        (
            any::<dlt::TypeInfo>(),
            any::<bool>(),
            any::<u8>(),
            any::<u16>(),
            any::<u32>(),
            any::<u64>(),
            any::<u128>(),
            (
                any::<i8>(),
                any::<i16>(),
                any::<i32>(),
                any::<i64>(),
                any::<i128>(),
                any::<f32>(),
                any::<f64>(),
                ("[a-zA-Z]{1,10}", any::<Vec<u8>>()),
            ),
        )
            .prop_map(
                |(
                    ti,
                    b,
                    u8val,
                    u16val,
                    u32val,
                    u64val,
                    u128val,
                    (i8val, i16val, i32val, i64val, i128val, f32val, f64val, (stringval, vecval)),
                )| match ti.kind {
                    dlt::TypeInfoKind::Bool => (ti, dlt::Value::Bool(b)),
                    dlt::TypeInfoKind::Signed(s, _) => (
                        ti,
                        match s {
                            dlt::TypeLength::BitLength8 => dlt::Value::I8(i8val),
                            dlt::TypeLength::BitLength16 => dlt::Value::I16(i16val),
                            dlt::TypeLength::BitLength32 => dlt::Value::I32(i32val),
                            dlt::TypeLength::BitLength64 => dlt::Value::I64(i64val),
                            dlt::TypeLength::BitLength128 => dlt::Value::I128(i128val),
                        },
                    ),
                    dlt::TypeInfoKind::Unsigned(s, _) => (
                        ti,
                        match s {
                            dlt::TypeLength::BitLength8 => dlt::Value::U8(u8val),
                            dlt::TypeLength::BitLength16 => dlt::Value::U16(u16val),
                            dlt::TypeLength::BitLength32 => dlt::Value::U32(u32val),
                            dlt::TypeLength::BitLength64 => dlt::Value::U64(u64val),
                            dlt::TypeLength::BitLength128 => dlt::Value::U128(u128val),
                        },
                    ),
                    dlt::TypeInfoKind::Float(w) => (
                        ti,
                        match w {
                            dlt::FloatWidth::Width32 => dlt::Value::F32(f32val),
                            dlt::FloatWidth::Width64 => dlt::Value::F64(f64val),
                        },
                    ),
                    dlt::TypeInfoKind::StringType => (ti, dlt::Value::StringVal(stringval)),
                    dlt::TypeInfoKind::Raw => (ti, dlt::Value::Raw(vecval)),
                },
            )
    }
    proptest! {
        #[test]
        fn test_dlt_all_storage_header(header_to_expect: dlt::StorageHeader) {
            println!("header_to_expect: {}", header_to_expect);
            let mut header_bytes = header_to_expect.as_bytes();
            println!("header bytes: {:02X?}", header_bytes);
            header_bytes.extend(b"----");
            let res: IResult<&[u8], Option<dlt::StorageHeader>> = dlt_storage_header(&header_bytes);
            if let Ok((_, Some(v))) = res.clone() {
                println!("parsed header: {}", v)
            }
            let expected: IResult<&[u8], Option<dlt::StorageHeader>> =
                Ok((b"----", Some(header_to_expect)));
            assert_eq!(expected, res);
        }
        #[test]
        fn test_dlt_standard_header(header_to_expect: dlt::StandardHeader) {
            let mut header_bytes = header_to_expect.as_bytes();
            header_bytes.extend(b"----");
            let res: IResult<&[u8], dlt::StandardHeader> = dlt_standard_header(&header_bytes);
            let expected: IResult<&[u8], dlt::StandardHeader> = Ok((b"----", header_to_expect));
            assert_eq!(expected, res);
        }
        #[test]
        fn test_extended_header(header_to_expect: dlt::ExtendedHeader) {
            let mut header_bytes = header_to_expect.as_bytes();
            header_bytes.extend(b"----");
            let res: IResult<&[u8], dlt::ExtendedHeader> = dlt_extended_header(&header_bytes);
            let expected: IResult<&[u8], dlt::ExtendedHeader> = Ok((b"----", header_to_expect));
            assert_eq!(expected, res);
        }
        #[test]
        fn test_parse_type_info(type_info: dlt::TypeInfo) {
            let mut type_info_bytes = type_info.as_bytes::<BigEndian>();
            println!("{:02X?}", type_info_bytes);
            type_info_bytes.extend(b"----");
            let res: IResult<&[u8], dlt::TypeInfo> = dlt_type_info::<BigEndian>(&type_info_bytes);
            let expected: IResult<&[u8], dlt::TypeInfo> = Ok((b"----", type_info));
            assert_eq!(expected, res);
        }
        #[test]

        fn test_parse_any_argument(argument in argument_strategy()) {
            let mut argument_bytes = argument.as_bytes::<BigEndian>();
            argument_bytes.extend(b"----");
            let res: IResult<&[u8], dlt::Argument> = dlt_argument::<BigEndian>(&argument_bytes);
            let expected: IResult<&[u8], dlt::Argument> = Ok((b"----", argument));
            assert_eq!(expected, res);
        }
        #[test]
        fn test_signed_strategy(kind in dlt::unsigned_strategy()) {
            println!("signed: {:?}", kind);
        }
    }
    #[test]
    fn test_parse_offending_argument() {
        let type_info = dlt::TypeInfo {
            kind: dlt::TypeInfoKind::Signed(dlt::TypeLength::BitLength64, true),
            coding: dlt::StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let argument = dlt::Argument {
            type_info,
            name: Some("a".to_string()),
            unit: Some("a".to_string()),
            fixed_point: Some(dlt::FixedPoint {
                quantization: 1.0,
                offset: dlt::FixedPointValue::I64(1),
            }),
            value: dlt::Value::I64(-1_246_093_129_526_187_791),
        };

        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], dlt::Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], dlt::Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
    }
    #[test]
    fn test_parse_bool_argument() {
        let type_info = dlt::TypeInfo {
            kind: dlt::TypeInfoKind::Bool,
            coding: dlt::StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let argument = dlt::Argument {
            type_info,
            name: None,
            unit: None,
            fixed_point: None,
            value: dlt::Value::Bool(true),
        };
        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        println!("argument bytes: {:02X?}", argument_bytes);
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], dlt::Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], dlt::Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
        // now with variable info
        let type_info = dlt::TypeInfo {
            kind: dlt::TypeInfoKind::Bool,
            coding: dlt::StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let argument = dlt::Argument {
            type_info,
            name: Some("varname_foo".to_string()),
            unit: None,
            fixed_point: None,
            value: dlt::Value::Bool(true),
        };
        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        println!("argument bytes: {:02X?}", argument_bytes);
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], dlt::Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], dlt::Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
    }
    #[test]
    fn test_parse_unsigned_argument() {
        let type_info = dlt::TypeInfo {
            kind: dlt::TypeInfoKind::Unsigned(dlt::TypeLength::BitLength32, false),
            coding: dlt::StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let argument = dlt::Argument {
            type_info,
            name: None,
            unit: None,
            fixed_point: None,
            value: dlt::Value::U32(0x123),
        };
        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        println!("argument bytes: {:02X?}", argument_bytes);
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], dlt::Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], dlt::Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
        // now with variable info
        let type_info = dlt::TypeInfo {
            kind: dlt::TypeInfoKind::Unsigned(dlt::TypeLength::BitLength32, false),
            coding: dlt::StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let argument = dlt::Argument {
            type_info,
            name: Some("speed".to_string()),
            unit: Some("mph".to_string()),
            fixed_point: None,
            value: dlt::Value::U32(0x123),
        };
        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        println!("argument bytes: {:02X?}", argument_bytes);
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], dlt::Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], dlt::Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
    }
    #[test]
    fn test_parse_signed_argument() {
        let type_info = dlt::TypeInfo {
            kind: dlt::TypeInfoKind::Signed(dlt::TypeLength::BitLength16, false),
            coding: dlt::StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let argument = dlt::Argument {
            type_info,
            name: None,
            unit: None,
            fixed_point: None,
            value: dlt::Value::I16(-23),
        };
        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        println!("argument bytes: {:02X?}", argument_bytes);
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], dlt::Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], dlt::Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
        // now with variable info
        let type_info = dlt::TypeInfo {
            kind: dlt::TypeInfoKind::Signed(dlt::TypeLength::BitLength32, false),
            coding: dlt::StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let argument = dlt::Argument {
            type_info,
            name: Some("temperature".to_string()),
            unit: Some("celcius".to_string()),
            fixed_point: None,
            value: dlt::Value::I32(-23),
        };
        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        println!("argument bytes: {:02X?}", argument_bytes);
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], dlt::Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], dlt::Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
    }
    #[test]
    fn test_parse_float_argument() {
        let type_info = dlt::TypeInfo {
            kind: dlt::TypeInfoKind::Float(dlt::FloatWidth::Width32),
            coding: dlt::StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let argument = dlt::Argument {
            type_info,
            name: None,
            unit: None,
            fixed_point: None,
            value: dlt::Value::F32(123.98f32),
        };
        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        println!("argument bytes: {:02X?}", argument_bytes);
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], dlt::Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], dlt::Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
        // now with variable info
        let type_info = dlt::TypeInfo {
            kind: dlt::TypeInfoKind::Float(dlt::FloatWidth::Width64),
            coding: dlt::StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let argument = dlt::Argument {
            type_info,
            name: Some("temperature".to_string()),
            unit: Some("celcius".to_string()),
            fixed_point: None,
            value: dlt::Value::F64(28.3),
        };
        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        println!("argument bytes: {:02X?}", argument_bytes);
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], dlt::Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], dlt::Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
    }
    #[test]
    fn test_parse_raw_argument() {
        let type_info = dlt::TypeInfo {
            kind: dlt::TypeInfoKind::Raw,
            coding: dlt::StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let argument = dlt::Argument {
            type_info,
            name: None,
            unit: None,
            fixed_point: None,
            value: dlt::Value::Raw(vec![0xD, 0xE, 0xA, 0xD]),
        };
        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], dlt::Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], dlt::Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
        // now with variable info
        let type_info = dlt::TypeInfo {
            kind: dlt::TypeInfoKind::Raw,
            coding: dlt::StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let argument = dlt::Argument {
            type_info,
            name: Some("payload".to_string()),
            unit: None,
            fixed_point: None,
            value: dlt::Value::Raw(vec![0xD, 0xE, 0xA, 0xD]),
        };
        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        println!("argument bytes raw: {:02X?}", argument_bytes);
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], dlt::Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], dlt::Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
    }
    #[test]
    fn test_parse_string_argument() {
        let type_info = dlt::TypeInfo {
            kind: dlt::TypeInfoKind::StringType,
            coding: dlt::StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let argument = dlt::Argument {
            type_info,
            name: None,
            unit: None,
            fixed_point: None,
            value: dlt::Value::StringVal("foo".to_string()),
        };
        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        println!("argument bytes: {:02X?}", argument_bytes);
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], dlt::Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], dlt::Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
    }
    #[test]
    fn test_dlt_message_parsing() {
        let raw1: Vec<u8> = vec![
            // storage header
            0x44, 0x4C, 0x54, 0x01, 0x56, 0xA2, 0x91, 0x5C, 0x9C, 0x91, 0x0B, 0x00, 0x45, 0x43,
            0x55, 0x31, // header
            0x3D, // header type 0b11 1101
            0x40, 0x00, 0xA2, 0x45, 0x43, 0x55, 0x31, // ecu id
            0x00, 0x00, 0x01, 0x7F, // session id
            0x00, 0x5B, 0xF7, 0x16, // timestamp
            // extended header
            0x51, // MSIN 0b101 0001 => verbose, MST log,
            0x06, // arg count
            0x56, 0x53, 0x6F, 0x6D, // app id VSom
            0x76, 0x73, 0x73, 0x64, // context id vssd
            // arguments
            // 0x00, 0x82, 0x00, 0x00, // type info 0b1000001000000000
            // 0x3A, 0x00,
            // 0x5B, 0x33, 0x38, 0x33, 0x3A, 0x20, 0x53, 0x65,
            // 0x72, 0x76, 0x69, 0x63, 0x65, 0x44, 0x69, 0x73, 0x63, 0x6F, 0x76, 0x65, 0x72, 0x79,
            // 0x55, 0x64, 0x70, 0x45, 0x6E, 0x64, 0x70, 0x6F, 0x69, 0x6E, 0x74, 0x28, 0x31, 0x36,
            // 0x30, 0x2E, 0x34, 0x38, 0x2E, 0x31, 0x39, 0x39, 0x2E, 0x31, 0x30, 0x32, 0x3A, 0x35,
            // 0x30, 0x31, 0x35, 0x32, 0x29, 0x5D, 0x20, 0x00,
            0x00, 0x82, 0x00, 0x00, // type info 0b1000001000000000
            0x0F, 0x00, // length
            0x50, 0x72, 0x6F, 0x63, 0x65, 0x73, 0x73, 0x4D, 0x65, 0x73, 0x73, 0x61, 0x67, 0x65,
            0x00, // "ProcessMessage"
            0x00, 0x82, 0x00, 0x00, // type info 0b1000001000000000
            0x02, 0x00, // length
            0x3A, 0x00, // ":"
            0x23, 0x00, 0x00, 0x00, // type info 0b10000000001000010
            0x0D, 0x01, 0x00, 0x00, 0x00, 0x82, 0x00, 0x00, 0x03, 0x00, 0x3A, 0x20, 0x00, 0x00,
            0x82, 0x00, 0x00, 0x14, 0x00, 0x31, 0x36, 0x30, 0x2E, 0x34, 0x38, 0x2E, 0x31, 0x39,
            0x39, 0x2E, 0x31, 0x36, 0x2C, 0x33, 0x30, 0x35, 0x30, 0x31, 0x00,
        ];
        let raw: Vec<u8> = vec![
            0x44, 0x4C, 0x54, 0x01, 0x56, 0xA2, 0x91, 0x5C, 0x9C, 0x91, 0x0B, 0x00, 0x45, 0x43,
            0x55, 0x31, 0x3D, 0x41, 0x00, 0xA9, 0x45, 0x43, 0x55, 0x31, 0x00, 0x00, 0x01, 0x7F,
            0x00, 0x5B, 0xF7, 0x16, 0x51, 0x09, 0x56, 0x53, 0x6F, 0x6D, 0x76, 0x73, 0x73, 0x64,
            0x00, 0x82, 0x00, 0x00, 0x3A, 0x00, 0x5B, 0x33, 0x38, 0x33, 0x3A, 0x20, 0x53, 0x65,
            0x72, 0x76, 0x69, 0x63, 0x65, 0x44, 0x69, 0x73, 0x63, 0x6F, 0x76, 0x65, 0x72, 0x79,
            0x55, 0x64, 0x70, 0x45, 0x6E, 0x64, 0x70, 0x6F, 0x69, 0x6E, 0x74, 0x28, 0x31, 0x36,
            0x30, 0x2E, 0x34, 0x38, 0x2E, 0x31, 0x39, 0x39, 0x2E, 0x31, 0x30, 0x32, 0x3A, 0x35,
            0x30, 0x31, 0x35, 0x32, 0x29, 0x5D, 0x20, 0x00, 0x00, 0x82, 0x00, 0x00, 0x0F, 0x00,
            0x50, 0x72, 0x6F, 0x63, 0x65, 0x73, 0x73, 0x4D, 0x65, 0x73, 0x73, 0x61, 0x67, 0x65,
            0x00, 0x00, 0x82, 0x00, 0x00, 0x02, 0x00, 0x3A, 0x00, 0x23, 0x00, 0x00, 0x00, 0x24,
            0x01, 0x00, 0x00, 0x00, 0x82, 0x00, 0x00, 0x06, 0x00, 0x3A, 0x20, 0x28, 0x30, 0x78,
            0x00, 0x42, 0x00, 0x01, 0x00, 0x36, 0x15, 0x00, 0x82, 0x00, 0x00, 0x04, 0x00, 0x2C,
            0x30, 0x78, 0x00, 0x42, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x82, 0x00, 0x00, 0x02,
            0x00, 0x29, 0x00,
        ];
        let res1: IResult<&[u8], dlt::Message> = dlt_message(&raw1[..]);
        println!("res1 was: {:?}", res1);
        let res: IResult<&[u8], dlt::Message> = dlt_message(&raw[..]);
        println!("res was: {:?}", res);
    }
    #[test]
    fn test_parse_fixed_point_argument() {
        let type_info = dlt::TypeInfo {
            kind: dlt::TypeInfoKind::Signed(dlt::TypeLength::BitLength32, true),
            coding: dlt::StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let argument = dlt::Argument {
            type_info,
            name: Some("speed".to_string()),
            unit: Some("mph".to_string()),
            value: dlt::Value::I32(-44),
            fixed_point: Some(dlt::FixedPoint {
                quantization: 1.5,
                offset: dlt::FixedPointValue::I32(-200),
            }),
        };
        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        println!("argument bytes: {:02X?}", argument_bytes);
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], dlt::Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], dlt::Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
    }
    #[test]
    fn test_dlt_zero_terminated_string_exact() {
        let mut buf = BytesMut::with_capacity(4);
        buf.extend_from_slice(b"id42");
        let res: IResult<&[u8], &str> = dlt_zero_terminated_string(&buf, 4);
        let expected: IResult<&[u8], &str> = Ok((&[], "id42"));
        assert_eq!(expected, res);
    }
    #[test]
    fn test_dlt_zero_terminated_string_more_data() {
        let mut buf = BytesMut::with_capacity(6);
        buf.extend_from_slice(b"id42++");
        let res: IResult<&[u8], &str> = dlt_zero_terminated_string(&buf, 4);
        let expected: IResult<&[u8], &str> = Ok((b"++", "id42"));
        assert_eq!(expected, res);
    }
    #[test]
    fn test_dlt_zero_terminated_string_less_data() {
        let mut buf = BytesMut::with_capacity(4);
        buf.extend_from_slice(b"id\0");
        assert_eq!(
            Err(nom::Err::Incomplete(nom::Needed::Size(1))),
            dlt_zero_terminated_string(&buf, 4)
        );
        buf.clear();
        buf.extend_from_slice(b"id\0\0");
        let expected: IResult<&[u8], &str> = Ok((b"", "id"));
        assert_eq!(expected, dlt_zero_terminated_string(&buf, 4));
    }
    #[test]
    fn test_dlt_zero_terminated_string_early_terminated() {
        let mut buf = BytesMut::with_capacity(4);
        buf.extend_from_slice(b"id4\0somethingelse");
        let res: IResult<&[u8], &str> = dlt_zero_terminated_string(&buf, 4);
        println!("res : {:?}", res);
        let expected: IResult<&[u8], &str> = Ok((b"somethingelse", "id4"));
        assert_eq!(expected, res);
    }
    #[test]
    fn test_dlt_zero_terminated_string_non_utf8() {
        let mut buf = BytesMut::with_capacity(4);
        let sparkle_heart = vec![0, 159, 146, 150];
        buf.extend_from_slice(&sparkle_heart);
        let res: IResult<&[u8], &str> = dlt_zero_terminated_string(&buf, 4);
        assert!(res.is_err());
    }

}
