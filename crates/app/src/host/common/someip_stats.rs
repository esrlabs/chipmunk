use anyhow::Result;
use pcap_parser::{
    Block, LegacyPcapReader, PcapBlockOwned, PcapError, PcapNGReader, traits::PcapReaderIterator,
};
use rustc_hash::FxHashMap;
use someip_messages::*;
use std::io::Read;
use std::{fs::File, path::PathBuf};

/// Collects the SOME/IP statistics from the given source files.
pub fn someip_statistics(sources: Vec<PathBuf>) -> Result<SomeipStatistics, String> {
    let mut statistics = SomeipStatistics::default();

    for source in sources {
        let file = File::open(&source)
            .map_err(|error| format!("{:?}: failed to open source: {}", source, error))?;

        let mut collector = SomeipStatisticsCollector::default();

        match source.extension().and_then(|ext| ext.to_str()) {
            Some(ext) if ext.eq_ignore_ascii_case("pcap") => {
                let mut reader = LegacyPcapReader::new(65536, file).map_err(|error| {
                    format!("{:?}: failed to create pcap reader: {}", source, error)
                })?;

                collect_statistics_from_pcap(&mut reader, &mut statistics, &mut collector)
                    .map_err(|error| format!("{:?}: {}", source, error))?;
            }

            Some(ext) if ext.eq_ignore_ascii_case("pcapng") => {
                let mut reader = PcapNGReader::new(65536, file).map_err(|error| {
                    format!("{:?}: failed to create pcapng reader: {}", source, error)
                })?;

                collect_statistics_from_pcapng(&mut reader, &mut statistics, &mut collector)
                    .map_err(|error| format!("{:?}: {}", source, error))?;
            }

            _ => {
                return Err(format!("unsupported source: {:?}", source));
            }
        }
    }

    Ok(statistics)
}

/// The statistics-info of SOME/IP files.
#[derive(Debug, Default, Clone, PartialEq)]
pub struct SomeipStatistics {
    /// The overall distribution of messages-types.
    pub total: MessageDistribution,
    /// The message-id specific distribution of messages-types.
    pub messages: FxHashMap<MessageId, MessageDistribution>,
}

impl SomeipStatistics {
    /// Returns the total number of message-ids.
    pub fn count(&self) -> usize {
        self.messages.len()
    }

    /// Returns the distribution of messages for the given id,
    /// or if not found, adds and returns an empty one.
    pub fn message(&mut self, id: MessageId) -> &mut MessageDistribution {
        self.messages.entry(id).or_default()
    }
}

/// The type distribution of SOME/IP messages.
#[derive(Debug, Default, Clone, PartialEq)]
pub struct MessageDistribution {
    pub sd: usize,
    pub event: usize,
    pub request: usize,
    pub response: usize,
    pub fire_forget: usize,
    pub error: usize,
}

impl MessageDistribution {
    /// Returns the total number of messages.
    pub fn count(&self) -> usize {
        self.sd + self.event + self.request + self.response + self.fire_forget + self.error
    }

    /// Returns the type specific numbers of messages.
    pub fn values(&self) -> [usize; 6] {
        [
            self.sd,
            self.event,
            self.request,
            self.response,
            self.fire_forget,
            self.error,
        ]
    }

    pub fn merge(&mut self, other: &MessageDistribution) -> &mut Self {
        self.sd += other.sd;
        self.event += other.event;
        self.request += other.request;
        self.response += other.response;
        self.fire_forget += other.fire_forget;
        self.error += other.error;
        self
    }
}

fn collect_statistics(
    statistics: &mut SomeipStatistics,
    mut payload: &[u8],
) -> Result<Vec<u8>, someip_messages::Error> {
    loop {
        if payload.is_empty() {
            return Ok(Vec::new());
        }

        if payload.len() < Header::LENGTH {
            return Ok(payload.to_vec());
        }

        match Message::from_slice(payload) {
            Ok(message) => {
                let consumed = match &message {
                    Message::Sd(header, _) | Message::Rpc(header, _) => header.message_len(),

                    Message::CookieClient | Message::CookieServer => Header::LENGTH,
                };

                count_message(statistics, message);

                payload = &payload[consumed..];
            }

            Err(someip_messages::Error::NotEnoughData { .. }) => {
                return Ok(payload.to_vec());
            }

            Err(error) => {
                return Err(error);
            }
        }
    }
}

fn count_message(statistics: &mut SomeipStatistics, message: Message) {
    match message {
        Message::Sd(header, _) => {
            let message_id = header.message_id().clone();

            match header.message_type() {
                MessageType::Notification => {
                    statistics.total.sd += 1;
                    statistics.message(message_id).sd += 1;
                }
                MessageType::Error => {
                    statistics.total.error += 1;
                    statistics.message(message_id).error += 1;
                }
                _ => {}
            }
        }

        Message::Rpc(header, _) => {
            let message_id = header.message_id().clone();

            match header.message_type() {
                MessageType::Notification | MessageType::TpNotification => {
                    statistics.total.event += 1;
                    statistics.message(message_id).event += 1;
                }
                MessageType::Request | MessageType::TpRequest => {
                    statistics.total.request += 1;
                    statistics.message(message_id).request += 1;
                }
                MessageType::Response | MessageType::TpResponse => {
                    statistics.total.response += 1;
                    statistics.message(message_id).response += 1;
                }
                MessageType::RequestNoReturn | MessageType::TpRequestNoReturn => {
                    statistics.total.fire_forget += 1;
                    statistics.message(message_id).fire_forget += 1;
                }
                MessageType::Error | MessageType::TpError => {
                    statistics.total.error += 1;
                    statistics.message(message_id).error += 1;
                }
            }
        }

        Message::CookieClient | Message::CookieServer => {}
    }
}

fn collect_statistics_from_pcap<S: Read>(
    reader: &mut LegacyPcapReader<S>,
    statistics: &mut SomeipStatistics,
    collector: &mut SomeipStatisticsCollector,
) -> Result<(), String> {
    loop {
        match reader.next() {
            Ok((offset, block)) => {
                if let PcapBlockOwned::Legacy(b) = block
                    && let Some(transport) = extract_ethernet_payload(b.data)
                {
                    collect_statistics_from_transport_payload(collector, statistics, transport)?;
                }

                reader.consume(offset);
            }
            Err(pcap_parser::PcapError::Eof) => break,
            Err(e) => {
                eprintln!("PCAP error: {:?}", e);
                break;
            }
        }
    }

    Ok(())
}

fn collect_statistics_from_pcapng<S: Read>(
    reader: &mut PcapNGReader<S>,
    statistics: &mut SomeipStatistics,
    collector: &mut SomeipStatisticsCollector,
) -> Result<(), String> {
    loop {
        match reader.next() {
            Ok((offset, block)) => {
                if let PcapBlockOwned::NG(block) = block {
                    match block {
                        Block::EnhancedPacket(epb) => {
                            if let Some(transport) = extract_ethernet_payload(epb.data) {
                                collect_statistics_from_transport_payload(
                                    collector, statistics, transport,
                                )?;
                            }
                        }

                        Block::SimplePacket(spb) => {
                            if let Some(transport) = extract_ethernet_payload(spb.data) {
                                collect_statistics_from_transport_payload(
                                    collector, statistics, transport,
                                )?;
                            }
                        }

                        _ => {}
                    }
                }

                reader.consume(offset);
            }

            Err(PcapError::Eof) => break,

            Err(PcapError::Incomplete(_)) => {
                reader
                    .refill()
                    .map_err(|e| format!("PCAPNG refill error: {:?}", e))?;
            }

            Err(e) => {
                return Err(format!("PCAPNG error: {:?}", e));
            }
        }
    }

    Ok(())
}

fn collect_statistics_from_transport_payload(
    collector: &mut SomeipStatisticsCollector,
    statistics: &mut SomeipStatistics,
    transport: TransportPayload<'_>,
) -> Result<(), String> {
    match transport {
        TransportPayload::Udp(payload) => {
            let remaining = collect_statistics(statistics, payload)
                .map_err(|error| format!("failed to parse SOME/IP UDP payload: {:?}", error))?;

            if !remaining.is_empty() {
                eprintln!(
                    "incomplete SOME/IP UDP payload: {} remaining bytes",
                    remaining.len()
                );
            }
        }

        TransportPayload::Tcp { flow, payload } => {
            let buffer = collector.tcp_buffers.entry(flow).or_default();
            buffer.extend_from_slice(payload);

            let remaining = collect_statistics(statistics, buffer).map_err(|error| {
                format!("failed to parse SOME/IP TCP stream {:?}: {:?}", flow, error)
            })?;

            *buffer = remaining;
        }
    }

    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum IpAddrKey {
    V4([u8; 4]),
    V6([u8; 16]),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct TcpFlowKey {
    src_ip: IpAddrKey,
    dst_ip: IpAddrKey,
    src_port: u16,
    dst_port: u16,
}

enum TransportPayload<'a> {
    Udp(&'a [u8]),
    Tcp { flow: TcpFlowKey, payload: &'a [u8] },
}

#[derive(Debug, Default)]
struct SomeipStatisticsCollector {
    tcp_buffers: FxHashMap<TcpFlowKey, Vec<u8>>,
}

fn extract_ethernet_payload(frame: &[u8]) -> Option<TransportPayload<'_>> {
    if frame.len() < 14 {
        return None;
    }

    let mut offset = 12usize;
    let mut ethertype = u16::from_be_bytes([frame[offset], frame[offset + 1]]);
    offset += 2;

    while ethertype == 0x8100 || ethertype == 0x88A8 {
        if frame.len() < offset + 4 {
            return None;
        }

        offset += 2;
        ethertype = u16::from_be_bytes([frame[offset], frame[offset + 1]]);
        offset += 2;
    }

    match ethertype {
        0x0800 => extract_ipv4_payload(frame, offset),
        0x86DD => extract_ipv6_payload(frame, offset),
        _ => None,
    }
}

fn extract_ipv4_payload(frame: &[u8], ip_start: usize) -> Option<TransportPayload<'_>> {
    if frame.len() < ip_start + 20 {
        return None;
    }

    let ver_ihl = frame[ip_start];
    let version = ver_ihl >> 4;
    let ihl = (ver_ihl & 0x0f) as usize * 4;

    if version != 4 || ihl < 20 || frame.len() < ip_start + ihl {
        return None;
    }

    let total_len = u16::from_be_bytes([frame[ip_start + 2], frame[ip_start + 3]]) as usize;
    if total_len < ihl || frame.len() < ip_start + total_len {
        return None;
    }

    let src_ip = IpAddrKey::V4(frame[ip_start + 12..ip_start + 16].try_into().ok()?);
    let dst_ip = IpAddrKey::V4(frame[ip_start + 16..ip_start + 20].try_into().ok()?);

    let protocol = frame[ip_start + 9];
    let transport_start = ip_start + ihl;
    let ip_payload_end = ip_start + total_len;

    extract_transport_payload(
        frame,
        transport_start,
        ip_payload_end,
        protocol,
        src_ip,
        dst_ip,
    )
}

fn extract_ipv6_payload(frame: &[u8], ip_start: usize) -> Option<TransportPayload<'_>> {
    const IPV6_HEADER_LEN: usize = 40;

    if frame.len() < ip_start + IPV6_HEADER_LEN {
        return None;
    }

    let version = frame[ip_start] >> 4;
    if version != 6 {
        return None;
    }

    let payload_len = u16::from_be_bytes([frame[ip_start + 4], frame[ip_start + 5]]) as usize;
    let next_header = frame[ip_start + 6];

    let src_ip = IpAddrKey::V6(frame[ip_start + 8..ip_start + 24].try_into().ok()?);
    let dst_ip = IpAddrKey::V6(frame[ip_start + 24..ip_start + 40].try_into().ok()?);

    let transport_start = ip_start + IPV6_HEADER_LEN;
    let ip_payload_end = transport_start.checked_add(payload_len)?;

    if ip_payload_end > frame.len() {
        return None;
    }

    extract_transport_payload(
        frame,
        transport_start,
        ip_payload_end,
        next_header,
        src_ip,
        dst_ip,
    )
}

fn extract_transport_payload(
    frame: &[u8],
    transport_start: usize,
    ip_payload_end: usize,
    protocol: u8,
    src_ip: IpAddrKey,
    dst_ip: IpAddrKey,
) -> Option<TransportPayload<'_>> {
    match protocol {
        17 => {
            extract_udp_payload(frame, transport_start, ip_payload_end).map(TransportPayload::Udp)
        }

        6 => extract_tcp_payload(frame, transport_start, ip_payload_end, src_ip, dst_ip),

        _ => None,
    }
}

fn extract_udp_payload(frame: &[u8], udp_start: usize, ip_payload_end: usize) -> Option<&[u8]> {
    if udp_start + 8 > ip_payload_end {
        return None;
    }

    let udp_len = u16::from_be_bytes([frame[udp_start + 4], frame[udp_start + 5]]) as usize;
    if udp_len < 8 {
        return None;
    }

    let payload_start = udp_start + 8;
    let payload_end = udp_start.checked_add(udp_len)?;

    if payload_end > ip_payload_end {
        return None;
    }

    Some(&frame[payload_start..payload_end])
}

fn extract_tcp_payload(
    frame: &[u8],
    tcp_start: usize,
    ip_payload_end: usize,
    src_ip: IpAddrKey,
    dst_ip: IpAddrKey,
) -> Option<TransportPayload<'_>> {
    if tcp_start + 20 > ip_payload_end {
        return None;
    }

    let src_port = u16::from_be_bytes([frame[tcp_start], frame[tcp_start + 1]]);
    let dst_port = u16::from_be_bytes([frame[tcp_start + 2], frame[tcp_start + 3]]);

    let data_offset = (frame[tcp_start + 12] >> 4) as usize * 4;
    if data_offset < 20 {
        return None;
    }

    let payload_start = tcp_start.checked_add(data_offset)?;

    if payload_start > ip_payload_end {
        return None;
    }

    Some(TransportPayload::Tcp {
        flow: TcpFlowKey {
            src_ip,
            dst_ip,
            src_port,
            dst_port,
        },
        payload: &frame[payload_start..ip_payload_end],
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn messages() -> FxHashMap<MessageId, MessageDistribution> {
        let mut messages = FxHashMap::default();

        messages.insert(
            MessageId {
                service_id: 123,
                method_id: 32773,
            },
            MessageDistribution {
                sd: 0,
                event: 22,
                request: 0,
                response: 0,
                fire_forget: 0,
                error: 0,
            },
        );

        messages.insert(
            MessageId {
                service_id: 65535,
                method_id: 33024,
            },
            MessageDistribution {
                sd: 33,
                event: 0,
                request: 0,
                response: 0,
                fire_forget: 0,
                error: 0,
            },
        );

        messages
    }

    #[test]
    fn test_statistics_from_udp_pcap() {
        let sources: Vec<PathBuf> =
            ["../../development/resources/someip/udp/someip.pcap".into()].to_vec();

        let statistics = someip_statistics(sources).expect("stats");

        assert_eq!(
            statistics,
            SomeipStatistics {
                total: MessageDistribution {
                    sd: 33,
                    event: 22,
                    request: 0,
                    response: 0,
                    fire_forget: 0,
                    error: 0,
                },
                messages: messages(),
            }
        );
    }

    #[test]
    fn test_statistics_from_tcp_pcap() {
        let sources: Vec<PathBuf> =
            ["../../development/resources/someip/tcp/someip.pcap".into()].to_vec();

        let statistics = someip_statistics(sources).expect("stats");

        assert_eq!(
            statistics,
            SomeipStatistics {
                total: MessageDistribution {
                    sd: 33,
                    event: 22,
                    request: 0,
                    response: 0,
                    fire_forget: 0,
                    error: 0,
                },
                messages: messages(),
            }
        );
    }

    #[test]
    fn test_statistics_from_udp_pcapng() {
        let sources: Vec<PathBuf> =
            ["../../development/resources/someip/udp/someip.pcapng".into()].to_vec();

        let statistics = someip_statistics(sources).expect("stats");

        assert_eq!(
            statistics,
            SomeipStatistics {
                total: MessageDistribution {
                    sd: 33,
                    event: 22,
                    request: 0,
                    response: 0,
                    fire_forget: 0,
                    error: 0,
                },
                messages: messages(),
            }
        );
    }

    #[test]
    fn test_statistics_from_tcp_pcapng() {
        let sources: Vec<PathBuf> =
            ["../../development/resources/someip/tcp/someip.pcapng".into()].to_vec();

        let statistics = someip_statistics(sources).expect("stats");

        assert_eq!(
            statistics,
            SomeipStatistics {
                total: MessageDistribution {
                    sd: 33,
                    event: 22,
                    request: 0,
                    response: 0,
                    fire_forget: 0,
                    error: 0,
                },
                messages: messages(),
            }
        );
    }

    #[test]
    fn test_statistics_with_incomplete_message() {
        let partial = [
            0x00, 0x7b, 0x80, 0x05, // message id
            0x00, 0x00, 0x00, // incomplete
        ];

        let mut statistics = SomeipStatistics::default();

        let remaining = collect_statistics(&mut statistics, &partial).expect("parse");

        assert_eq!(remaining, partial);
        assert_eq!(statistics.total.count(), 0);
    }

    #[test]
    fn test_statistics_with_multiple_messages_in_one_payload() {
        let msg = [
            0x00, 0x7b, 0x80, 0x05, // message id
            0x00, 0x00, 0x00, 0x08, // length
            0x00, 0x00, 0x00, 0x01, // request id
            0x01, // protocol version
            0x01, // interface version
            0x02, // notification
            0x00, // return code
        ];

        let mut payload = Vec::new();
        payload.extend_from_slice(&msg);
        payload.extend_from_slice(&msg);

        let mut statistics = SomeipStatistics::default();

        let remaining = collect_statistics(&mut statistics, &payload).expect("parse");

        assert!(remaining.is_empty());
        assert_eq!(statistics.total.event, 2);
    }

    #[test]
    fn test_statistics_with_complete_message_and_partial() {
        let complete = [
            0x00, 0x7b, 0x80, 0x05, // message id
            0x00, 0x00, 0x00, 0x08, // length
            0x00, 0x00, 0x00, 0x01, // request id
            0x01, // protocol version
            0x01, // interface version
            0x02, // notification
            0x00, // return code
        ];

        let partial = [
            0x00, 0x7b, 0x80, // incomplete
        ];

        let mut payload = Vec::new();
        payload.extend_from_slice(&complete);
        payload.extend_from_slice(&partial);

        let mut statistics = SomeipStatistics::default();

        let remaining = collect_statistics(&mut statistics, &payload).expect("parse");

        assert_eq!(remaining, partial);
        assert_eq!(statistics.total.event, 1);
    }

    #[test]
    fn test_statistics_with_invalid_message() {
        let invalid = [
            0x00, 0x7b, 0x80, 0x05, // message id
            0x00, 0x00, 0x00, 0x08, // length
            0x00, 0x00, 0x00, 0x01, // request id
            0x01, // protocol version
            0x01, // interface version
            0xc8, // invalid type
            0x00, // return code
        ];

        let mut statistics = SomeipStatistics::default();

        let result = collect_statistics(&mut statistics, &invalid);

        assert!(result.is_err());
        assert_eq!(statistics.total.count(), 0);
    }

    #[test]
    fn test_statistics_with_message_assembled_from_two_payloads() {
        let message = [
            0x00, 0x7b, 0x80, 0x05, // message id
            0x00, 0x00, 0x00, 0x08, // length
            0x00, 0x00, 0x00, 0x01, // request id
            0x01, // protocol version
            0x01, // interface version
            0x02, // notification
            0x00, // return code
        ];

        let first_payload = &message[..7];
        let second_payload = &message[7..];

        let mut statistics = SomeipStatistics::default();

        let mut buffer = Vec::new();

        buffer.extend_from_slice(first_payload);
        buffer = collect_statistics(&mut statistics, &buffer).expect("first parse");

        assert_eq!(buffer, first_payload);
        assert_eq!(statistics.total.count(), 0);

        buffer.extend_from_slice(second_payload);
        buffer = collect_statistics(&mut statistics, &buffer).expect("second parse");

        assert!(buffer.is_empty());
        assert_eq!(statistics.total.event, 1);

        let message_id = MessageId {
            service_id: 123,
            method_id: 32773,
        };

        assert_eq!(statistics.message(message_id).event, 1);
    }

    #[test]
    fn message_distribution() {
        let mut a = MessageDistribution {
            sd: 1,
            event: 2,
            request: 3,
            response: 4,
            fire_forget: 5,
            error: 6,
        };

        let b = MessageDistribution {
            sd: 10,
            event: 20,
            request: 30,
            response: 40,
            fire_forget: 50,
            error: 60,
        };

        assert_eq!(a.count(), 21);
        assert_eq!(a.values(), [1, 2, 3, 4, 5, 6]);

        a.merge(&b);

        assert_eq!(a.count(), 231);
        assert_eq!(a.values(), [11, 22, 33, 44, 55, 66]);
    }
}
