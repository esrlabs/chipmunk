use crate::ByteSource;
use crate::{Error as SourceError, ReloadInfo, SourceFilter};
use async_trait::async_trait;
use buf_redux::Buffer;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio_serial::{SerialPortBuilderExt, SerialStream};

pub struct SerialSource {
    buf_reader: BufReader<SerialStream>,
    string_buffer: String,
    buffer: Buffer,
    amount: usize,
}

impl SerialSource {
    pub fn new(path: &str, baud_rate: u32) -> Result<Self, SourceError> {
        Ok(Self {
            buf_reader: BufReader::new(
                tokio_serial::new(path, baud_rate)
                    .open_native_async()
                    .map_err(|e| {
                        SourceError::Setup(format!("Failed to open serial port {}: {}", path, e))
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
