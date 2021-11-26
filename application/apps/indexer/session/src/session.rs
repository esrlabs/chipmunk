use crate::{
    events::{ComputationError, SyncChannel},
    operations::Operation,
    state::{Api, SessionStateAPI},
};
use indexer_base::progress::Severity;
use log::{debug, warn};
use processor::{
    grabber::{AsyncGrabTrait, GrabMetadata, GrabTrait},
    text_source::TextFileSource,
};
use serde::Serialize;
use std::path::PathBuf;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
use uuid::Uuid;

pub type OperationsChannel = (
    UnboundedSender<(Uuid, Operation)>,
    UnboundedReceiver<(Uuid, Operation)>,
);

#[derive(Debug)]
pub struct Session {
    pub id: String,
    pub running: bool,
    pub content_grabber: Option<Box<dyn AsyncGrabTrait>>,
    pub search_grabber: Option<Box<dyn AsyncGrabTrait>>,
    pub tx_operations: UnboundedSender<(Uuid, Operation)>,
    pub rx_operations: Option<UnboundedReceiver<(Uuid, Operation)>>,
    pub rx_state_api: Option<UnboundedReceiver<Api>>,
    pub state_api: Option<SessionStateAPI>,
    // channel to store the metadata of the search results once available
    pub search_metadata_channel: SyncChannel<Option<(PathBuf, GrabMetadata)>>,
}

impl Session {
    /// will result in a grabber that has it's metadata generated
    /// this function will first check if there has been some new metadata that was previously
    /// written to the metadata-channel. If so, this metadata is used in the grabber.
    /// If there was no new metadata, we make sure that the metadata has been set.
    /// If no metadata is available, an error is returned. That means that assign was not completed before.
    pub async fn get_updated_content_grabber(
        &mut self,
    ) -> Result<&mut Box<dyn AsyncGrabTrait>, ComputationError> {
        let current_grabber = match &mut self.content_grabber {
            Some(c) => Ok(c),
            None => {
                let msg = "Need a grabber first to work with metadata".to_owned();
                warn!("{}", msg);
                Err(ComputationError::Protocol(msg))
            }
        }?;
        if let Some(state) = self.state_api.as_ref() {
            let metadata = state
                .extract_metadata()
                .await
                .map_err(ComputationError::NativeError)?;
            if let Some(metadata) = metadata {
                current_grabber
                    .inject_metadata(metadata)
                    .map_err(|e| ComputationError::Process(format!("{:?}", e)))?;
            }
            Ok(current_grabber)
        } else {
            Err(ComputationError::SessionUnavailable)
        }
    }

    pub fn get_search_grabber(
        &mut self,
    ) -> Result<Option<&mut Box<dyn AsyncGrabTrait>>, ComputationError> {
        if self.search_grabber.is_none() && !self.search_metadata_channel.1.is_empty() {
            // We are intrested only in last message in queue, all others messages can be just dropped.
            let latest = self.search_metadata_channel.1.try_iter().last().flatten();
            if let Some((file_path, metadata)) = latest {
                type GrabberType = processor::grabber::Grabber<TextFileSource>;
                let source = TextFileSource::new(&file_path, "search_results");
                let mut grabber = match GrabberType::new(source) {
                    Ok(grabber) => grabber,
                    Err(err) => {
                        let msg = format!("Failed to create search grabber. Error: {}", err);
                        warn!("{}", msg);
                        return Err(ComputationError::Protocol(msg));
                    }
                };
                if let Err(err) = grabber.inject_metadata(metadata) {
                    let msg = format!(
                        "Failed to inject metadata into search grabber. Error: {}",
                        err
                    );
                    warn!("{}", msg);
                    return Err(ComputationError::Protocol(msg));
                }
                self.search_grabber = Some(Box::new(grabber));
            } else {
                self.search_grabber = None;
            }
        }
        let grabber = match &mut self.search_grabber {
            Some(c) => c,
            None => return Ok(None),
        };
        match grabber.get_metadata() {
            Some(_) => {
                debug!("reusing cached metadata");
                Ok(Some(grabber))
            }
            None => {
                let msg = "No metadata available for search grabber".to_owned();
                warn!("{}", msg);
                Err(ComputationError::Protocol(msg))
            }
        }
    }

    pub fn is_opened(&self) -> bool {
        if self.rx_state_api.is_some() {
            false
        } else if let Some(state_api) = self.state_api.as_ref() {
            !state_api.is_shutdown()
        } else {
            false
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct GeneralError {
    severity: Severity,
    message: String,
}
