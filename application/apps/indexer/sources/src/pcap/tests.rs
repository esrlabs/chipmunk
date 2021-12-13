use crate::{
    pcap::{file::PcapMessageProducer, format::dlt::DltParser},
    MessageStreamItem,
};

lazy_static! {
    static ref EXAMPLE_PCAPNG: std::path::PathBuf =
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("samples/minimal.pcapng");
}

#[test]
fn test_read_messages_from_pcapng() {
    env_logger::init();
    let dlt_parser = DltParser {
        filter_config: None,
        fibex_metadata: None,
    };
    let mut pcap_msg_producer =
        PcapMessageProducer::new(&EXAMPLE_PCAPNG, dlt_parser).expect("could not create producer");
    let mut found_msg = 0usize;
    for item in pcap_msg_producer.by_ref() {
        if let (_, Ok(MessageStreamItem::Item(v))) = item {
            found_msg += v.len();
            assert_eq!(v[0].message.header.ecu_id, Some("TEST".to_owned()));
        }
    }
    assert_eq!(found_msg, 1);
}
