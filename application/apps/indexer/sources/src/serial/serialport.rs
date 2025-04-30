use crate::{ByteSource, Error as SourceError, ReloadInfo, SourceFilter};
use bufread::DeqBuffer;
use bytes::{BufMut, BytesMut};
use futures::{
    stream::{SplitSink, SplitStream, StreamExt},
    SinkExt,
};
use std::{io, str};
use tokio::time::{sleep, Duration};
use tokio_serial::{DataBits, FlowControl, Parity, SerialPortBuilderExt, SerialStream, StopBits};
use tokio_util::codec::{Decoder, Encoder, Framed};

struct LineCodec;

impl Decoder for LineCodec {
    type Item = String;
    type Error = io::Error;

    fn decode(&mut self, src: &mut BytesMut) -> Result<Option<Self::Item>, Self::Error> {
        match &src.iter().position(|b| *b == b'\n') {
            Some(n) => match str::from_utf8(&src.split_to(n + 1)) {
                Ok(s) => Ok(Some(s.to_string())),
                Err(err) => Err(io::Error::new(
                    io::ErrorKind::Other,
                    format!("Failed to format string: {err}"),
                )),
            },
            None => Ok(None),
        }
    }
}

impl Encoder<Vec<u8>> for LineCodec {
    type Error = io::Error;

    fn encode(&mut self, item: Vec<u8>, dst: &mut BytesMut) -> Result<(), Self::Error> {
        dst.reserve(item.len());
        dst.put(&item as &[u8]);
        Ok(())
    }
}

fn data_bits(data_bits: &u8) -> DataBits {
    match data_bits {
        5 => DataBits::Five,
        6 => DataBits::Six,
        7 => DataBits::Seven,
        8 => DataBits::Eight,
        _ => DataBits::Eight,
    }
}

fn flow_control(flow_control: &u8) -> FlowControl {
    match flow_control {
        0 => FlowControl::None,
        1 => FlowControl::Hardware,
        2 => FlowControl::Software,
        _ => FlowControl::None,
    }
}

fn parity(parity: &u8) -> Parity {
    match parity {
        0 => Parity::None,
        1 => Parity::Odd,
        2 => Parity::Even,
        _ => Parity::None,
    }
}

fn stop_bits(stop_bits: &u8) -> StopBits {
    match stop_bits {
        1 => StopBits::One,
        2 => StopBits::Two,
        _ => StopBits::One,
    }
}

pub struct SerialSource {
    write_stream: SplitSink<Framed<SerialStream, LineCodec>, Vec<u8>>,
    read_stream: SplitStream<Framed<SerialStream, LineCodec>>,
    buffer: DeqBuffer,
    amount: usize,
    send_data_delay: u8,
}

// Do we need to do some actions of destructor?
// impl Drop for SerialSource {
//     fn drop(&mut self) {
//         // Todo something good
//     }
// }

impl SerialSource {
    pub fn new(config: &stypes::SerialTransportConfig) -> Result<Self, SourceError> {
        match tokio_serial::new(config.path.as_str(), config.baud_rate)
            .data_bits(data_bits(&config.data_bits))
            .flow_control(flow_control(&config.flow_control))
            .parity(parity(&config.parity))
            .stop_bits(stop_bits(&config.stop_bits))
            .open_native_async()
        {
            // We get warning on windows because `port` doesn't need to be mutated there
            #[cfg_attr(windows, allow(unused_mut))]
            Ok(mut port) => {
                #[cfg(unix)]
                if let Err(err) = port.set_exclusive(config.exclusive) {
                    return Err(SourceError::Setup(format!(
                        "Unable to set serial port {} exclusive to {}: {}",
                        config.path, config.exclusive, err
                    )));
                }
                let stream = LineCodec.framed(port);
                let (write_stream, read_stream) = stream.split();
                Ok(Self {
                    write_stream,
                    read_stream,
                    buffer: DeqBuffer::new(8192),
                    amount: 0,
                    send_data_delay: config.send_data_delay,
                })
            }
            Err(err) => Err(SourceError::Setup(format!(
                "Failed to open serial port {}: {}",
                config.path, err
            ))),
        }
    }
}

impl ByteSource for SerialSource {
    async fn load(
        &mut self,
        _filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        // Implementation is cancel-safe here because there is one await call on a stream only.
        match self.read_stream.next().await {
            Some(result) => match result {
                Ok(received) => {
                    self.amount = received.len();
                    if self.amount == 0 {
                        return Ok(None);
                    }
                    self.buffer.write_from(received.as_bytes());
                }
                Err(err) => {
                    return Err(SourceError::Setup(format!("Failed to read stream: {err}")));
                }
            },
            None => {
                return Err(SourceError::Setup(
                    "Error awaiting future in reading (RX) stream".to_string(),
                ));
            }
        }

        let available_bytes = self.buffer.read_available();
        Ok(Some(ReloadInfo::new(self.amount, available_bytes, 0, None)))
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

    fn is_empty(&self) -> bool {
        self.len() == 0
    }

    async fn income(
        &mut self,
        request: stypes::SdeRequest,
    ) -> Result<stypes::SdeResponse, SourceError> {
        Ok(match request {
            stypes::SdeRequest::WriteText(mut str) => {
                let len = str.len();
                if self.send_data_delay == 0 {
                    self.write_stream
                        .send(str.as_bytes().to_vec())
                        .await
                        .map_err(SourceError::Io)?;
                } else {
                    while !str.is_empty() {
                        self.write_stream
                            .send(str.drain(0..1).collect::<String>().as_bytes().to_vec())
                            .await
                            .map_err(SourceError::Io)?;
                        sleep(Duration::from_millis(self.send_data_delay as u64)).await;
                    }
                }
                stypes::SdeResponse { bytes: len }
            }
            stypes::SdeRequest::WriteBytes(mut bytes) => {
                let len = bytes.len();
                if self.send_data_delay == 0 {
                    self.write_stream
                        .send(bytes)
                        .await
                        .map_err(SourceError::Io)?;
                } else {
                    while !bytes.is_empty() {
                        self.write_stream
                            .send(bytes.drain(0..1).collect::<Vec<u8>>())
                            .await
                            .map_err(SourceError::Io)?;
                        sleep(Duration::from_millis(self.send_data_delay as u64)).await;
                    }
                }
                stypes::SdeResponse { bytes: len }
            }
        })
    }
}

#[cfg(target_os = "windows")]
unsafe impl Send for SerialSource {}

#[cfg(target_os = "windows")]
unsafe impl Sync for SerialSource {}

/*
#[tokio::test]
async fn test_serial() {
    // Skipped for now due to permission issue, will be fixed later on
    let mut sender = "";
    let mut receiver = "";
    let baud_rate = 9600;
    if cfg!(windows) {
        sender = "COM1";
        receiver = "COM2";
    } else if cfg!(unix) {
        sender = "/dev/ttyS11";
        receiver = "/dev/ttyS12";
    }
    let mut serial_source =
        SerialSource::new(receiver, baud_rate).expect("create SerialSource failed");
    let messages = [
        "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    ];
    let mut sender = tokio_serial::new(sender, baud_rate)
        .open_native_async()
        .expect("open port failed");
    tokio::select! {
        _ = async {
            for message in messages {
                sender.writable().await.expect("send message not possible");
                sender.try_write(format!("{}\n", &message).as_bytes()).expect("send message failed");
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }
        } => (),
        _ = async {
            while serial_source
                .reload(None)
                .await
                .expect("reload data from serial source failed")
                .is_some()
            {
                let mut received = std::str::from_utf8(serial_source.current_slice()).expect("converting ut8 to str failed").to_string();
                received.pop();
                assert!(messages.contains(&received.as_str()));
                serial_source.consume(serial_source.current_slice().len());
            }
        } => (),
    }
}

#[tokio::test]
async fn test_general_source_reload() {
    // Skipped for now due to permission issue as above
    let serial_source = todo!();
    general_source_reload_test(&mut serial_source).await;
}
*/
