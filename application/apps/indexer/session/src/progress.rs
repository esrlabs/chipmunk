use crate::{
    events::{ComputationError, LifecycleTransition},
    TRACKER_CHANNEL,
};
use indexer_base::progress::Ticks;
use log::info;
use std::collections::HashMap;
use tokio::{
    select,
    sync::{
        mpsc::{self, unbounded_channel, UnboundedReceiver, UnboundedSender},
        oneshot,
    },
};
use uuid::Uuid;

/// Commands used to control/query the progress tracking
#[derive(Debug)]
pub enum ProgressCommand {
    Content(oneshot::Sender<Result<String, ComputationError>>),
    Abort(oneshot::Sender<Result<(), ComputationError>>),
}

/// The ProgressTrackerAPI enables safe access to the state of the progress of
/// all ongoing operations (all unbound jobs and all operations in every session)
#[derive(Clone, Debug)]
pub struct ProgressTrackerAPI {
    tx_api: UnboundedSender<ProgressCommand>,
}

impl ProgressTrackerAPI {
    /// creates a ProgressTrackerAPI along with a channel that needs
    /// to be passed to the run_tracking function
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

/// Keep track of all ongoing operations and jobs
/// All jobs and operations are identified with UUIDs. Here we receive updates about the
/// progress of those long-runing operations.
/// At any time, we can then track the progress of everything that is going on
pub async fn run_tracking(
    mut command_rx: UnboundedReceiver<ProgressCommand>,
) -> Result<mpsc::Receiver<LifecycleTransition>, ComputationError> {
    let mut ongoing_operations: HashMap<Uuid, Ticks> = HashMap::new();
    let lifecycle_events_channel = mpsc::channel(1);

    let mut lifecycle_events = {
        let mut tx_rx = TRACKER_CHANNEL.lock().map_err(|e| {
            ComputationError::Communication(format!("Cannot init channels from mutex: {e}"))
        })?;
        tx_rx.1.take().ok_or(ComputationError::Communication(
            "ProgressTracker channel already taken".to_string(),
        ))?
    };

    tokio::spawn(async move {
        loop {
            select! {
                command = command_rx.recv() => {
                    match command {
                        Some(ProgressCommand::Content(result_channel)) => {
                            let res = serde_json::to_string(&ongoing_operations)
                                .map_err(|e| ComputationError::Process(format!("{e}")));
                            let _ = result_channel.send(res);
                        }
                        Some(ProgressCommand::Abort(result_channel)) => {
                            let _ = result_channel.send(Ok(()));
                            break;
                        }
                        None => break,
                    }
                }
                lifecycle_event = lifecycle_events.recv() => {
                    match lifecycle_event {
                        Some(LifecycleTransition::Started(uuid)) => {
                            info!("job {uuid} started");
                            ongoing_operations.insert(uuid, Ticks::new());
                            let _ = lifecycle_events_channel.0.send(LifecycleTransition::Started(uuid)).await;
                        }
                        Some(LifecycleTransition::Stopped(uuid)) => {
                            info!("job {uuid} stopped");
                            ongoing_operations.remove(&uuid);
                            let _ = lifecycle_events_channel.0.send(LifecycleTransition::Stopped(uuid)).await;
                        }
                        Some(LifecycleTransition::Ticks((uuid, ticks))) => {
                            info!("job {uuid} reported progress: {ticks:?}");
                            ongoing_operations.insert(uuid, Ticks::new());
                            let _ = lifecycle_events_channel.0.send(LifecycleTransition::Stopped(uuid)).await;
                        }
                        None => break,

                    }
                }
            }
        }
    });
    Ok(lifecycle_events_channel.1)
}
