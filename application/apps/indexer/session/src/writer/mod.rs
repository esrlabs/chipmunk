use log::{debug, error, warn};
use std::path::PathBuf;
use std::time::SystemTime;
use thiserror::Error as ThisError;
use tokio::{
    fs::File,
    io::{AsyncWriteExt, BufWriter},
    select,
    sync::{
        mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
        oneshot,
    },
    task,
    time::{timeout, Duration},
};
use tokio_util::sync::CancellationToken;

#[derive(ThisError, Debug)]
pub enum Error {
    #[error("System time error: {0:?}")]
    SysTime(#[from] std::time::SystemTimeError),
    #[error("Channel error: {0}")]
    Channel(String),
    #[error("IO error: {0:?}")]
    Io(#[from] std::io::Error),
}

const FLUSH_IN_MS: u128 = 500;

enum Task {
    Chunk(Vec<u8>),
    Flush,
}

pub struct Writer {
    tx_task: UnboundedSender<Task>,
}

impl Writer {
    pub async fn new(
        file: &PathBuf,
        tx_flush: UnboundedSender<usize>,
        shutdown: CancellationToken,
    ) -> Result<(Self, oneshot::Receiver<Result<(), Error>>), Error> {
        let (tx_task, rx_task): (UnboundedSender<Task>, UnboundedReceiver<Task>) =
            unbounded_channel();
        let (tx_done, rx_done): (
            oneshot::Sender<Result<(), Error>>,
            oneshot::Receiver<Result<(), Error>>,
        ) = oneshot::channel();
        Writer::task(
            file,
            rx_task,
            tx_task.clone(),
            tx_flush,
            shutdown.clone(),
            tx_done,
        )
        .await?;
        Ok((Self { tx_task }, rx_done))
    }

    pub fn send<'a>(&self, buffer: impl Iterator<Item = &'a u8>) -> Result<(), Error> {
        self.tx_task
            .send(Task::Chunk(buffer.cloned().collect()))
            .map_err(|e| Error::Channel(e.to_string()))?;
        Ok(())
    }

    async fn task(
        file: &PathBuf,
        mut rx_task: UnboundedReceiver<Task>,
        tx_task: UnboundedSender<Task>,
        tx_flush: UnboundedSender<usize>,
        cancel: CancellationToken,
        tx_done: oneshot::Sender<Result<(), Error>>,
    ) -> Result<(), Error> {
        let mut writer = BufWriter::new(File::create(file).await.map_err(Error::Io)?);
        task::spawn(async move {
            let mut last = SystemTime::now();
            while let Some(task) = select! {
                task = async {
                    match timeout(Duration::from_millis(FLUSH_IN_MS as u64), rx_task.recv()).await {
                        Ok(task) => task,
                        Err(_) => Some(Task::Flush),
                    }
                } => task,
                _ = cancel.cancelled() => None,
            } {
                match task {
                    Task::Chunk(chunk) => {
                        if let Err(err) = writer.write(&chunk).await {
                            if tx_done.send(Err(Error::Io(err))).is_err() {
                                error!("Fail to send finish signal from writer.");
                            }
                            return;
                        }
                        match last.elapsed() {
                            Ok(elapsed) => {
                                if elapsed.as_millis() < FLUSH_IN_MS {
                                    if let Err(err) = tx_task.send(Task::Flush) {
                                        if tx_done
                                            .send(Err(Error::Channel(err.to_string())))
                                            .is_err()
                                        {
                                            error!("Fail to send finish signal from writer.");
                                        }
                                        return;
                                    }
                                }
                            }
                            Err(err) => {
                                if tx_done.send(Err(Error::SysTime(err))).is_err() {
                                    error!("Fail to send finish signal from writer.");
                                }
                                return;
                            }
                        }
                    }
                    Task::Flush => {
                        let len = writer.buffer().len();
                        if let Err(err) = writer.flush().await {
                            if tx_done.send(Err(Error::Io(err))).is_err() {
                                error!("Fail to send finish signal from writer.");
                            }
                            return;
                        }
                        if let Err(err) = tx_flush.send(len) {
                            if tx_done.send(Err(Error::Channel(err.to_string()))).is_err() {
                                error!("Fail to send finish signal from writer.");
                            }
                            return;
                        }
                        last = SystemTime::now();
                    }
                }
            }
            if tx_done.send(Ok(())).is_err() {
                error!("Fail to send finish signal from writer.");
            }
        });
        Ok(())
    }
}
