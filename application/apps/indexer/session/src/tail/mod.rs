extern crate notify;
use log::{debug, warn};
use notify::{watcher, DebouncedEvent, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::mpsc::channel;
use std::time::Duration;
use std::time::SystemTime;
use thiserror::Error as ThisError;
use tokio::{
    fs::File,
    io::AsyncWriteExt,
    select,
    sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
    task,
};
use tokio_util::sync::CancellationToken;

const TRACKING_INTERVAL_MS: u64 = 2000;

#[derive(ThisError, Debug)]
pub enum Error {
    #[error("IO error: {0}")]
    IO(String),
    #[error("System time error: {0}")]
    SysTime(String),
    #[error("Channel error: {0}")]
    Channel(String),
}

pub struct Tracker {}

impl Tracker {
    pub async fn new(
        file: PathBuf,
        tx_update: UnboundedSender<()>,
        shutdown: CancellationToken,
    ) -> Self {
        Tracker::listen(file, tx_update, shutdown).await;
        Self {}
    }

    pub async fn listen(
        file: PathBuf,
        tx_update: UnboundedSender<()>,
        shutdown: CancellationToken,
    ) {
        task::spawn(async move {
            let (tx, rx) = channel();
            let mut watcher = match watcher(tx, Duration::from_millis(TRACKING_INTERVAL_MS)) {
                Ok(watcher) => watcher,
                Err(err) => {
                    //TODO: report error
                    return;
                }
            };
            if let Err(err) = watcher.watch(file, RecursiveMode::Recursive) {
                //TODO: report error
                return;
            }
            select! {
                _ = async move {
                    while let Ok(event) = rx.recv() {
                        if let DebouncedEvent::NoticeWrite(_) = event {
                            if let Err(err) = tx_update.send(()) {
                                //TODO: report error
                                break;
                            }
                        }
                    }
                } => (),
                _ = shutdown.cancelled() => (),
            };
        });
    }
}
