use crate::{pcap::file::PcapngByteSource, producer::MessageProducer};
use futures::{pin_mut, stream::StreamExt};
use parsers::{dlt::DltParser, MessageStreamItem, ParseYield};
use std::fs::File;

lazy_static! {
    static ref EXAMPLE_PCAPNG: std::path::PathBuf =
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("samples/minimal.pcapng");
}

#[tokio::test]
async fn test_read_messages_from_pcapng() {
    let _ = env_logger::try_init();
    let dlt_parser = DltParser::default();
    let in_file = File::open(&*EXAMPLE_PCAPNG).expect("cannot open file");
    let source = PcapngByteSource::new(in_file).expect("cannot create source");
    let mut pcap_msg_producer = MessageProducer::new(dlt_parser, source, None);
    let msg_stream = pcap_msg_producer.as_stream();
    pin_mut!(msg_stream);
    let mut found_msg = 0usize;
    while let Some(item) = msg_stream.next().await {
        if let (_, MessageStreamItem::Item(v)) = item {
            found_msg += 1;
            match v {
                ParseYield::Message(m) => {
                    assert_eq!(m.message.header.ecu_id, Some("TEST".to_owned()));
                }
                _ => panic!("No message item in stream"),
            }
        }
    }
    assert_eq!(found_msg, 1);
}
