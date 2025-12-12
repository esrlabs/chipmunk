// MCP API for handling communication between the Chipmunk application and the MCP client/server.
// Contains functinality to:
// - create and manage MCP API instances
// - run the MCP event loop to process incoming messages
// - methods to send messages to the MCP client and server

use crate::operations::{Operation, OperationKind};
use crate::state::SessionStateAPI;
use crate::tracker::OperationTrackerAPI;
use log::{error, warn};
use mcp::McpChannelEndpoints;
use mcp::client::messages::{McpChipmunkToClient, McpClientToChipmunk};
use mcp::server::messages::McpServerToChipmunk;
use mcp::types::McpError;
use processor::search::filter::SearchFilter;
use tokio::select;
use tokio::sync::mpsc;
use tokio::sync::mpsc::UnboundedSender;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct McpApi {
    pub chipmunk_to_client_tx: mpsc::Sender<McpChipmunkToClient>,
}

impl McpApi {
    pub fn new(
        mcp_channel_endpoints: McpChannelEndpoints,
    ) -> (
        Self,
        mpsc::Receiver<McpClientToChipmunk>,
        mpsc::Receiver<McpServerToChipmunk>,
    ) {
        (
            Self {
                chipmunk_to_client_tx: mcp_channel_endpoints.chipmunk_to_client_tx,
            },
            mcp_channel_endpoints.client_to_chipmunk_rx,
            mcp_channel_endpoints.server_to_chipmunk_rx,
        )
    }

    /// TODO:[MCP] Send a prompt to the Chipmunk MCP client. The prompt would typically come from the UI.
    /// The arguments probably need to be tweaked to also include the session
    pub async fn send_prompt(&self, prompt: String) -> Result<(), stypes::NativeError> {
        let message = McpChipmunkToClient::UserPrompt { prompt };

        self.chipmunk_to_client_tx
            .send(message.clone())
            .await
            .map_err(|_| {
                stypes::NativeError::channel(&format!("Failed to get send::{:?}", message))
            })
    }
}

pub async fn run(
    session_uuid: Uuid,
    mut server_to_chipmunk_rx: tokio::sync::mpsc::Receiver<McpServerToChipmunk>,
    mut client_to_chipmunk_rx: tokio::sync::mpsc::Receiver<McpClientToChipmunk>,
    tx_operations: UnboundedSender<Operation>,
    state_api: SessionStateAPI,
    tracker_api: OperationTrackerAPI,
    tx_callback_events: UnboundedSender<stypes::CallbackEvent>,
) {
    loop {
        select! {
            Some(server_request) = server_to_chipmunk_rx.recv() => {
                match server_request {
                    McpServerToChipmunk::ApplySearchFilter {filters, response_tx} => {

                        warn!(
                            "🟢 Chipmunk core received tool invocation ApplySearchFilter: {:?}", filters
                        );

                        let filters = filters.iter().map(|f| SearchFilter::new(f.value.clone(), f.is_regex, f.ignore_case, f.is_word)).collect();

                        let operation = Operation::new(
                            session_uuid,
                            OperationKind::Search { filters },
                        );

                        if let Err(err) = tx_operations.send(operation) {
                            let _ = response_tx.send(Err(McpError::ToolExecution {message: err.to_string(),}));
                        } else {
                            let _ = response_tx.send(Ok(()));
                        }

                    }
                }
            }
            Some(client_request) = client_to_chipmunk_rx.recv() => {
                match client_request {
                    McpClientToChipmunk::Response {..} => {
                        // TODO:[MCP] Implement functionality
                    }
                }
            }
            else => break
        }
    }
}
