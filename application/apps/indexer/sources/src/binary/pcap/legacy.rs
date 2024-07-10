use crate::{
    binary::pcap::debug_block, ByteSource, Error as SourceError, ReloadInfo, SourceFilter,
    TransportProtocol,
};
use buf_redux::Buffer;
use log::{debug, error, trace};
use pcap_parser::{traits::PcapReaderIterator, LegacyPcapReader, PcapBlockOwned, PcapError};
use std::io::Read;

pub struct PcapLegacyByteSource<R: Read> {
    pcap_reader: LegacyPcapReader<R>,
    buffer: Buffer,
    last_know_timestamp: Option<u64>,
    total: usize,
}

impl<R: Read> PcapLegacyByteSource<R> {
    pub fn new(reader: R) -> Result<Self, SourceError> {
        Ok(Self {
            pcap_reader: LegacyPcapReader::new(65536, reader)
                .map_err(|e| SourceError::Setup(format!("{e}")))?,
            buffer: Buffer::new(),
            last_know_timestamp: None,
            total: 0,
        })
    }
}

impl<R: Read + Send + Sync> ByteSource for PcapLegacyByteSource<R> {
    async fn reload(
        &mut self,
        filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        let raw_data;
        let mut consumed;
        let mut skipped = 0usize;
        loop {
            match self.pcap_reader.next() {
                Ok((bytes_read, block)) => {
                    self.total += bytes_read;
                    trace!(
                        "PcapByteSource::reload, bytes_read: {} (total: {})",
                        bytes_read,
                        self.total
                    );
                    consumed = bytes_read;
                    match block {
                        PcapBlockOwned::LegacyHeader(ref hdr) => {
                            println!("LegacyHeader {:?}", hdr);
                            self.pcap_reader.consume(consumed);
                            continue;
                        }
                        PcapBlockOwned::Legacy(ref b) => {
                            println!("Legacy: {:?}", b);
                            raw_data = &b.data[..b.origlen as usize];
                            break;
                        }
                        other_type => {
                            debug_block(other_type);
                            skipped += consumed;
                            debug!("skipped in total {} bytes", skipped);
                            self.pcap_reader.consume(consumed);
                            continue;
                        }
                    }
                }
                Err(PcapError::Eof) => {
                    debug!("reloading from pcap file, EOF");
                    return Ok(None);
                }
                Err(PcapError::Incomplete) => {
                    trace!("reloading from pcap file, Incomplete");
                    self.pcap_reader
                        .refill()
                        .expect("refill pcap reader failed");
                    // continue;
                }
                Err(e) => {
                    let m = format!("{e}");
                    error!("reloading from pcap file, {}", m);
                    return Err(SourceError::Unrecoverable(m));
                }
            }
        }
        let res = match etherparse::SlicedPacket::from_ethernet(raw_data) {
            Ok(value) => {
                skipped += consumed - value.payload.len();
                match (value.transport, filter) {
                    (
                        Some(actual),
                        Some(SourceFilter {
                            transport: Some(wanted),
                        }),
                    ) => {
                        let actual_tp: TransportProtocol = actual.into();
                        let received_bytes = self.buffer.copy_from_slice(value.payload);
                        if actual_tp == *wanted {
                            Ok(Some(ReloadInfo::new(
                                received_bytes,
                                // BUG: This should represent all available bytes in `self.buffer`.
                                // This assumes that the buffer will be empty on each parse call
                                // which will fail silently when parser implementing changes.
                                received_bytes,
                                skipped,
                                self.last_know_timestamp,
                            )))
                        } else {
                            Ok(Some(ReloadInfo::new(
                                0,
                                0,
                                value.payload.len() + skipped,
                                self.last_know_timestamp,
                            )))
                        }
                    }
                    _ => {
                        let copied = self.buffer.copy_from_slice(value.payload);
                        Ok(Some(ReloadInfo::new(
                            copied,
                            // BUG: Same as above.
                            copied,
                            skipped,
                            self.last_know_timestamp,
                        )))
                    }
                }
            }
            Err(e) => Err(SourceError::Unrecoverable(format!(
                "error trying to extract data from ethernet frame: {e}"
            ))),
        };
        // bytes are copied into buffer and can be dropped by pcap reader
        trace!("consume {} processed bytes", consumed);
        self.pcap_reader.consume(consumed);
        res
    }

    fn current_slice(&self) -> &[u8] {
        self.buffer.buf()
    }

    fn consume(&mut self, offset: usize) {
        self.buffer.consume(offset);
    }

    fn len(&self) -> usize {
        self.buffer.len()
    }
}

#[cfg(test)]
mod tests {
    use env_logger;

    use crate::{
        binary::pcap::legacy::PcapLegacyByteSource,
        tests::{general_source_reload_test, MockRepeatRead},
        ByteSource,
    };

    const SAMPLE_PCAP_DATA: &[u8] = &[
        0xd4, 0xc3, 0xb2, 0xa1, // Magic Number (4 bytes) = d4 c3 b2 a1
        0x02, 0x00, // Version Major (2 bytes) = 02 00
        0x04, 0x00, // Version Minor (2 bytes) = 04 00
        0x00, 0x00, 0x00, 0x00, // Timezone (4 bytes) = 00 00 00 00
        0x00, 0x00, 0x00, 0x00, // Timestamp Accuracy (4 bytes) = 00 00 00 00
        0x00, 0x00, 0x04, 0x00, // Snap Length (4 bytes)
        0x01, 0x00, 0x00, 0x00, // Link-Layer Type (4 bytes)
        // Packet Header 16 byte
        0xeb, 0x15, 0x88, 0x60, 0xe6, 0x7f, 0x04, 0x00, 0x62, 0x00, 0x00, 0x00, 0x62, 0x00, 0x00,
        0x00, //
        // start of ethernet packet -------------------
        0xb8, 0x27, 0xeb, 0x1d, 0x24, 0xc9, 0xb8, 0x27, 0xeb, 0x98, 0x94, 0xfa, 0x08, 0x00, 0x45,
        0x00, 0x00, 0x54, 0xa0, 0x48, 0x40, 0x00, 0x40, 0x11, 0x29, 0x85, 0xac, 0x16, 0x0c, 0x4f,
        0xac, 0x16, 0x0c, 0x50, // start of udp frame  -------------------------
        0xc3, 0x50, 0xc3, 0x50, 0x00, 0x40, 0x8e, 0xe3, //
        // start of udp payload 56 bytes ---------------------------
        0xff, 0xff, 0x81, 0x00, 0x00, 0x00, 0x00, 0x30, 0x00, 0x00, 0x00, 0x01, 0x01, 0x01, 0x02,
        0x00, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x01, 0x00, 0x00, 0x10, 0x01, 0x03,
        0x00, 0x01, 0x01, 0x00, 0x00, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x00,
        0x09, 0x04, 0x00, 0xac, 0x16, 0x0c, 0x4f, 0x00, 0x11, 0x75, 0x30,
    ];

    #[tokio::test]
    async fn test_read_one_message_from_pcap() {
        let _ = env_logger::try_init();

        let udp_payload = &SAMPLE_PCAP_DATA[82..=137];
        let pcap_file = std::io::Cursor::new(SAMPLE_PCAP_DATA);

        let mut source = PcapLegacyByteSource::new(pcap_file).expect("cannot create source");
        let reload_info = source.reload(None).await.expect("reload should work");
        println!("reload_info: {:?}", reload_info);
        let slice = source.current_slice();
        println!("slice: {:x?}", slice);
        assert_eq!(slice.len(), 56);
        assert_eq!(slice, udp_payload);
    }

    #[tokio::test]
    async fn test_general_source_reload() {
        let reader = MockRepeatRead::new(SAMPLE_PCAP_DATA.to_vec());
        let mut source = PcapLegacyByteSource::new(reader).unwrap();

        general_source_reload_test(&mut source).await;
    }
}
