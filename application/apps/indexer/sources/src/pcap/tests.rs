use crate::{pcap::file::PcapngByteSource, producer::StaticProducer};
use parsers::{dlt::DltParser, MessageStreamItem};
use std::fs::File;

lazy_static! {
    static ref EXAMPLE_PCAPNG: std::path::PathBuf =
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("samples/minimal.pcapng");
}

#[test]
fn test_read_messages_from_pcapng() {
    env_logger::init();
    let dlt_parser = DltParser::default();
    let in_file = File::open(&*EXAMPLE_PCAPNG).expect("cannot open file");
    let source = PcapngByteSource::new(in_file).expect("cannot create source");
    let mut pcap_msg_producer = StaticProducer::new(dlt_parser, source);
    let mut found_msg = 0usize;
    for item in pcap_msg_producer.by_ref() {
        if let (_, MessageStreamItem::Item(v)) = item {
            found_msg += 1;
            assert_eq!(v.message.header.ecu_id, Some("TEST".to_owned()));
        }
    }
    assert_eq!(found_msg, 1);
}
