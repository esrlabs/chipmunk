use crate::events::{ComputationError, LifecycleTransition, NativeError};
use log::info;
use std::collections::HashSet;
use tokio::{
    select,
    sync::{
        mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
        oneshot,
    },
};

#[derive(Debug)]
pub enum ProgressCommand {
    Content(oneshot::Sender<Result<String, ComputationError>>),
    Abort(oneshot::Sender<Result<(), ComputationError>>),
}

#[derive(Clone, Debug)]
pub struct ProgressTrackerAPI {
    tx_api: UnboundedSender<ProgressCommand>,
}

impl ProgressTrackerAPI {
    pub fn new() -> (Self, UnboundedReceiver<ProgressCommand>) {
        let (tx_api, rx_api) = unbounded_channel();
        (Self { tx_api }, rx_api)
    }

    async fn exec_operation<T>(
        &self,
        command: ProgressCommand,
        rx_response: oneshot::Receiver<T>,
    ) -> Result<T, ComputationError> {
        let api_str = format!("{command:?}");
        self.tx_api.send(command).map_err(|e| {
            ComputationError::Communication(format!("Failed to send to Api::{api_str}; error: {e}"))
        })?;
        rx_response.await.map_err(|_| {
            ComputationError::Communication(format!("Failed to get response from Api::{api_str}"))
        })
    }

    pub async fn content(&self) -> Result<String, ComputationError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(ProgressCommand::Content(tx), rx)
            .await?
    }

    pub async fn abort(&self) -> Result<(), ComputationError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(ProgressCommand::Abort(tx), rx).await?
    }
}

pub struct ProgressTracker {
    ongoing_operations: HashSet<String>,
}

impl ProgressTracker {
    fn new() -> Self {
        Self {
            ongoing_operations: HashSet::new(),
        }
    }
}

pub struct ProgressTrackerHandle {
    rx_tracker_api: UnboundedReceiver<ProgressCommand>,
}

impl ProgressTrackerHandle {
    pub fn new(event_rx: UnboundedReceiver<ProgressCommand>) -> Self {
        Self {
            rx_tracker_api: event_rx,
        }
    }

    pub async fn track(
        &mut self,
        mut lifecycle_events: UnboundedReceiver<LifecycleTransition>,
    ) -> Result<(), NativeError> {
        let mut progress_tracker = ProgressTracker::new();
        loop {
            select! {
                command = self.rx_tracker_api.recv() => {
                    match command {
                        Some(ProgressCommand::Content(result_channel)) => {
                            let res = serde_json::to_string(&progress_tracker.ongoing_operations)
                                .map_err(|e| ComputationError::Process(format!("{e}")));
                            if result_channel.send(res).is_err() {
                                return Err(NativeError::channel("Could not send"));
                            }
                        }
                        Some(ProgressCommand::Abort(result_channel)) => {
                            if result_channel.send(Ok(())).is_err() {
                                return Err(NativeError::channel("Could not send"));
                            }
                            break;
                        }
                        None => break,
                    }
                }
                lifecycle_event = lifecycle_events.recv() => {
                    match lifecycle_event {
                        Some(LifecycleTransition::Started(uuid)) => {
                            info!("job {uuid} started");
                            progress_tracker.ongoing_operations.insert(uuid);
                        }
                        Some(LifecycleTransition::Stopped(uuid)) => {
                            info!("job {uuid} stopped");
                            progress_tracker.ongoing_operations.remove(&uuid);
                        }
                        None => break,

                    }
                }
            }
        }
        Ok(())
    }
}
