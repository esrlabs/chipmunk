use node_bindgen::derive::node_bindgen;
use session::events::{ComputationError, LifecycleTransition};
use std::{collections::HashSet, thread};
use tokio::{runtime::Runtime, select, sync::mpsc};
use tokio_util::sync::CancellationToken;

use lazy_static::lazy_static;
use std::sync::Mutex;

use super::events::ComputationErrorWrapper;

lazy_static! {
    pub static ref TRACKER_CHANNEL: Mutex<(
        mpsc::UnboundedSender<LifecycleTransition>,
        Option<mpsc::UnboundedReceiver<LifecycleTransition>>
    )> = {
        let (tx, rx) = mpsc::unbounded_channel();
        Mutex::new((tx, Some(rx)))
    };
}

struct ProgressTracker {
    confirmation: CancellationToken,
    cancel_token: CancellationToken,
}

#[node_bindgen]
impl ProgressTracker {
    #[node_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            confirmation: CancellationToken::new(),
            cancel_token: CancellationToken::new(),
        }
    }

    #[node_bindgen(mt)]
    fn init(&mut self) -> Result<(), ComputationErrorWrapper> {
        let rt = Runtime::new().map_err(|e| {
            ComputationError::Process(format!("Could not start tokio runtime: {e}"))
        })?;
        let mut tx_rx = TRACKER_CHANNEL.lock().map_err(|e| {
            ComputationError::Communication(format!("Cannot init channels from mutex: {e}"))
        })?;
        let mut rx = tx_rx.1.take().ok_or(ComputationError::Communication(
            "channel not initialized".to_string(),
        ))?;
        let cancel = self.cancel_token.clone();
        let confirmation = self.confirmation.clone();
        thread::spawn(move || {
            rt.block_on(async {
                println!("progress_tracker thread running");
                let mut ongoing_operations: HashSet<String> = HashSet::new();
                loop {
                    select! {
                         _ = cancel.cancelled() => {
                            println!("ProgressTracker cancelled, content: {ongoing_operations:?}");
                            break;
                        }
                        event = rx.recv() => {
                            match event {
                                Some(LifecycleTransition::Started(uuid)) => {
                                    println!("job {uuid} started");
                                    ongoing_operations.insert(uuid);
                                }
                                Some(LifecycleTransition::Stopped(uuid) )=> {
                                    println!("job {uuid} stopped");
                                    ongoing_operations.remove(&uuid);
                                }
                                None => break,
                            }
                        }
                    }
                }
                confirmation.cancel();
            })
        });
        Ok(())
    }

    #[node_bindgen]
    async fn shutdown(&self) {
        self.cancel_token.cancel();
        self.confirmation.cancelled().await;
    }
}
