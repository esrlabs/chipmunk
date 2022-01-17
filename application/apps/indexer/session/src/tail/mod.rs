extern crate notify;
use log::error;
use notify::{watcher, DebouncedEvent, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::time::Duration;
use thiserror::Error as ThisError;
use tokio::{
    select,
    sync::{
        mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
        oneshot,
    },
    task,
};
use tokio_util::sync::CancellationToken;

const TRACKING_INTERVAL_MS: u64 = 2000;

#[derive(ThisError, Debug)]
pub enum Error {
    #[error("IO error: {0}")]
    Io(notify::Error),
    #[error("System time error: {0}")]
    SysTime(String),
    #[error("Channel error: {0}")]
    Channel(String),
}

pub struct Tracker {}

impl Tracker {
    pub async fn create(
        file: PathBuf,
        shutdown: CancellationToken,
    ) -> Result<UnboundedReceiver<Result<(), Error>>, Error> {
        let (tx_update, rx_update): (
            UnboundedSender<Result<(), Error>>,
            UnboundedReceiver<Result<(), Error>>,
        ) = unbounded_channel();
        Tracker::listen(file, tx_update, shutdown).await?;
        Ok(rx_update)
    }

    pub async fn listen(
        file: PathBuf,
        tx_update: UnboundedSender<Result<(), Error>>,
        shutdown: CancellationToken,
    ) -> Result<(), Error> {
        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher =
            watcher(tx, Duration::from_millis(TRACKING_INTERVAL_MS)).map_err(Error::Io)?;
        watcher
            .watch(file, RecursiveMode::Recursive)
            .map_err(Error::Io)?;
        task::spawn(async move {
            let tx_update_result = tx_update.clone();
            let res = select! {
                res = async move {
                    while let Ok(event) = rx.recv() {
                        if let DebouncedEvent::NoticeWrite(_) = event {
                            if let Err(err) = tx_update.send(Ok(())) {
                                return Err(Error::Channel(format!("Fail to send update signal: {}", err)));
                            }
                        }
                    }
                    Ok(())
                } => res,
                _ = shutdown.cancelled() => Ok(()),
            };
            if tx_update_result.send(res).is_err() {
                error!("Fail to send finish signal from tracker.");
            }
        });
        Ok(())
    }
}
