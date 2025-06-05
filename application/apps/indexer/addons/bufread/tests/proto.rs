/*
    Contains a pseudo protocol for testing, with packages consisting of
    an u16 header with the length of the payload after the header
    providing a total packet length within the range of
    size_of::<u16>() to size_of::<u16>() + u16::MAX bytes.
*/

use bufread::BufReader;
use rand::prelude::*;
use std::{
    io::{BufRead, Result},
    mem::size_of,
};

/// The fixed header length of the protocol.
pub const HEADER_LEN: usize = size_of::<u16>();
/// The maximum payload length of the protocol.
const MAX_PAYLOAD_LEN: usize = u16::MAX as usize;
/// The maximum packet length of the protocol.
pub const MAX_PACKET_LEN: usize = HEADER_LEN + MAX_PAYLOAD_LEN;

/// A source for pseudo protocol packages.
pub struct Source {
    data: Vec<u8>,
    num_packets: usize,
}

impl Source {
    /// Creates a new source with a deterministic package layout and adds packages
    /// until reaching at least the given minimal data size.
    pub fn fixed(min_size: usize) -> Self {
        let mut data = Vec::new();
        let mut num_packets = 0;

        while data.len() < min_size {
            let payload_len = num_packets % 1024;
            data.append(&mut Self::create_packet(payload_len));
            num_packets += 1;
        }

        Source { data, num_packets }
    }

    /// Creates a new source with a random package layout and adds packages
    /// until reaching at least the given minimal data size.
    pub fn random(min_size: usize) -> Self {
        let mut data = Vec::new();
        let mut num_packets = 0;

        while data.len() < min_size {
            let payload_len: usize = rand::rng().random_range(0..MAX_PAYLOAD_LEN);
            data.append(&mut Self::create_packet(payload_len));
            num_packets += 1;
        }

        Source { data, num_packets }
    }

    /// Creates a new packet with the given payload length.
    fn create_packet(payload_len: usize) -> Vec<u8> {
        assert!(payload_len <= MAX_PAYLOAD_LEN);

        let packet_len = HEADER_LEN + payload_len;
        let mut packet: Vec<u8> = vec![0; packet_len];

        let header = (payload_len as u16).to_be_bytes().to_vec();
        packet[0] = header[0];
        packet[1] = header[1];

        rand::rng().fill_bytes(&mut packet[HEADER_LEN..]);
        packet
    }

    /// Returns the contained data slice.
    pub fn data(&self) -> &[u8] {
        self.data.as_slice()
    }

    /// Returns the length of the contained data.
    pub fn data_len(&self) -> usize {
        self.data.len()
    }

    /// Returns the number of the contained packages.
    pub fn num_packets(&self) -> usize {
        self.num_packets
    }
}

/// A parser for pseudo protocol packages.
pub struct Parser<'a> {
    reader: BufReader<&'a [u8]>,
}

impl<'a> Parser<'a> {
    /// Creates a new parser for the given source.
    pub fn new(reader: BufReader<&'a [u8]>) -> Self {
        Parser { reader }
    }

    /// Parses the next package from the source, if available.
    ///
    /// Returns the total length of the package being parsed, or
    /// a zero-length if at EOF.
    pub fn next_package(&mut self) -> Result<usize> {
        let buffer = self.reader.fill_buf()?;
        if buffer.is_empty() {
            return Ok(0);
        }

        let mut header = [0; HEADER_LEN];
        header[0] = buffer[0];
        header[1] = buffer[1];

        let payload_len = u16::from_be_bytes(header) as usize;
        let packet_len = HEADER_LEN + payload_len;
        self.reader.consume(packet_len);

        Ok(packet_len)
    }

    /// Runs a parser and returns the total number of packets and bytes being read.
    pub fn run(parser: &mut Parser) -> Result<(usize, usize)> {
        let mut result: (usize, usize) = (0, 0);

        loop {
            let size = parser.next_package()?;
            if size == 0 {
                break;
            }

            result.0 += 1;
            result.1 += size;
        }

        Ok(result)
    }
}
