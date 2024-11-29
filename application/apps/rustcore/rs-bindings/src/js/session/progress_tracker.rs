use log::trace;
use node_bindgen::derive::node_bindgen;
use session::progress::{run_tracking, ProgressCommand, ProgressTrackerAPI};
use std::thread;
use stypes::LifecycleTransition;
use tokio::{runtime::Runtime, sync::mpsc::UnboundedReceiver};

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
    async fn init<F: Fn(LifecycleTransition) + Send + 'static>(
        &mut self,
        callback: F,
    ) -> Result<(), stypes::ComputationError> {
        let rt = Runtime::new().map_err(|e| {
            stypes::ComputationError::Process(format!("Could not start tokio runtime: {e}"))
        })?;
        if let Some(rx_events) = self.rx_events.take() {
            let (result_tx, result_rx) = std::sync::mpsc::channel();
            thread::spawn(move || {
                rt.block_on(async {
                    trace!("progress_tracker thread running");
                    match run_tracking(rx_events).await {
                        Ok(mut rx) => {
                            let _ = result_tx.send(Ok(()));
                            while let Some(progress_report) = rx.recv().await {
                                callback(progress_report)
                            }
                        }
                        Err(e) => {
                            let _ = result_tx.send(Err(e));
                        }
                    }
                })
            });
            result_rx.recv().map_err(|_| {
                stypes::ComputationError::Protocol("could not setup tracking".to_string())
            })?
        } else {
            Err(stypes::ComputationError::Protocol(
                "Could not init progress_tracker".to_string(),
            ))
        }
    }

    #[node_bindgen]
    async fn stats(&self) -> Result<String, stypes::ComputationError> {
        self.tracker_api.content().await
    }

    #[node_bindgen]
    async fn destroy(&self) -> Result<(), stypes::ComputationError> {
        self.tracker_api.abort().await
    }
}
