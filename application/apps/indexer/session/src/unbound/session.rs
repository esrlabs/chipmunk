use crate::{
    events::ComputationError,
    unbound::{
        api::{SessionAPI, API},
        job,
        job::Job,
        signal::Signal,
    },
};
use log::{debug, error, warn};
use std::collections::HashMap;
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub struct Session {
    rx: Option<UnboundedReceiver<API>>,
    pub finished: CancellationToken,
}

impl Session {
    pub fn new() -> (Self, SessionAPI) {
        let (tx, rx): (UnboundedSender<API>, UnboundedReceiver<API>) = unbounded_channel();
        (
            Self {
                rx: Some(rx),
                finished: CancellationToken::new(),
            },
            SessionAPI::new(tx),
        )
    }

    async fn run(job: Job, signal: &Signal) -> Result<(), ComputationError> {
        match job {
            Job::CancelTest(custom_arg_a, custom_arg_b, tx_results) => tx_results
                .send(job::cancel_test::handler(custom_arg_a, custom_arg_b, signal.clone()).await)
                .map_err(|_| {
                    ComputationError::Communication(String::from("Channel of job is closed"))
                }),
        }
    }

    pub async fn init(&mut self) -> Result<(), ComputationError> {
        let finished = self.finished.clone();
        let mut rx = self.rx.take().ok_or(ComputationError::SessionUnavailable)?; // Error: session already running
        tokio::spawn(async move {
            let mut jobs: HashMap<Uuid, Signal> = HashMap::new();
            while let Some(api) = rx.recv().await {
                jobs.retain(|_uuid, signal| !signal.is_cancelled());
                match api {
                    API::Run(job, tx_uuid) => {
                        let uuid = Uuid::new_v4();
                        let signal = Signal::new(job.to_string());
                        jobs.insert(uuid, signal.clone());
                        let job_alias = job.to_string();
                        tokio::spawn(async move {
                            let job_alias = job.to_string();
                            debug!("Job {job_alias} has been called");
                            match Session::run(job, &signal).await {
                                Ok(_) => {
                                    debug!("Job {job_alias} is executed and done or canceled");
                                }
                                Err(err) => {
                                    error!("Job {job_alias} executed with error: {err}");
                                }
                            }
                            signal.confirm();
                        });
                        if tx_uuid.send(uuid).is_err() {
                            error!("Fail to send UUID of job back. Job - {job_alias}");
                        }
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
