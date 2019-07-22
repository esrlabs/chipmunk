use crate::dlt;

use dlt::TryFrom;
use tokio::codec::{Decoder, Encoder};
use bytes::{Buf, ByteOrder, Bytes, BytesMut, IntoBuf};
use std::io::{Error, Read};
use std::io;
use byteorder::{BigEndian, LittleEndian, ReadBytesExt};
use log::warn;
use std::fmt::{Write};
use std::str;

#[derive(Default)]
pub struct Codec;

#[derive(Default)]
pub struct DltFileCodec {
    dlt_codec: Codec,
}
impl Decoder for DltFileCodec {
    type Item = dlt::Message;
    type Error = Error;
    fn decode(&mut self, src: &mut BytesMut) -> Result<Option<Self::Item>, Self::Error> {
        let storage_header = decode_storage_header(src)?;
        let msg = self.dlt_codec.decode(src)?;
        match msg {
            Some(inner) => Ok(Some(dlt::Message {
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
    type Item = dlt::Message;
    type Error = Error;

    fn encode(&mut self, msg: Self::Item, dest: &mut BytesMut) -> Result<(), Self::Error> {
        // Messages without extended header (non-verbose) are unimplemented
        if let Some(ext) = msg.extended_header {
            let _level = match ext.message_type {
                dlt::MessageType::Log(level) => level.into(),
                dlt::MessageType::ApplicationTrace(_) | dlt::MessageType::NetworkTrace(_) => {
                    log::Level::Trace
                }
                // Ignore everything else
                _ => return Ok(()),
            };

            dest.reserve(1024); // TODO reserve correct amount
                                // Format message: Join arguments as strings
            if let dlt::Payload::Verbose(arguments) = msg.payload {
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
                .map_err(|e| Error::new(io::ErrorKind::Other, e))?;

                // Format payload
                arguments
                    .iter()
                    .try_for_each(|arg| write!(dest, " {}", arg))
                    .map_err(|e| Error::new(io::ErrorKind::Other, e))?;
            }
            writeln!(dest).map_err(|e| Error::new(io::ErrorKind::Other, e))
        } else {
            Ok(())
        }
    }
}
impl Decoder for Codec {
    type Item = dlt::Message;
    type Error = Error;

    fn decode(&mut self, src: &mut BytesMut) -> Result<Option<Self::Item>, Self::Error> {
        let mut buf = Bytes::from(src.as_ref()).into_buf();

        if buf.remaining() < dlt::HEADER_MIN_LENGTH {
            return Ok(None);
        }
        let header_type = buf.get_u8();
        let message_counter = buf.get_u8();
        let overall_message_length = buf.get_u16_be() as usize;

        let headers_length = dlt::calculate_all_headers_length(header_type);
        if overall_message_length < headers_length {
            return Err(Error::new(io::ErrorKind::Other, "Invalid header length"));
        }

        if buf.remaining() + dlt::HEADER_MIN_LENGTH < overall_message_length {
            return Ok(None);
        }

        let message = decode_message(
            &mut buf,
            header_type,
            message_counter,
            overall_message_length,
            headers_length,
        )
        .map(Option::Some)
        .unwrap_or_else(|e| {
            warn!("Failed to parse message: {}", e);
            None
        });
        src.advance(overall_message_length);
        Ok(message)
    }
}

impl Encoder for Codec {
    type Item = dlt::Message;
    type Error = Error;

    fn encode(&mut self, _: Self::Item, _: &mut BytesMut) -> Result<(), Self::Error> {
        unimplemented!()
    }
}

fn decode_message(
    buf: &mut dyn Buf,
    header_type: u8,
    message_counter: u8,
    overall_message_length: usize,
    headers_length: usize,
) -> Result<dlt::Message, Error> {
    let header = decode_header(
        buf,
        header_type,
        message_counter,
        overall_message_length as u16,
    )?;

    let (verbose, arg_count, extended_header) = if header.has_extended_header {
        let ext_header = decode_extended_header(buf)?;
        (
            ext_header.verbose,
            ext_header.argument_count,
            Some(ext_header),
        )
    } else {
        (false, 0, None)
    };

    let payload_length = overall_message_length - headers_length;

    let payload = if header.big_endian {
        decode_payload::<BigEndian>(buf, verbose, arg_count as usize, payload_length)
    } else {
        decode_payload::<LittleEndian>(buf, verbose, arg_count as usize, payload_length)
    }?;

    Ok(dlt::Message {
        storage_header: None,
        header,
        extended_header,
        payload,
    })
}

fn decode_payload<T: ByteOrder>(
    buf: &mut dyn Buf,
    verbose: bool,
    arg_count: usize,
    payload_length: usize,
) -> Result<dlt::Payload, Error> {
    if !verbose {
        let message_id = buf.reader().read_u32::<T>()?;
        let payload = buf.bytes()[..(payload_length - 4)].to_vec();
        Ok(dlt::Payload::NonVerbose(message_id, payload))
    } else {
        let mut arguments = Vec::with_capacity(arg_count);
        for _ in 0..arg_count {
            let arg = decode_argument::<T>(buf)?;
            arguments.push(arg);
        }

        Ok(dlt::Payload::Verbose(arguments))
    }
}
fn decode_storage_header(src: &mut BytesMut) -> Result<Option<dlt::StorageHeader>, Error> {
    let mut buf = Bytes::from(src.as_ref()).into_buf();
    if buf.remaining() < dlt::STORAGE_HEADER_PATTERN_LENGTH {
        return Ok(None);
    }
    // read dlt storage header
    let byte_1 = buf.get_u8();
    let byte_2 = buf.get_u8();
    let byte_3 = buf.get_u8();
    let byte_4 = buf.get_u8();
    let has_storage_header = byte_1 == 0x44 && byte_2 == 0x4C && byte_3 == 0x54 && byte_4 == 0x01; // "DLT" + 0x01

    if has_storage_header {
        if buf.remaining() < (dlt::STORAGE_HEADER_LENGTH - dlt::STORAGE_HEADER_PATTERN_LENGTH) {
            return Ok(None); // we swallow an error in the dlt file
        }
        let timestamp_s = buf.get_u32_be();
        let timestamp_ms = buf.get_u32_be();
        let mut ecu_id = [0u8; 4];
        buf.read_exact(&mut ecu_id)?;
        let ecuid = str::from_utf8(&ecu_id).map_err(|e| Error::new(io::ErrorKind::Other, e))?;
        src.advance(dlt::STORAGE_HEADER_LENGTH);
        Ok(Some(dlt::StorageHeader {
            timestamp: dlt::DltTimeStamp {
                seconds: timestamp_s,
                microseconds: timestamp_ms * 1000,
            },
            ecu_id: ecuid.to_string(),
        }))
    } else {
        Ok(None)
    }
}

fn decode_header(
    buf: &mut dyn Buf,
    header_type: u8,
    message_counter: u8,
    overall_message_length: u16,
) -> Result<dlt::StandardHeader, Error> {
    let ecu_id = if (header_type & dlt::WITH_ECU_ID_FLAG) != 0 {
        let ecu_id = Some(dlt::zero_terminated_string(&buf.bytes()[..4])?);
        buf.advance(4);
        ecu_id
    } else {
        None
    };

    let session_id = if (header_type & dlt::WITH_SESSION_ID_FLAG) != 0 {
        Some(buf.get_u32_be())
    } else {
        None
    };

    let timestamp = if (header_type & dlt::WITH_TIMESTAMP_FLAG) != 0 {
        Some(buf.get_u32_be())
    } else {
        None
    };

    Ok(dlt::StandardHeader {
        version: header_type >> 5 & 0b111,
        has_extended_header: (header_type & dlt::WITH_EXTENDED_HEADER_FLAG) != 0,
        big_endian: (header_type & dlt::BIG_ENDIAN_FLAG) != 0,
        message_counter,
        overall_length: overall_message_length,
        ecu_id,
        session_id,
        timestamp,
    })
}

fn decode_extended_header(buf: &mut dyn Buf) -> Result<dlt::ExtendedHeader, Error> {
    let message_info = buf.get_u8();
    let argument_count = buf.get_u8();
    let application_id = dlt::zero_terminated_string(&buf.bytes()[..4])?;
    buf.advance(4);
    let context_id = dlt::zero_terminated_string(&buf.bytes()[..4])?;
    buf.advance(4);

    let verbose = (message_info & dlt::VERBOSE_FLAG) != 0;
    let message_type = dlt::MessageType::try_from(message_info)?;
    let extended_header = dlt::ExtendedHeader {
        verbose,
        argument_count,
        message_type,
        application_id,
        context_id,
    };

    Ok(extended_header)
}

fn decode_variable_name<T: ByteOrder>(
    rdr: &mut dyn Read,
    with_variable_info: bool,
) -> Result<Option<String>, Error> {
    if with_variable_info {
        let size = rdr.read_u16::<T>()?;
        let mut raw = vec![0; size as usize];
        rdr.read_exact(&mut raw)?;
        Ok(Some(dlt::zero_terminated_string(&raw)?))
    } else {
        Ok(None)
    }
}

fn decode_variable_info<T: ByteOrder>(
    rdr: &mut dyn Read,
    with_variable_info: bool,
) -> Result<(Option<String>, Option<String>), Error> {
    if with_variable_info {
        let name_size = rdr.read_u16::<T>()?;
        let unit_size = rdr.read_u16::<T>()?;

        let mut raw = vec![0; name_size as usize];
        rdr.read_exact(&mut raw)?;
        let name = dlt::zero_terminated_string(&raw)?;

        let mut raw = vec![0; unit_size as usize];
        rdr.read_exact(&mut raw)?;
        let unit = dlt::zero_terminated_string(&raw)?;

        Ok((Some(name), Some(unit)))
    } else {
        Ok((None, None))
    }
}

fn decode_argument<T: ByteOrder>(buf: &mut dyn Buf) -> Result<dlt::Argument, Error> {
    let mut rdr = buf.reader();

    let info = rdr.read_u32::<T>()?;
    let type_info = dlt::TypeInfo::try_from(info)?;
    let with_variable_info = type_info.has_variable_info;

    let arg = if type_info.is_fixed_point() {
        return Err(Error::new(
            io::ErrorKind::Other,
            "Fixed point is not implemented",
        ));
    } else {
        match type_info.kind {
            // dlt::TypeInfoKind::Array => {
            //     return Err(Error::new(
            //         io::ErrorKind::Other,
            //         "Arrays are not implemented",
            //     ));
            // }
            dlt::TypeInfoKind::Bool => {
                let name = decode_variable_name::<T>(&mut rdr, with_variable_info)?;
                dlt::Argument {
                    name,
                    unit: None,
                    value: dlt::Value::Bool(rdr.read_u8()? != 0),
                    fixed_point: None,
                    type_info,
                }
            }
            dlt::TypeInfoKind::Signed(len, _fp) => {
                // implementation for fixed point missing
                let (name, unit) = decode_variable_info::<T>(&mut rdr, with_variable_info)?;

                let value = match len {
                    dlt::TypeLength::BitLength8 => rdr.read_i8().map(dlt::Value::I8)?,
                    dlt::TypeLength::BitLength16 => rdr.read_i16::<T>().map(dlt::Value::I16)?,
                    dlt::TypeLength::BitLength32 => rdr.read_i32::<T>().map(dlt::Value::I32)?,
                    dlt::TypeLength::BitLength64 => rdr.read_i64::<T>().map(dlt::Value::I64)?,
                    dlt::TypeLength::BitLength128 => rdr.read_i128::<T>().map(dlt::Value::I128)?,
                };
                dlt::Argument {
                    name,
                    unit,
                    value,
                    fixed_point: None,
                    type_info,
                }
            }
            dlt::TypeInfoKind::Unsigned(len, _fp) => {
                // implementation for fixed point missing
                let (name, unit) = decode_variable_info::<T>(&mut rdr, with_variable_info)?;

                let value = match len {
                    dlt::TypeLength::BitLength8 => rdr.read_u8().map(dlt::Value::U8)?,
                    dlt::TypeLength::BitLength16 => rdr.read_u16::<T>().map(dlt::Value::U16)?,
                    dlt::TypeLength::BitLength32 => rdr.read_u32::<T>().map(dlt::Value::U32)?,
                    dlt::TypeLength::BitLength64 => rdr.read_u64::<T>().map(dlt::Value::U64)?,
                    dlt::TypeLength::BitLength128 => rdr.read_u128::<T>().map(dlt::Value::U128)?,
                };
                dlt::Argument {
                    name,
                    unit,
                    value,
                    fixed_point: None,
                    type_info,
                }
            }
            dlt::TypeInfoKind::StringType => {
                let size = rdr.read_u16::<T>()?;
                let name = decode_variable_name::<T>(&mut rdr, with_variable_info)?;

                let mut raw = vec![0; size as usize];
                rdr.read_exact(&mut raw)?;
                let value = dlt::zero_terminated_string(&raw)?;

                dlt::Argument {
                    name,
                    unit: None,
                    value: dlt::Value::StringVal(value),
                    fixed_point: None,
                    type_info,
                }
            }
            _ => {
                return Err(Error::new(io::ErrorKind::Other, "Unknown argument type"));
            }
        }
    };

    Ok(arg)
}
