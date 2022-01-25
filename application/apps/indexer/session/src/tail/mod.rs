use log::error;
use std::path::PathBuf;
use thiserror::Error as ThisError;
use tokio::{
    fs::File,
    sync::mpsc::Sender,
    time::{timeout, Duration},
};
use tokio_util::sync::CancellationToken;

const TRACKING_INTERVAL_MS: u64 = 1000;

#[derive(ThisError, Debug)]
pub enum Error {
    #[error("IO error: {0}")]
    Io(String),
    #[error("Channel error: {0}")]
    Channel(String),
}

pub async fn track(
    path: PathBuf,
    tx_update: Sender<Result<(), Error>>,
    shutdown: CancellationToken,
) -> Result<(), Error> {
    let file = File::open(path)
        .await
        .map_err(|e| Error::Io(e.to_string()))?;
    let metadata = file
        .metadata()
        .await
        .map_err(|e| Error::Io(e.to_string()))?;
    let mut size = metadata.len();
    loop {
        match timeout(
            Duration::from_millis(TRACKING_INTERVAL_MS as u64),
            shutdown.cancelled(),
        )
        .await
        {
            Ok(_) => break,
            Err(_) => {
                let metadata = file
                    .metadata()
                    .await
                    .map_err(|e| Error::Io(e.to_string()))?;
                let updated = metadata.len();
                if updated != size {
                    size = updated;
                    if let Err(err) = tx_update.send(Ok(())).await {
                        return Err(Error::Channel(format!(
                            "Fail to send update signal: {}",
                            err
                        )));
                    }
                }
            }
        };
    }
    Ok(())
}
