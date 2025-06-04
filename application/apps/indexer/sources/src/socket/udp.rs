use super::{MAX_BUFF_SIZE, MAX_DATAGRAM_SIZE};
use crate::socket::{BuffCapacityState, handle_buff_capacity};
use bufread::DeqBuffer;
use components::{ComponentDescriptor, ComponentFactory};
use definitions::*;
use log::trace;
use std::{
    collections::HashMap,
    io::Read,
    net::{IpAddr, Ipv4Addr},
};
use stypes::{FieldDesc, SessionAction, StaticFieldDesc, Value, ValueInput};
use thiserror::Error;
use tokio::net::{ToSocketAddrs, UdpSocket};

#[derive(Error, Debug)]
pub enum UdpSourceError {
    #[error("IO Error: {0}")]
    Io(std::io::Error),
    #[error("Fail joining multicast group: {0}")]
    Join(String),
    #[error("Invalid address: {0}")]
    ParseAddr(std::net::AddrParseError),
    #[error("Invalid number: {0}")]
    ParseNum(std::num::ParseIntError),
    #[error("Config: {0}")]
    Config(stypes::NetError),
}

pub struct UdpSource {
    buffer: DeqBuffer,
    socket: UdpSocket,
    tmp_buffer: Vec<u8>,
}

impl UdpSource {
    pub async fn new<A: ToSocketAddrs>(
        addr: A,
        multicast: Vec<stypes::MulticastInfo>,
    ) -> Result<Self, UdpSourceError> {
        let socket = UdpSocket::bind(addr).await.map_err(UdpSourceError::Io)?;
        for multicast_info in &multicast {
            let multi_addr = multicast_info
                .multicast_addr()
                .map_err(UdpSourceError::Config)?;
            match multi_addr {
                IpAddr::V4(addr) => {
                    let inter: Ipv4Addr = match multicast_info.interface.as_ref() {
                        Some(s) => s.parse().map_err(UdpSourceError::ParseAddr)?,
                        None => Ipv4Addr::new(0, 0, 0, 0),
                    };
                    if let Err(e) = socket.join_multicast_v4(addr, inter) {
                        warn!("error joining multicast group: {e}");
                        return Err(UdpSourceError::Join(e.to_string()));
                    }
                    debug!(
                        "Joining UDP multicast group: socket.join_multicast_v4({}, {})",
                        addr, inter
                    );
                }
                IpAddr::V6(addr) => {
                    let inter: u32 = match multicast_info.interface.as_ref() {
                        Some(s) => s.parse::<u32>().map_err(UdpSourceError::ParseNum)?,
                        None => 0,
                    };
                    if let Err(e) = socket.join_multicast_v6(&addr, inter) {
                        warn!("error joining multicast group: {e}");
                        return Err(UdpSourceError::Join(e.to_string()));
                    }
                }
            };
        }

        Ok(Self {
            buffer: DeqBuffer::new(MAX_BUFF_SIZE),
            socket,
            tmp_buffer: vec![0u8; MAX_DATAGRAM_SIZE],
        })
    }
}

impl ByteSource for UdpSource {
    async fn load(
        &mut self,
        _filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        // If buffer is almost full then skip loading and return the available bytes.
        // This can happen because some parsers will parse the first item of the provided slice
        // while the producer will call load on each iteration making data accumulate.
        match handle_buff_capacity(&mut self.buffer) {
            BuffCapacityState::CanLoad => {}
            BuffCapacityState::AlmostFull => {
                let available_bytes = self.len();
                return Ok(Some(ReloadInfo::new(0, available_bytes, 0, None)));
            }
        }

        // TODO use filter
        let (len, remote_addr) = self
            .socket
            .recv_from(&mut self.tmp_buffer)
            .await
            .map_err(|e| SourceError::Setup(format!("{e}")))?;
        trace!(
            "---> Received {} bytes from {:?}: {}",
            len,
            remote_addr,
            String::from_utf8_lossy(&self.tmp_buffer[..len])
        );
        if len > 0 {
            let added = self.buffer.write_from(&self.tmp_buffer[..len]);
            if added < len {
                return Err(SourceError::Unrecoverable(
                    "Internal buffer maximum capcity reached.".into(),
                ));
            }
        }

        let available_bytes = self.buffer.read_available();

        Ok(Some(ReloadInfo::new(len, available_bytes, 0, None)))
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

const UDP_SOURCE_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04,
]);

const FIELD_IP_ADDR: &str = "UDP_SOURCE_FIELD_IP_ADDR";
const FIELD_MULTICAST_ADDR: &str = "UDP_SOURCE_FIELD_MULTICAST_ADDR";

#[derive(Default)]
pub struct Descriptor {}

impl ComponentFactory<crate::Source> for Descriptor {
    fn create(
        &self,
        _origin: &SessionAction,
        _options: &[stypes::Field],
    ) -> Result<Option<crate::Source>, stypes::NativeError> {
        Ok(None)
    }
}

impl ComponentDescriptor for Descriptor {
    fn is_compatible(&self, origin: &SessionAction) -> bool {
        match origin {
            SessionAction::File(..) | SessionAction::Files(..) | SessionAction::ExportRaw(..) => {
                false
            }
            SessionAction::Source => true,
        }
    }
    fn ident(&self) -> stypes::Ident {
        stypes::Ident {
            name: String::from("UDP Connection"),
            desc: String::from("Starts listening on the specified IP address and port, as well as on any user-defined multicast addresses. Each received UDP packet is passed to the parser as-is, excluding headers - only the payload is forwarded."),
            uuid: UDP_SOURCE_UUID,
        }
    }
    fn ty(&self) -> stypes::ComponentType {
        stypes::ComponentType::Source
    }
    fn fields_getter(&self, _origin: &stypes::SessionAction) -> components::FieldsResult {
        Ok(vec![
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_IP_ADDR.to_owned(),
                name: "IP address and port".to_owned(),
                desc: "Specifies the local address and port on which the application should listen for incoming UDP packets. The value must include both the IP address and the port, using the format IP:PORT — for example, 0.0.0.0:9000. This field is mandatory, and determines the network interface and port bound by the listener. Use 0.0.0.0:PORT to listen on all available interfaces.".to_owned(),
                required: true,
                interface: ValueInput::String(String::new(), "0.0.0.0:8888".to_owned()),
                binding: None,
            }),
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_MULTICAST_ADDR.to_owned(),
                name: "Multicast Addresses".to_owned(),
                desc: "An optional list of UDP multicast groups to join. Each entry includes the group address (e.g., 239.0.0.1) and the local interface IP (e.g., 192.168.1.10) used for joining. This allows the source to receive packets sent to the specified multicast addresses in addition to those received on the main local socket (IP:PORT). If the list is empty, only unicast or broadcast messages will be received.".to_owned(),
                required: true,
                interface: ValueInput::FieldsCollection {
                    elements: vec![
                        StaticFieldDesc {
                            id: String::new(),
                            name: "Address".to_owned(),
                            desc: "".to_owned(),
                            required: true,
                            interface: ValueInput::String(
                                String::new(),
                                "255.255.255.255".to_owned(),
                            ),
                            binding: None,
                        },
                        StaticFieldDesc {
                            id: String::new(),
                            name: "Interface".to_owned(),
                            desc: "".to_owned(),
                            required: true,
                            interface: ValueInput::String(String::new(), "0.0.0.0".to_owned()),
                            binding: None,
                        },
                    ],
                    add_title: "Add Multicast".to_owned(),
                },
                binding: None,
            }),
        ])
    }

    fn validate(
        &self,
        origin: &stypes::SessionAction,
        fields: &[stypes::Field],
    ) -> HashMap<String, String> {
        fn is_valid(addr: &str) -> bool {
            let mut count = 0;
            for part in addr.split(".") {
                if part.parse::<u8>().is_err() {
                    return false;
                }
                count += 1;
            }
            count == 4
        }
        let mut errors = HashMap::new();
        if let Some(field) = fields.iter().find(|field| field.id == FIELD_MULTICAST_ADDR) {
            if let Value::Fields(fields) = &field.value {
                for pair in fields.into_iter() {
                    if let Value::Fields(pair) = &pair.value {
                        if pair.len() != 2 {
                            errors.insert(
                                field.id.to_owned(),
                                "Invalid number of mutlicast settings".to_owned(),
                            );
                            break;
                        }
                        if let (Value::String(addr), Value::String(interface)) =
                            (&pair[0].value, &pair[1].value)
                        {
                            if !is_valid(addr) {
                                errors.insert(
                                    pair[0].id.to_owned(),
                                    "Expecting IP format 255.255.255.255".to_owned(),
                                );
                            }
                            if !is_valid(interface) {
                                errors.insert(
                                    pair[1].id.to_owned(),
                                    "Expecting IP format 0.0.0.0".to_owned(),
                                );
                            }
                        } else {
                            errors.insert(
                                field.id.to_owned(),
                                "Invalid values of mutlicast settings".to_owned(),
                            );
                            break;
                        }
                    } else {
                        errors.insert(field.id.to_owned(), "Invalid mutlicast settings".to_owned());
                        break;
                    }
                }
            } else {
                errors.insert(field.id.to_owned(), "Invalid mutlicast settings".to_owned());
            }
        } else {
            errors.insert(
                FIELD_MULTICAST_ADDR.to_owned(),
                "Fail to find mutlicast settings".to_owned(),
            );
        }
        errors
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use tokio::task::yield_now;

    use super::*;
    use crate::tests::general_source_reload_test;

    static MESSAGES: &[&str] = &["one", "two", "three"];

    #[tokio::test]
    async fn test_udp_reload() -> Result<(), UdpSourceError> {
        static SENDER: &str = "127.0.0.1:4000";
        static RECEIVER: &str = "127.0.0.1:5000";
        let send_socket = UdpSocket::bind(SENDER).await.map_err(UdpSourceError::Io)?;
        let send_handle = tokio::spawn(async move {
            for msg in MESSAGES {
                send_socket
                    .send_to(msg.as_bytes(), RECEIVER)
                    .await
                    .expect("could not send on socket");
            }
        });
        let mut udp_source = UdpSource::new(RECEIVER, vec![]).await?;
        let receive_handle = tokio::spawn(async move {
            for msg in MESSAGES {
                udp_source.load(None).await.unwrap();
                assert_eq!(udp_source.current_slice(), msg.as_bytes());
                udp_source.consume(msg.len());
            }
        });

        println!("UDP: Starting send and receive");
        let (_, rec_res) = tokio::join!(send_handle, receive_handle,);

        assert!(rec_res.is_ok());
        Ok(())
    }

    #[tokio::test]
    async fn test_general_source_reload() {
        static SENDER: &str = "127.0.0.1:4001";
        static RECEIVER: &str = "127.0.0.1:5001";
        let send_socket = UdpSocket::bind(SENDER)
            .await
            .map_err(UdpSourceError::Io)
            .unwrap();
        tokio::spawn(async move {
            for msg in MESSAGES {
                send_socket
                    .send_to(msg.as_bytes(), RECEIVER)
                    .await
                    .expect("could not send on socket");
            }
        });
        let mut udp_source = UdpSource::new(RECEIVER, vec![]).await.unwrap();

        general_source_reload_test(&mut udp_source).await;
    }

    /// Tests will send packets with fixed lengths while consuming
    /// half of the sent length, ensuring the source won't break.
    ///
    /// This test demonstrate that parsers which consume the bytes of one result at a
    /// time while miss parsing the whole bytes when the server isn't sending more data
    /// even that the buffer has bytes in it.
    #[tokio::test]
    async fn test_source_buffer_overflow() {
        const SENDER: &str = "127.0.0.1:4002";
        const RECEIVER: &str = "127.0.0.1:5002";

        const SENT_LEN: usize = MAX_DATAGRAM_SIZE;
        const CONSUME_LEN: usize = MAX_DATAGRAM_SIZE / 2;

        let send_socket = UdpSocket::bind(SENDER)
            .await
            .map_err(UdpSourceError::Io)
            .unwrap();

        // Spawn server in background.
        tokio::spawn(async move {
            let msg = [b'a'; SENT_LEN];
            let mut total_sent = 0;
            // Give the receiver some start up time.
            tokio::time::sleep(Duration::from_millis(100)).await;
            while total_sent < MAX_BUFF_SIZE * 2 {
                send_socket
                    .send_to(&msg, RECEIVER)
                    .await
                    .expect("could not send on socket");
                yield_now().await;
                total_sent += msg.len();
            }
        });

        let mut udp_source = UdpSource::new(RECEIVER, vec![]).await.unwrap();

        while let Ok(Some(info)) = udp_source.load(None).await {
            if info.newly_loaded_bytes == 0 {
                println!(
                    "Availbe bytes count that won't be parsed: {}",
                    info.available_bytes
                );

                break;
            }
            udp_source.consume(info.available_bytes.min(CONSUME_LEN));
        }
    }
}
