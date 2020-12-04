use crate::js::events::{ComputationError, ShutdownReceiver};
use crate::js::session::SessionAction;
use crossbeam_channel as cc;
use indexer_base::{
    progress::{IndexingProgress, IndexingResults},
    utils,
};
use std::{thread, time};

pub struct MockWork {}
impl MockWork {
    pub fn new() -> Self {
        Self {}
    }
}

impl SessionAction for MockWork {
    fn execute(
        &self,
        result_sender: cc::Sender<IndexingResults<()>>,
        shutdown_rx: Option<ShutdownReceiver>,
    ) -> Result<(), ComputationError> {
        let total_work = 4u64;
        for i in 0..total_work {
            if utils::check_if_stop_was_requested(shutdown_rx.as_ref(), "computation-mock") {
                result_sender
                    .send(Ok(IndexingProgress::Stopped))
                    .map_err(|_| {
                        ComputationError::Communication(
                            "Could not send Finished progress".to_string(),
                        )
                    })?;
                return Ok(());
            }
            println!("RUST: work-progress: {}", i);
            result_sender
                .send(Ok(IndexingProgress::Progress {
                    ticks: (i + 1, total_work),
                }))
                .map_err(|_| {
                    ComputationError::Communication("Could not send progress".to_string())
                })?;
            thread::sleep(time::Duration::from_millis(200));
        }
        result_sender
            .send(Ok(IndexingProgress::Finished))
            .map_err(|_| {
                ComputationError::Communication("Could not send Finished progress".to_string())
            })?;
        Ok(())
    }

    fn sync_computation(&mut self, v1: u64, v2: u64) -> Result<Vec<String>, ComputationError> {
        Ok(vec!["Mock result".to_string()])
    }
}
