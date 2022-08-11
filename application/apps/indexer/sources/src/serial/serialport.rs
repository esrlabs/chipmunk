use crate::factory::SerialTransportConfig;
use crate::ByteSource;
use crate::{Error as SourceError, ReloadInfo, SourceFilter};
use async_trait::async_trait;
use buf_redux::Buffer;
use tokio::io::{AsyncBufReadExt, BufReader};
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

pub struct SerialSource {
    buf_reader: BufReader<SerialStream>,
    string_buffer: String,
    buffer: Buffer,
    amount: usize,
}

impl SerialSource {
    pub fn new(config: &SerialTransportConfig) -> Result<Self, SourceError> {
        Ok(Self {
            buf_reader: BufReader::new(
                tokio_serial::new(config.path.as_str(), config.baud_rate)
                    .data_bits(data_bits(&config.data_bits))
                    .flow_control(flow_control(&config.flow_control))
                    .parity(parity(&config.parity))
                    .stop_bits(stop_bits(&config.stop_bits))
                    .open_native_async()
                    .map_err(|e| {
                        SourceError::Setup(format!(
                            "Failed to open serial port {}: {}",
                            config.path, e
                        ))
                    })?,
            ),
            string_buffer: String::new(),
            buffer: Buffer::new(),
            amount: 0,
        })
    }
}

#[async_trait]
impl ByteSource for SerialSource {
    async fn reload(
        &mut self,
        _filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        self.string_buffer.clear();
        match self.buf_reader.read_line(&mut self.string_buffer).await {
            Ok(amount) => {
                self.amount = amount;
                if amount == 0 {
                    return Ok(None);
                }
                self.buffer.copy_from_slice(self.string_buffer.as_bytes());
            }
            Err(err) => {
                return Err(SourceError::Unrecoverable(format!(
                    "Reading line from stream failed: {}",
                    err
                )))
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
