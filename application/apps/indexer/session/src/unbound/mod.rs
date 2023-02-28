mod commands;
mod folder;

use log::debug;
use std::collections::HashMap;

use thiserror::Error;
use tokio::{sync::mpsc, task::JoinError};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::unbound::commands::process;

use self::commands::Command;

#[derive(Error, Debug)]
pub enum ExecutionError {
    #[error("Internal communication error ({0})")]
    Communication(String),
}
impl From<JoinError> for ExecutionError {
    fn from(err: JoinError) -> ExecutionError {
        ExecutionError::Communication(format!("{err}"))
    }
}

pub enum JobOutcome {
    Finished(String),
    Aborted,
}

pub struct UnboundExecutor {
    running: HashMap<Uuid, CancellationToken>,
    work_queue: mpsc::Sender<(Command, CancellationToken, Uuid)>,
    join_handle: tokio::task::JoinHandle<Result<usize, std::io::Error>>,
    stop_token: CancellationToken,
    // remember all finished jobs
    remove_channel: mpsc::Receiver<Uuid>,
}

impl UnboundExecutor {
    pub async fn new() -> Self {
        let mut work_channel = mpsc::channel::<(Command, CancellationToken, Uuid)>(10);
        let uuid_channel = mpsc::channel::<Uuid>(100);
        let stop_token = CancellationToken::new();
        let stop = stop_token.clone();
        let mut count = 0;
        let join_handle = tokio::spawn(async move {
            loop {
                let finished_channel = uuid_channel.0.clone();
                tokio::select! {
                    elem = work_channel.1.recv() => {
                        count += 1;
                        match elem {
                            Some((work, cancel, uuid)) => {
                                debug!("received work");
                                tokio::spawn(async move {
                                    process(work, uuid, cancel).await;
                                    let _ = finished_channel.send(uuid).await;
                                });
                            }
                            None => break,
                        }
                    }
                    _ = stop.cancelled() => {
                        debug!("we got cancelled");
                        break;
                    }
                };
            }
            Ok(count)
        });

        Self {
            running: HashMap::new(),
            work_queue: work_channel.0,
            join_handle,
            stop_token,

            remove_channel: uuid_channel.1,
        }
    }

    pub fn cancel(&mut self) {
        debug!("cancel: {} in map", self.running.len());
        self.clean_finished();
        self.running.iter().for_each(|(_, v)| {
            v.cancel();
        });
        self.stop_token.cancel();
    }

    pub async fn join_executor(self) -> Result<usize, std::io::Error> {
        self.join_handle.await?
    }

    fn clean_finished(&mut self) {
        debug!("executor::clean finished");
        while let Ok(id) = self.remove_channel.try_recv() {
            self.running.remove(&id);
            debug!("cleanning {id}...");
        }
        debug!("cleanning done");
    }

    pub async fn cancel_job(&mut self, uuid: Uuid) {
        self.clean_finished();
        if let Some(cancel_token) = self.running.remove(&uuid) {
            cancel_token.cancel();
        }
    }

    pub async fn enqueue(&mut self, work: Command) -> Result<Uuid, ExecutionError> {
        self.clean_finished();
        let id = Uuid::new_v4();
        let t = CancellationToken::new();
        self.running.insert(id, t.clone());
        self.work_queue
            .send((work, t, id))
            .await
            .map_err(|e| ExecutionError::Communication(format!("{e}")))?;
        debug!("enqueued {id}");
        Ok(id)
    }
}
