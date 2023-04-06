use super::events::{ComputationErrorWrapper, LifecycleTransitionWrapper};
use log::trace;
use node_bindgen::derive::node_bindgen;
use session::{
    events::ComputationError,
    progress::{run_tracking, ProgressCommand, ProgressTrackerAPI},
};
use std::thread;
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
    async fn init<F: Fn(LifecycleTransitionWrapper) + Send + 'static>(
        &mut self,
        callback: F,
    ) -> Result<(), ComputationErrorWrapper> {
        let rt = Runtime::new().map_err(|e| {
            ComputationError::Process(format!("Could not start tokio runtime: {e}"))
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
                                callback(LifecycleTransitionWrapper(progress_report))
                            }
                        }
                        Err(e) => {
                            let _ = result_tx.send(Err(e));
                        }
                    }
                })
            });
            result_rx
                .recv()
                .map_err(|_| {
                    ComputationErrorWrapper(ComputationError::Protocol(
                        "could not setup tracking".to_string(),
                    ))
                })?
                .map_err(ComputationErrorWrapper)
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
    async fn destroy(&self) -> Result<(), ComputationErrorWrapper> {
        self.tracker_api
            .abort()
            .await
            .map_err(ComputationErrorWrapper)
    }
}
