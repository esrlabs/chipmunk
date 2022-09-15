use crate::factory::SerialTransportConfig;
use crate::serial::sde;
use crate::ByteSource;
use crate::{Error as SourceError, ReloadInfo, SourceFilter};
use async_trait::async_trait;
use buf_redux::Buffer;
use bytes::{BufMut, BytesMut};
use futures::stream::{SplitSink, SplitStream, StreamExt};
use futures::SinkExt;
use std::{io, str};
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
                    format!("Failed to format string: {}", err),
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
    buffer: Buffer,
    amount: usize,
}

// Do we need to do some actions of destructor?
// impl Drop for SerialSource {
//     fn drop(&mut self) {
//         // Todo something good
//     }
// }

impl SerialSource {
    pub fn new(config: &SerialTransportConfig) -> Result<Self, SourceError> {
        match tokio_serial::new(config.path.as_str(), config.baud_rate)
            .data_bits(data_bits(&config.data_bits))
            .flow_control(flow_control(&config.flow_control))
            .parity(parity(&config.parity))
            .stop_bits(stop_bits(&config.stop_bits))
            .open_native_async()
        {
            Ok(mut port) => {
                #[cfg(unix)]
                if let Err(err) = port.set_exclusive(false) {
                    return Err(SourceError::Setup(format!(
                        "Unable to set serial port {} exclusive to false: {}",
                        config.path, err
                    )));
                }
                let stream = LineCodec.framed(port);
                let (write_stream, read_stream) = stream.split();
                Ok(Self {
                    write_stream,
                    read_stream,
                    buffer: Buffer::new(),
                    amount: 0,
                })
            }
            Err(err) => Err(SourceError::Setup(format!(
                "Failed to open serial port {}: {}",
                config.path, err
            ))),
        }
    }
}

#[async_trait]
impl ByteSource for SerialSource {
    async fn reload(
        &mut self,
        _filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        match self.read_stream.next().await {
            Some(result) => match result {
                Ok(received) => {
                    self.amount = received.len();
                    if self.amount == 0 {
                        return Ok(None);
                    }
                    self.buffer.copy_from_slice(received.as_bytes());
                }
                Err(err) => {
                    return Err(SourceError::Setup(format!(
                        "Failed to read stream: {}",
                        err
                    )));
                }
            },
            None => {
                return Err(SourceError::Setup(
                    "Error awaiting future in reading (RX) stream".to_string(),
                ));
            }
        }
        Ok(Some(ReloadInfo::new(self.amount, self.amount, 0, None)))
    }

    fn current_slice(&self) -> &[u8] {
        self.buffer.buf()
    }

    fn consume(&mut self, offset: usize) {
        self.buffer.consume(offset);
    }

    fn len(&self) -> usize {
        self.buffer.len()
    }

    fn is_empty(&self) -> bool {
        self.len() == 0
    }

    async fn income(&mut self, msg: String) -> Result<String, String> {
        let request = serde_json::from_str::<sde::SdeRequest>(&msg)
            .map_err(|e| format!("Fail to deserialize message: {}", e))?;
        let response = match request {
            sde::SdeRequest::WriteText(str) => {
                let len = str.len();
                match self.write_stream.send(str.as_bytes().to_vec()).await {
                    Ok(()) => sde::SdeResponse::WriteText(sde::WriteResponse { bytes: len }),
                    Err(err) => {
                        sde::SdeResponse::Error(format!("Fail to write string to port: {}", err))
                    }
                }
            }
            sde::SdeRequest::WriteBytes(bytes) => {
                let len = bytes.len();
                match self.write_stream.send(bytes).await {
                    Ok(()) => sde::SdeResponse::WriteText(sde::WriteResponse { bytes: len }),
                    Err(err) => {
                        sde::SdeResponse::Error(format!("Fail to write bytes to port: {}", err))
                    }
                }
            }
        };
        serde_json::to_string(&response)
            .map_err(|e| format!("Fail to convert response to JSON: {}", e))
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
*/
