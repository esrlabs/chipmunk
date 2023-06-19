use crate::{pcap::file::PcapngByteSource, producer::MessageProducer, ByteSource};
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

#[tokio::test]
async fn test_read_problem_message_from_pcapng() {
    let _ = env_logger::try_init();
    let sample_pcapng_data = vec![
        /*0*/
        // section header block
        /* blocktype */ 0x0a, 0x0d, 0x0d, 0x0a,
        /* len */ 0x1c, 0x00, 0x00, 0x00, //
        /* magic number */ 0x4d, 0x3c, 0x2b, 0x1a, //
        /* version major/minor */ 0x01, 0x00, 0x00, 0x00, //
        /* timezone/accuracy */ 0xff, 0xff, 0xff, 0xff, //
        /* section le */ 0xff, 0xff, 0xff, 0xff, 0x1c, 0x00, 0x00, 0x00, // ---
        /*28*/
        // interface description block
        0x01, 0x00, 0x00, 0x00, /* blocktype */
        0x14, 0x00, 0x00, 0x00, /* len */
        0x01, 0x00, /* LINKTYPE_ETHERNET */
        0x00, 0x00, /* reserved */
        0x00, 0x00, 0x04, 0x00, /* snap-len */
        0x14, 0x00, 0x00, 0x00, // ---
        /*48 */
        // enhanced packet block
        0x06, 0x00, 0x00, 0x00, /* blocktype */
        0x84, 0x00, 0x00, 0x00, /* blocklen */
        0x00, 0x00, 0x00, 0x00, /* interface-id */
        0xf4, 0xc0, 0x05, 0x00, 0xa6, 0x90, 0x75, 0x80, /*timestamp */
        0x62, 0x00, 0x00, 0x00, /* captured packet len */
        0x62, 0x00, 0x00, 0x00, /* orig. packet len */
        // start of ethernet packet -------------------
        /*82*/
        0xb8, 0x27, 0xeb, 0x1d, 0x24, 0xc9, 0xb8, 0x27, 0xeb, 0x98, 0x94, 0xfa, 0x08, 0x00, 0x45,
        0x00, 0x00, 0x54, 0xa0, 0x48, 0x40, 0x00, 0x40, 0x11, 0x29, 0x85, 0xac, 0x16, 0x0c, 0x4f,
        0xac, 0x16, 0x0c, 0x50, // start of udp frame  -------------------------
        0xc3, 0x50, 0xc3, 0x50, 0x00, 0x40, 0x8e, 0xe3,
        // start of udp payload 56 bytes ---------------------------
        0xff, 0xff, 0x81, 0x00, 0x00, 0x00, 0x00, 0x30, 0x00, 0x00, 0x00, 0x01, 0x01, 0x01, 0x02,
        0x00, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x01, 0x00, 0x00, 0x10, 0x01, 0x03,
        0x00, 0x01, 0x01, 0x00, 0x00, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x00,
        0x09, 0x04, 0x00, 0xac, 0x16, 0x0c, 0x4f, 0x00, 0x11, 0x75, 0x30,
        // --- end of ethernet packet ---------------------------
        // --- start of pcapng end ---------------------------
        0x00, 0x00, 0x84, 0x00, 0x00, 0x00,
    ];
    let udp_payload = &sample_pcapng_data[118..=173];
    let pcapng_file = std::io::Cursor::new(&sample_pcapng_data);

    let mut source = PcapngByteSource::new(pcapng_file).expect("cannot create source");
    let reload_info = source.reload(None).await.expect("reload should work");
    println!("reload_info: {:?}", reload_info);
    let slice = source.current_slice();
    println!("slice: {:x?}", slice);
    assert_eq!(slice.len(), 56);
    assert_eq!(slice, udp_payload);
}
