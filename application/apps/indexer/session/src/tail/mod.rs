use log::error;
use std::path::Path;
use thiserror::Error as ThisError;
use tokio::{
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
    path: &Path,
    tx_update: Sender<Result<(), Error>>,
    shutdown: CancellationToken,
) -> Result<(), Error> {
    use tokio::fs;
    let mut size = fs::metadata(path)
        .await
        .map(|md| md.len())
        .map_err(|e| Error::Io(e.to_string()))?;
    loop {
        match timeout(
            Duration::from_millis(TRACKING_INTERVAL_MS),
            shutdown.cancelled(),
        )
        .await
        {
            Ok(_) => break,
            Err(_) => {
                let updated = fs::metadata(path)
                    .await
                    .map(|md| md.len())
                    .map_err(|e| Error::Io(e.to_string()))?;
                if updated != size {
                    size = updated;
                    if let Err(err) = tx_update.send(Ok(())).await {
                        return Err(Error::Channel(format!("Fail to send update signal: {err}")));
                    }
                }
            }
        };
    }
    Ok(())
}
