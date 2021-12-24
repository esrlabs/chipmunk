use super::Error;
use log::{debug, warn};
use std::path::PathBuf;
use std::time::SystemTime;
use thiserror::Error as ThisError;
use tokio::{
    fs::File,
    io::AsyncWriteExt,
    select,
    sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
    task,
    time::{sleep, Duration},
};
use tokio_util::sync::CancellationToken;

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
    ) -> Result<Self, Error> {
        let (tx_task, rx_task): (UnboundedSender<Task>, UnboundedReceiver<Task>) =
            unbounded_channel();
        Writer::task(file, rx_task, tx_task.clone(), tx_flush, shutdown.clone()).await?;
        Ok(Self { tx_task })
    }

    pub fn send(&self, buffer: Vec<u8>) -> Result<(), Error> {
        self.tx_task
            .send(Task::Chunk(buffer))
            .map_err(|e| Error::Channel(e.to_string()))?;
        Ok(())
    }

    async fn task(
        file: &PathBuf,
        mut rx_task: UnboundedReceiver<Task>,
        tx_task: UnboundedSender<Task>,
        tx_flush: UnboundedSender<usize>,
        cancel: CancellationToken,
    ) -> Result<(), Error> {
        let mut file = File::create(file)
            .await
            .map_err(|e| Error::IO(e.to_string()))?;
        task::spawn(async move {
            let mut buffer: Vec<u8> = vec![];
            let mut last = SystemTime::now();
            while let Some(task) = select! {
                task = rx_task.recv() => task,
                _ = async {
                    sleep(Duration::from_millis(FLUSH_IN_MS as u64)).await;
                } => Some(Task::Flush),
                _ = cancel.cancelled() => None,
            } {
                match task {
                    Task::Chunk(chunk) => {
                        buffer = [buffer, chunk].concat();
                        match last.elapsed() {
                            Ok(elapsed) => {
                                if elapsed.as_millis() < FLUSH_IN_MS {
                                    if let Err(err) = tx_task.send(Task::Flush) {
                                        // TODO: error report
                                        return;
                                    }
                                }
                            }
                            Err(err) => {
                                // TODO: error report
                                return;
                            }
                        }
                    }
                    Task::Flush => {
                        if let Err(err) = file.write(&buffer).await {
                            // TODO: error report
                            return;
                        }
                        if let Err(err) = tx_flush.send(buffer.len()) {
                            // TODO: error report
                            return;
                        }
                        buffer = vec![];
                        last = SystemTime::now();
                    }
                }
            }
        });
        Ok(())
    }
}
