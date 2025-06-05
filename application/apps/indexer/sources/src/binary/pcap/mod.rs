use pcap_parser::PcapBlockOwned;

pub mod legacy;
pub mod ng;

fn debug_block(b: PcapBlockOwned) {
    match b {
        PcapBlockOwned::NG(pcap_parser::Block::SectionHeader(_)) => {
            trace!("NG SectionHeader");
        }
        PcapBlockOwned::NG(pcap_parser::Block::InterfaceDescription(_)) => {
            trace!("NG InterfaceDescription");
        }
        PcapBlockOwned::NG(pcap_parser::Block::NameResolution(h)) => {
            trace!("NG NameResolution: {} namerecords", h.nr.len());
        }
        PcapBlockOwned::NG(pcap_parser::Block::InterfaceStatistics(h)) => {
            trace!("NG InterfaceStatistics: {:?}", h.options);
        }
        PcapBlockOwned::NG(pcap_parser::Block::SystemdJournalExport(_h)) => {
            trace!("NG SystemdJournalExport");
        }
        PcapBlockOwned::NG(pcap_parser::Block::DecryptionSecrets(_h)) => {
            trace!("NG DecryptionSecrets");
        }
        PcapBlockOwned::NG(pcap_parser::Block::Custom(_)) => {
            trace!("NG Custom");
        }
        PcapBlockOwned::NG(pcap_parser::Block::Unknown(_)) => {
            trace!("NG Unknown");
        }
        PcapBlockOwned::Legacy(_s) => {
            trace!("LegacyData");
        }
        PcapBlockOwned::LegacyHeader(_s) => {
            trace!(
                "LegacyData: version: {}.{}",
                _s.version_major, _s.version_minor
            );
        }
        _ => trace!("unknown block"),
    }
}
