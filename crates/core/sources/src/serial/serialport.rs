//! Byte source over an open serial port.
//!
//! Incoming bytes are handed over unchanged: framing and decoding belong to the parser. Writing
//! back to the port serves the session's send-data-to-source requests.

use crate::{ByteSource, Error as SourceError, ReloadInfo, STREAM_BUFFER_CAPACITY, SourceFilter};
use bufread::DeqBuffer;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    time::{Duration, sleep},
};
use tokio_serial::{DataBits, FlowControl, Parity, SerialPortBuilderExt, SerialStream, StopBits};

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

/// Reads from a serial port and writes back what the session sends to it.
pub struct SerialSource {
    // Reading and writing never overlap: both go through `&mut self`, so the port needs no
    // splitting into halves.
    port: SerialStream,
    buffer: DeqBuffer,
    send_data_delay: u8,
}

// Do we need to do some actions of destructor?
// impl Drop for SerialSource {
//     fn drop(&mut self) {
//         // Todo something good
//     }
// }

impl SerialSource {
    /// Opens the port described by `config` with its baud rate, framing and flow control.
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
                Ok(Self {
                    port,
                    buffer: DeqBuffer::new(STREAM_BUFFER_CAPACITY),
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
        // Space freed by the consumer sits in front of the buffered bytes and is reachable by
        // compacting only: without this a retained partial line would shrink every following read
        // until the buffer looks full while being mostly empty.
        if !self.buffer.ensure_write_space(1) {
            // Nothing in the buffer has been consumed yet, so there is nowhere to read into, and
            // bytes taken from the port can't be put back. The producer resolves this by parsing
            // what is buffered.
            let available_bytes = self.buffer.read_available();
            let info = ReloadInfo::new(0, available_bytes, 0, None);

            return Ok(Some(info));
        }

        // Implementation is cancel-safe here because there is one await call only, and `read()`
        // takes nothing from the port when its future is dropped.
        let free_space = self.buffer.write_slice();
        let read = self.port.read(free_space).await.map_err(SourceError::Io)?;
        if read == 0 {
            return Ok(None);
        }

        // The read went straight into the free space of the buffer, so `write_done` only moves
        // the write cursor. Its return value stays the reported one: claiming bytes the buffer
        // doesn't hold tells the producer that progress happened and makes it ask forever.
        let written = self.buffer.write_done(read);
        let available_bytes = self.buffer.read_available();
        let info = ReloadInfo::new(written, available_bytes, 0, None);

        Ok(Some(info))
    }

    fn can_buffer_more(&self) -> bool {
        // `load()` compacts before reading, so the space in front of the buffered bytes counts.
        self.buffer.spare_capacity() > 0
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
        let bytes = match &request {
            stypes::SdeRequest::WriteText(text) => text.as_bytes(),
            stypes::SdeRequest::WriteBytes(bytes) => bytes.as_slice(),
        };

        if self.send_data_delay == 0 {
            self.port.write_all(bytes).await.map_err(SourceError::Io)?;
        } else {
            for byte in bytes {
                self.port
                    .write_all(&[*byte])
                    .await
                    .map_err(SourceError::Io)?;
                sleep(Duration::from_millis(self.send_data_delay as u64)).await;
            }
        }

        Ok(stypes::SdeResponse { bytes: bytes.len() })
    }
}

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
