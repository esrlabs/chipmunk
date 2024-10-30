pub mod api;
mod cleanup;
pub mod commands;
mod signal;

use crate::{
    events::ComputationError,
    progress::ProgressProviderAPI,
    unbound::{
        api::{UnboundSessionAPI, API},
        signal::Signal,
    },
};
use cleanup::cleanup_temp_dir;
use log::{debug, error, warn};
use std::collections::HashMap;
use tokio::{
    sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
    time::{timeout, Duration},
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub const CANCEL_OPERATIONS_TIMEOUT: u64 = 2000;

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
        let progress = ProgressProviderAPI::new()?;
        let session_api = self.session_api.clone();
        tokio::spawn(async move {
            let mut jobs: HashMap<u64, Signal> = HashMap::new();
            let mut uuids: HashMap<u64, Uuid> = HashMap::new();
            while let Some(api) = rx.recv().await {
                jobs.retain(|id, signal| {
                    let cancelled = signal.is_cancelled();
                    if cancelled {
                        UnboundSession::stopped(&progress, &uuids, id);
                    }
                    !cancelled
                });
                match api {
                    API::Run(job, id) => {
                        let signal = Signal::new(job.to_string());
                        if jobs.contains_key(&id) {
                            commands::err(
                                job,
                                ComputationError::InvalidArgs(String::from(
                                    "Job has invalid id. Id already exists.",
                                )),
                            );
                            continue;
                        }
                        jobs.insert(id, signal.clone());
                        UnboundSession::started(&progress, job.to_string(), &mut uuids, &id);
                        let api = session_api.clone();
                        tokio::spawn(async move {
                            debug!("Job {job} has been called");
                            commands::process(job, signal.clone()).await;
                            signal.confirm();
                            let _ = api.remove_command(id);
                        });
                    }
                    API::CancelJob(id) => {
                        if let Some(signal) = jobs.get(&id) {
                            signal.invoke();
                            debug!("Cancel signal has been sent to job {} ({id})", signal.alias);
                        } else {
                            warn!("Fail to cancel job; id {id} doesn't exist.");
                        }
                    }
                    API::Shutdown(tx) => {
                        jobs.iter().for_each(|(_uuid, signal)| {
                            signal.invoke();
                        });
                        match timeout(Duration::from_millis(CANCEL_OPERATIONS_TIMEOUT), async {
                            for (id, signal) in jobs.iter() {
                                signal.confirmed().await;
                                UnboundSession::stopped(&progress, &uuids, id);
                            }
                        })
                        .await {
                            Ok(_) => debug!("All jobs of unbound session are down"),
                            Err(_) => warn!("Unbound session wasn't shutdown normaly. Force shutdown because timeout {CANCEL_OPERATIONS_TIMEOUT}"),
                        }
                        jobs.clear();
                        if tx.send(()).is_err() {
                            error!("Fail to send shutdown confirmation");
                        }
                        break;
                    }
                    API::Remove(id) => {
                        if jobs.remove(&id).is_some() {
                            UnboundSession::stopped(&progress, &uuids, &id);
                        }
                    }
                }
            }
            finished.cancel();
            debug!("Unbound session is down");
        });

        // Call cleanup here because this function should be called once when chipmunk starts.
        // Run cleaning up on a separate thread to avoid latency in startup in case temporary
        // directory has a lot of entries to cleanup.
        tokio::task::spawn_blocking(|| {
            if let Err(err) = cleanup_temp_dir() {
                log::error!("Error while cleaning up temporary directory. Error: {err:?}");
            }
        });

        Ok(())
    }

    fn started(
        progress: &ProgressProviderAPI,
        alias: String,
        uuids: &mut HashMap<u64, Uuid>,
        id: &u64,
    ) {
        let uuid = Uuid::new_v4();
        uuids.insert(*id, uuid);
        progress.started(&alias, &uuid);
    }

    fn stopped(progress: &ProgressProviderAPI, uuids: &HashMap<u64, Uuid>, id: &u64) {
        if let Some(uuid) = uuids.get(id) {
            progress.stopped(uuid);
        } else {
            error!("Fail to find UUID for operation id={id}");
        }
    }
}
