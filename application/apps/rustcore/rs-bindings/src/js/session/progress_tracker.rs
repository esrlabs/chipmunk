use super::events::ComputationErrorWrapper;
use lazy_static::lazy_static;
use node_bindgen::derive::node_bindgen;
use session::{
    events::{ComputationError, LifecycleTransition},
    progress::{ProgressCommand, ProgressTrackerAPI, ProgressTrackerHandle},
};
use std::{sync::Mutex, thread};
use tokio::{
    runtime::Runtime,
    sync::mpsc::{self, UnboundedReceiver},
};

lazy_static! {
    pub static ref TRACKER_CHANNEL: Mutex<(
        mpsc::UnboundedSender<LifecycleTransition>,
        Option<mpsc::UnboundedReceiver<LifecycleTransition>>
    )> = {
        let (tx, rx) = mpsc::unbounded_channel();
        Mutex::new((tx, Some(rx)))
    };
}

struct RustProgressTracker {
    tracker_api: ProgressTrackerAPI,
    rx_events: Option<UnboundedReceiver<ProgressCommand>>,
}

#[node_bindgen]
impl RustProgressTracker {
    #[node_bindgen(constructor)]
    pub fn new() -> Self {
        let (tracker_api, rx_events) = ProgressTrackerAPI::new();
        Self {
            tracker_api,
            rx_events: Some(rx_events),
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
        let rx = tx_rx.1.take().ok_or(ComputationError::Communication(
            "channel not initialized".to_string(),
        ))?;
        if let Some(rx_events) = self.rx_events.take() {
            thread::spawn(move || {
                rt.block_on(async {
                    println!("progress_tracker thread running");
                    let mut progress_tracker = ProgressTrackerHandle::new(rx_events);
                    progress_tracker.track(rx).await
                })
            });
            Ok(())
        } else {
            Err(ComputationErrorWrapper(ComputationError::Protocol(
                "Could not init progress_tracker".to_string(),
            )))
        }
    }

    #[node_bindgen]
    async fn stats(&self) -> Result<String, ComputationErrorWrapper> {
        self.tracker_api
            .content()
            .await
            .map_err(ComputationErrorWrapper)
    }

    #[node_bindgen]
    async fn shutdown(&self) -> Result<(), ComputationErrorWrapper> {
        self.tracker_api
            .abort()
            .await
            .map_err(ComputationErrorWrapper)
    }
}
