use crate::js::events::*;
use crate::js::session::OperationAction;
use crossbeam_channel as cc;
use indexer_base::progress::IndexingResults;
use neon::prelude::*;
use processor::grabber::{GrabMetadata, Grabber, LineRange};

pub struct GrabberAction {
    pub grabber: Grabber,
    pub handler: Option<EventHandler>,
    pub shutdown_channel: Channel<()>,
    pub event_channel: Channel<IndexingResults<()>>,
    pub metadata_channel: Channel<Option<GrabMetadata>>,
}

impl OperationAction for GrabberAction {
    fn prepare(
        &self,
        result_sender: cc::Sender<IndexingResults<()>>,
        shutdown_rx: Option<ShutdownReceiver>,
    ) -> Result<(), ComputationError> {
        match Grabber::create_metadata_for_file(
            self.grabber.path.clone(),
            &result_sender,
            shutdown_rx,
        ) {
            Ok(metadata) => {
                println!("RUST: constructed metadata, sending into channel");
                let _ = self.metadata_channel.0.send(metadata);
                Ok(())
            }
            Err(e) => {
                println!("Error during metadata creation: {}", e);
                Err(ComputationError::Communication(
                    "Could not create metadata".to_string(),
                ))
            }
        }
    }

    fn sync_computation(
        &mut self,
        start_line_index: u64,
        number_of_lines: u64,
    ) -> Result<Vec<String>, ComputationError> {
        println!("sync_computation 1");
        if self.grabber.metadata.is_none() {
            match self.metadata_channel.1.try_recv() {
                Err(cc::TryRecvError::Empty) => {
                    println!("RUST: metadata not initialized");
                }
                Err(e) => {
                    println!("RUST: Error: {}", e);
                }
                Ok(md) => {
                    println!("RUST: Received completed metadata");
                    self.grabber.metadata = md;
                }
            }
        }
        println!("sync_computation 2");
        self.grabber
            .get_entries(&LineRange::new(
                start_line_index as u64,
                start_line_index as u64 + number_of_lines as u64,
            ))
            .map_err(|e| ComputationError::Communication(format!("{}", e)))
    }
}
