use crate::{
    ByteSource, Error as SourceError, ReloadInfo, SourceFilter, TransportProtocol,
    binary::pcap::debug_block,
};
use bufread::DeqBuffer;
use etherparse::{SlicedPacket, TransportSlice};
use log::{debug, error, trace};
use pcap_parser::{LegacyPcapReader, PcapBlockOwned, PcapError, traits::PcapReaderIterator};
use std::io::Read;

pub struct PcapLegacyByteSource<R: Read> {
    pcap_reader: LegacyPcapReader<R>,
    buffer: DeqBuffer,
    last_know_timestamp: Option<u64>,
    total: usize,
}

impl<R: Read> PcapLegacyByteSource<R> {
    pub fn new(reader: R) -> Result<Self, SourceError> {
        Ok(Self {
            pcap_reader: LegacyPcapReader::new(65536, reader)
                .map_err(|e| SourceError::Setup(format!("{e}")))?,
            buffer: DeqBuffer::new(8192),
            last_know_timestamp: None,
            total: 0,
        })
    }
}

impl<R: Read + Send + Sync> ByteSource for PcapLegacyByteSource<R> {
    async fn load(
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
                        bytes_read, self.total
                    );
                    consumed = bytes_read;
                    match block {
                        PcapBlockOwned::LegacyHeader(ref _hdr) => {
                            self.pcap_reader.consume(consumed);
                            continue;
                        }
                        PcapBlockOwned::Legacy(ref b) => {
                            raw_data = &b.data[..b.origlen as usize];
                            break;
                        }
                        other_type => {
                            debug_block(other_type);
                            skipped += consumed;
                            debug!("skipped in total {skipped} bytes");
                            self.pcap_reader.consume(consumed);
                            continue;
                        }
                    }
                }
                Err(PcapError::Eof) => {
                    debug!("reloading from pcap file, EOF");
                    return Ok(None);
                }
                Err(PcapError::Incomplete(size)) => {
                    trace!("reloading from pcap file, Incomplete ({size})");
                    self.pcap_reader
                        .refill()
                        .expect("refill pcap reader failed");
                    // continue;
                }
                Err(e) => {
                    let m = format!("{e}");
                    error!("reloading from pcap file, {m}");
                    return Err(SourceError::Unrecoverable(m));
                }
            }
        }
        let res = match SlicedPacket::from_ethernet(raw_data) {
            Ok(value) => {
                let payload = match &value.transport {
                    Some(TransportSlice::Icmpv4(slice)) => slice.payload(),
                    Some(TransportSlice::Icmpv6(slice)) => slice.payload(),
                    Some(TransportSlice::Udp(slice)) => slice.payload(),
                    Some(TransportSlice::Tcp(slice)) => slice.payload(),
                    None => {
                        return Err(SourceError::Unrecoverable(format!(
                            "ethernet frame with unknown payload: {raw_data:02X?}"
                        )));
                    }
                };
                skipped += consumed - payload.len();
                match (value.transport, filter) {
                    (
                        Some(actual),
                        Some(SourceFilter {
                            transport: Some(wanted),
                        }),
                    ) => {
                        let actual_tp: TransportProtocol = actual.into();
                        let received_bytes = self.buffer.write_from(payload);
                        let available_bytes = self.buffer.read_available();
                        if actual_tp == *wanted {
                            Ok(Some(ReloadInfo::new(
                                received_bytes,
                                available_bytes,
                                skipped,
                                self.last_know_timestamp,
                            )))
                        } else {
                            Ok(Some(ReloadInfo::new(
                                0,
                                0,
                                payload.len() + skipped,
                                self.last_know_timestamp,
                            )))
                        }
                    }
                    _ => {
                        let copied = self.buffer.write_from(payload);
                        let available_bytes = self.buffer.read_available();
                        Ok(Some(ReloadInfo::new(
                            copied,
                            available_bytes,
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
        trace!("consume {consumed} processed bytes");
        self.pcap_reader.consume(consumed);
        res
    }

    fn current_slice(&self) -> &[u8] {
        self.buffer.read_slice()
    }

    fn consume(&mut self, offset: usize) {
        self.buffer.read_done(offset);
    }

    fn len(&self) -> usize {
        self.buffer.read_available()
    }
}

const PCAP_SOURCE_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x10,
]);

impl<R: Read + Send> components::Component for PcapLegacyByteSource<R> {
    fn ident() -> stypes::Ident {
        stypes::Ident {
            name: String::from("PCAP Source"),
            desc: String::from("PCAP Source"),
            uuid: PCAP_SOURCE_UUID,
        }
    }

    fn register(_components: &mut components::Components) -> Result<(), stypes::NativeError> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {

    use env_logger;

    use crate::{
        ByteSource, binary::pcap::legacy::PcapLegacyByteSource, tests::general_source_reload_test,
    };

    #[tokio::test]
    async fn test_read_one_message_from_pcap() {
        let _ = env_logger::try_init();

        const SAMPLE_PCAP_DATA: &[u8] = &[
            0xd4, 0xc3, 0xb2, 0xa1, // Magic Number (4 bytes) = d4 c3 b2 a1
            0x02, 0x00, // Version Major (2 bytes) = 02 00
            0x04, 0x00, // Version Minor (2 bytes) = 04 00
            0x00, 0x00, 0x00, 0x00, // Timezone (4 bytes) = 00 00 00 00
            0x00, 0x00, 0x00, 0x00, // Timestamp Accuracy (4 bytes) = 00 00 00 00
            0x00, 0x00, 0x04, 0x00, // Snap Length (4 bytes)
            0x01, 0x00, 0x00, 0x00, // Link-Layer Type (4 bytes)
            // Packet Header 16 byte
            0xeb, 0x15, 0x88, 0x60, 0xe6, 0x7f, 0x04, 0x00, 0x62, 0x00, 0x00, 0x00, 0x62, 0x00,
            0x00, 0x00, //
            // start of ethernet packet -------------------
            0xb8, 0x27, 0xeb, 0x1d, 0x24, 0xc9, 0xb8, 0x27, 0xeb, 0x98, 0x94, 0xfa, 0x08, 0x00,
            0x45, 0x00, 0x00, 0x54, 0xa0, 0x48, 0x40, 0x00, 0x40, 0x11, 0x29, 0x85, 0xac, 0x16,
            0x0c, 0x4f, 0xac, 0x16, 0x0c,
            0x50, // start of udp frame  -------------------------
            0xc3, 0x50, 0xc3, 0x50, 0x00, 0x40, 0x8e, 0xe3, //
            // start of udp payload 56 bytes ---------------------------
            0xff, 0xff, 0x81, 0x00, 0x00, 0x00, 0x00, 0x30, 0x00, 0x00, 0x00, 0x01, 0x01, 0x01,
            0x02, 0x00, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x01, 0x00, 0x00, 0x10,
            0x01, 0x03, 0x00, 0x01, 0x01, 0x00, 0x00, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x0c, 0x00, 0x10, 0x04, 0x00, 0xac, 0x16, 0x0c, 0x4f, 0x00, 0x11, 0x75, 0x30,
        ];

        let udp_payload = &SAMPLE_PCAP_DATA[82..=137];
        let pcap_file = std::io::Cursor::new(SAMPLE_PCAP_DATA);

        let mut source = PcapLegacyByteSource::new(pcap_file).expect("cannot create source");
        let reload_info = source.load(None).await.expect("reload should work");
        println!("reload_info: {:?}", reload_info);
        let slice = source.current_slice();
        println!("slice: {:x?}", slice);
        assert_eq!(slice.len(), 56);
        assert_eq!(slice, udp_payload);
    }

    #[tokio::test]
    async fn test_general_source_reload() {
        // This is part of the file "chipmunk/application/developing/resources".
        // In this test we just need enough bytes to call reload twice on it, and we will not
        // call parse on any of this data.
        const SAMPLE_PCAP_DATA: &[u8] = &[
            0xd4, 0xc3, 0xb2, 0xa1, 0x02, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x52, 0x90, 0x5a, 0x64,
            0xa4, 0xd8, 0x0e, 0x00, 0x6e, 0x00, 0x00, 0x00, 0x6e, 0x00, 0x00, 0x00, 0x01, 0x00,
            0x5e, 0x40, 0xff, 0xfb, 0xb8, 0x27, 0xeb, 0x1d, 0x24, 0xc9, 0x08, 0x00, 0x45, 0x00,
            0x00, 0x60, 0x16, 0x99, 0x00, 0x00, 0x01, 0x11, 0x40, 0x17, 0xc0, 0xa8, 0xb2, 0x3a,
            0xef, 0xff, 0xff, 0xfa, 0x9c, 0x40, 0x9c, 0x40, 0x00, 0x4c, 0x63, 0x3b, 0xff, 0xff,
            0x81, 0x00, 0x00, 0x00, 0x00, 0x3c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x01, 0x02, 0x00,
            0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x01, 0x00, 0x00, 0x20, 0x00, 0x7b,
            0x00, 0x01, 0x01, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x18,
            0x00, 0x10, 0x04, 0x00, 0xc0, 0xa8, 0xb2, 0x3a, 0x00, 0x11, 0x75, 0x30, 0x00, 0x10,
            0x04, 0x00, 0xc0, 0xa8, 0xb2, 0x3a, 0x00, 0x06, 0x75, 0x30, 0x52, 0x90, 0x5a, 0x64,
            0x08, 0xda, 0x0e, 0x00, 0x62, 0x00, 0x00, 0x00, 0x62, 0x00, 0x00, 0x00, 0x01, 0x00,
            0x5e, 0x40, 0xff, 0xfb, 0xb8, 0x27, 0xeb, 0x1d, 0x24, 0xc9, 0x08, 0x00, 0x45, 0x00,
            0x00, 0x54, 0x3a, 0xb4, 0x00, 0x00, 0x40, 0x11, 0x00, 0x00, 0xc0, 0xa8, 0xb2, 0x3a,
            0xc0, 0xa8, 0xb2, 0x3a, 0x9c, 0x40, 0x9c, 0x40, 0x00, 0x40, 0xe6, 0x17, 0xff, 0xff,
            0x81, 0x00, 0x00, 0x00, 0x00, 0x30, 0x00, 0x00, 0x00, 0x00, 0x01, 0x01, 0x02, 0x00,
            0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x06, 0x00, 0x00, 0x10, 0x00, 0x7b,
            0x00, 0x01, 0x01, 0x00, 0x00, 0x03, 0x00, 0x00, 0x01, 0x41, 0x00, 0x00, 0x00, 0x0c,
            0x00, 0x10, 0x04, 0x00, 0xc0, 0xa8, 0xb2, 0x3a, 0x00, 0x11, 0x75, 0x30, 0x52, 0x90,
        ];

        let pcap_file = std::io::Cursor::new(SAMPLE_PCAP_DATA);

        let mut source = PcapLegacyByteSource::new(pcap_file).expect("cannot create source");

        general_source_reload_test(&mut source).await;
    }
}
