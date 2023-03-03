use log::debug;
use node_bindgen::derive::node_bindgen;
use session::events::ComputationError;
use std::{collections::HashMap, thread};
use tokio::{runtime::Runtime, sync::mpsc};

use lazy_static::lazy_static;
use std::sync::Mutex;
use uuid::Uuid;

use super::events::{CallbackEventWrapper, ComputationErrorWrapper};

lazy_static! {
    pub static ref TRACKER_CHANNEL: Mutex<(
        mpsc::UnboundedSender<String>,
        Option<mpsc::UnboundedReceiver<String>>
    )> = {
        let (tx, rx) = mpsc::unbounded_channel();
        Mutex::new((tx, Some(rx)))
    };
}

struct ProgressTracker {
    uuid: Uuid,
}

#[node_bindgen]
impl ProgressTracker {
    #[node_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            uuid: Uuid::new_v4(),
        }
    }

    #[node_bindgen(mt)]
    async fn init<F: Fn(CallbackEventWrapper) + Send + 'static>(
        &mut self,
        callback: F,
    ) -> Result<(), ComputationErrorWrapper> {
        let rt = Runtime::new().map_err(|e| {
            ComputationError::Process(format!("Could not start tokio runtime: {e}"))
        })?;
        let uuid = self.uuid;
        let mut rx = TRACKER_CHANNEL
            .lock()
            .map_err(|e| {
                ComputationError::Communication(format!("Cannot init channels from mutex: {e}"))
            })?
            .1
            .take()
            .ok_or(ComputationError::Communication(
                "channel not initialized".to_string(),
            ))?;
        thread::spawn(move || {
            rt.block_on(async {
                let mut ongoing_operations: HashMap<Uuid, ()> = HashMap::new();
                while let Some(event) = rx.recv().await {
                    debug!("inside loop");
                    println!("dmitry wants to print: {event}");
                }
            })
        });
        Ok(())
    }
}
