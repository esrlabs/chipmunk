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
        unimplemented!()
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
    unimplemented!()
}