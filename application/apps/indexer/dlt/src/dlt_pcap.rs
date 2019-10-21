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

use crate::dlt::{StorageHeader, DltTimeStamp};
use std::net::Ipv4Addr;
use pnet::packet::Packet;
use pnet::packet::ethernet::EthernetPacket;
use pnet::packet::ipv4::Ipv4Packet;
use pnet::packet::udp::UdpPacket;
use pcap::Capture;
use std::path::Path;
use std::fs::File;
use std::io::Write;
use std::error;

pub fn convert_pcap_to_dlt(pcap_path: &Path, dlt_path: &Path, addr: &Ipv4Addr, port: u16) -> Result<(), Box<dyn error::Error>> {
    let mut cap = Capture::from_file(pcap_path)?;
    cap.filter(&format!("src host {} and udp dst port {}", addr, port))?;

    let mut file = File::create(dlt_path)?;

    while let Ok(cap) = cap.next() {
        let ethernet_packet = EthernetPacket::new(cap.data).unwrap();
        let ipv4_packet = Ipv4Packet::new(ethernet_packet.payload()).unwrap();
        let udp_packet = UdpPacket::new(ipv4_packet.payload()).unwrap();

        let header = StorageHeader {
            timestamp: DltTimeStamp {
                seconds: cap.header.ts.tv_sec as u32,
                microseconds: cap.header.ts.tv_usec as u32
            },
            ecu_id: "ECU".to_string(),
        };

        file.write_all(&header.as_bytes())?;
        file.write_all(udp_packet.payload())?;
    }

    Ok(())
}

mod tests {
    use super::*;

    //  TODO: Implement tests
}
