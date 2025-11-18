use crate::state::SessionStateAPI;
use crate::tracker::OperationTrackerAPI;
use mcp::McpChannelDef;
use mcp::messages::{McpClientRequest, McpServerRequest};
use tokio::select;
use tokio::sync::mpsc;
use tokio::sync::mpsc::UnboundedSender;

#[derive(Debug)]
pub struct McpApi {
    client_tx: mpsc::Sender<McpClientRequest>,
    client_cancellation_token: tokio_util::sync::CancellationToken,
    server_rx: mpsc::Receiver<McpServerRequest>,
    serrver_cancellation_token: tokio_util::sync::CancellationToken,
}

impl McpApi {
    pub fn new(channel_def: McpChannelDef) -> Self {
        Self {
            client_tx: channel_def.mcp_client_tx,
            client_cancellation_token: channel_def.mcp_client_cancel,
            server_rx: channel_def.server_rx,
            serrver_cancellation_token: channel_def.mcp_server_cancel,
        }
    }

    /// TODO: Does this need to be implemented in session.rs?
    pub async fn send_prompt(&self, prompt: McpClientRequest) -> Result<(), String> {
        Ok(())
    }
}

pub async fn run(
    mut server_rx: tokio::sync::mpsc::Receiver<McpServerRequest>,
    state_api: SessionStateAPI,
    tracker_api: OperationTrackerAPI,
    tx_callback_events: UnboundedSender<stypes::CallbackEvent>,
) {
    select! {
        Some(mcp_server_request) = server_rx.recv() => {
            match mcp_server_request {
                McpServerRequest::ApplyFilter {..} => {
                    // TODO: Implement ApplyFilter handling
                    state_api.set_matches(None, None).await;


                }
            }

        }
    }
}
