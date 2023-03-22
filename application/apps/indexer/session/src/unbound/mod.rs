pub mod api;
pub mod commands;
mod signal;

use crate::{
    events::{ComputationError, LifecycleTransition},
    unbound::{
        api::{UnboundSessionAPI, API},
        signal::Signal,
    },
    TRACKER_CHANNEL,
};
use log::{debug, error, warn};
use std::collections::HashMap;
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub struct UnboundSession {
    rx: Option<UnboundedReceiver<API>>,
    pub finished: CancellationToken,
    session_api: UnboundSessionAPI,
}

impl UnboundSession {
    pub fn new() -> (Self, UnboundSessionAPI) {
        let (tx, rx): (UnboundedSender<API>, UnboundedReceiver<API>) = unbounded_channel();
        let session_api = UnboundSessionAPI::new(tx);
        (
            Self {
                rx: Some(rx),
                finished: CancellationToken::new(),
                session_api: session_api.clone(),
            },
            session_api,
        )
    }

    pub async fn init(&mut self) -> Result<(), ComputationError> {
        let finished = self.finished.clone();
        let mut rx = self.rx.take().ok_or(ComputationError::SessionUnavailable)?; // Error: session already running
        let tracker_tx = TRACKER_CHANNEL
            .lock()
            .map(|channels| channels.0.clone())
            .map_err(|e| {
                ComputationError::Process(format!(
                    "Could not start an unbound session, tracker_tx unavailable {e}"
                ))
            })?;

        let session_api = self.session_api.clone();
        tokio::spawn(async move {
            let mut jobs: HashMap<Uuid, Signal> = HashMap::new();
            while let Some(api) = rx.recv().await {
                jobs.retain(|uuid, signal| {
                    let cancelled = signal.is_cancelled();
                    if cancelled {
                        let _ = tracker_tx.send(LifecycleTransition::Stopped(*uuid));
                    }
                    !cancelled
                });
                match api {
                    API::Run(job, uuid) => {
                        let signal = Signal::new(job.to_string());
                        jobs.insert(uuid, signal.clone());
                        let _ = tracker_tx.send(LifecycleTransition::Started(uuid));

                        let api = session_api.clone();
                        tokio::spawn(async move {
                            debug!("Job {job} has been called");
                            crate::unbound::commands::process(job, signal.clone()).await;
                            signal.confirm();
                            let _ = api.remove_command(uuid);
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
                        for (uuid, signal) in jobs.iter() {
                            signal.confirmed().await;
                            let _ = tracker_tx.send(LifecycleTransition::Stopped(*uuid));
                        }
                        jobs.clear();
                        if tx.send(()).is_err() {
                            error!("Fail to send shutdown confirmation");
                        }
                        break;
                    }
                    API::Remove(uuid) => {
                        if jobs.remove(&uuid).is_some() {
                            let _ = tracker_tx.send(LifecycleTransition::Stopped(uuid));
                        }
                    }
                }
            }
            finished.cancel();
        });
        Ok(())
    }
}
