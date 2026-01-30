// MCP API for handling communication between the Chipmunk application and the MCP client/server.
// Contains functinality to:
// - create and manage MCP API instances
// - run the MCP event loop to process incoming messages
// - methods to send messages to the MCP client and server

use log::{error, warn};
use tokio::select;
use tokio::sync::mpsc;
use tokio::sync::mpsc::UnboundedSender;
use uuid::Uuid;

use crate::operations::{Operation, OperationKind};
use crate::state::SessionStateAPI;
use crate::tracker::OperationTrackerAPI;
use mcp::errors::McpError;
use mcp::server::tasks::Tasks;
use mcp::types::{Prompt, Response};
use processor::search::filter::SearchFilter;

#[derive(Debug, Clone)]
pub struct McpApi {
    pub prompt_tx: mpsc::Sender<Prompt>,
}

impl McpApi {
    pub fn new(prompt_tx: mpsc::Sender<Prompt>) -> Self {
        Self { prompt_tx }
    }

    /// TODO:[MCP] Send a prompt to the Chipmunk MCP client. The prompt would typically come from the UI.
    /// The arguments probably need to be tweaked to also include the session
    pub async fn send_prompt(&self, prompt: String) -> Result<(), stypes::NativeError> {
        warn!("✅ Sending prompt to the client over `prompt_tx` channel");
        self.prompt_tx
            .send(prompt.clone())
            .await
            .map_err(|_| stypes::NativeError::channel(&format!("Failed to get send::{:?}", prompt)))
    }
}

pub async fn run(
    session_uuid: Uuid,
    mut task_rx: tokio::sync::mpsc::Receiver<Tasks>,
    mut _response_rx: tokio::sync::mpsc::Receiver<Response>,
    tx_operations: UnboundedSender<Operation>,
) {
    loop {
        select! {
            Some(server_request) = task_rx.recv() => {
                match server_request {
                    Tasks::ApplySearchFilter {filters, task_result_tx} => {

                        warn!(
                            "🟢 Chipmunk core received tool invocation ApplySearchFilter: {:?}", filters
                        );

                        let filters = filters.iter().map(|f| SearchFilter::new(f.value.clone(), f.is_regex, f.ignore_case, f.is_word)).collect();

                        let operation = Operation::new(
                            session_uuid,
                            OperationKind::Search { filters },
                        );

                        if let Err(err) = tx_operations.send(operation) {
                            let _ = task_result_tx.send(Err(McpError::ToolExecution {message: err.to_string(),}));
                        } else {
                            let _ = task_result_tx.send(Ok(()));
                        }

                    },
                    Tasks::CreateCharts {sequence, task_result_tx} => {
                        warn!("Creating charts");
                    }
                }
            }
            else => break
        }
    }
}
