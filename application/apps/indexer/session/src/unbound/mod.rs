pub mod api;
pub mod commands;
mod signal;

use crate::{
    events::ComputationError,
    unbound::{
        api::{UnboundSessionAPI, API},
        signal::Signal,
    },
};
use log::{debug, error, warn};
use std::collections::HashMap;
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub struct UnboundSession {
    rx: Option<UnboundedReceiver<API>>,
    pub finished: CancellationToken,
    // tracker_tx: mpsc::UnboundedSender<String>,
}

impl UnboundSession {
    pub fn new() -> (Self, UnboundSessionAPI) {
        let (tx, rx): (UnboundedSender<API>, UnboundedReceiver<API>) = unbounded_channel();
        (
            Self {
                rx: Some(rx),
                finished: CancellationToken::new(),
            },
            UnboundSessionAPI::new(tx),
        )
    }

    pub async fn init(&mut self) -> Result<(), ComputationError> {
        let finished = self.finished.clone();
        let mut rx = self.rx.take().ok_or(ComputationError::SessionUnavailable)?; // Error: session already running

        tokio::spawn(async move {
            let mut jobs: HashMap<Uuid, Signal> = HashMap::new();
            while let Some(api) = rx.recv().await {
                jobs.retain(|_uuid, signal| !signal.is_cancelled());
                match api {
                    API::Run(job, uuid) => {
                        let signal = Signal::new(job.to_string());
                        jobs.insert(uuid, signal.clone());
                        tokio::spawn(async move {
                            debug!("Job {job} has been called");
                            crate::unbound::commands::process(job, signal.clone()).await;
                            signal.confirm();
                        });
                    }
                    API::CancelJob(uuid) => {
                        if let Some(signal) = jobs.get(&uuid) {
                            signal.invoke();
                            debug!(
                                "Cancel signal has been sent to job {} ({uuid})",
                                signal.alias
                            );
                        } else {
                            warn!("Fail to cancel job; UUID {uuid} doesn't exist.");
                        }
                    }
                    API::Shutdown(tx) => {
                        jobs.iter().for_each(|(_uuid, signal)| {
                            signal.invoke();
                        });
                        for (_uuid, signal) in jobs.iter() {
                            signal.confirmed().await;
                        }
                        jobs.clear();
                        if tx.send(()).is_err() {
                            error!("Fail to send shutdown confirmation");
                        }
                        break;
                    }
                }
            }
            finished.cancel();
        });
        Ok(())
    }
}
