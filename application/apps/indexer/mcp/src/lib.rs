// crates/mcp/src/lib.rs

use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

// use crate::client::McpClient;
// use crate::server::McpServer;
use crate::{
    client::McpClient,
    messages::{McpClientRequest, McpServerRequest},
    server::McpServer,
};

pub mod client;
pub mod messages;
pub mod server;

pub struct McpChannelDef {
    pub mcp_client_tx: mpsc::Sender<McpClientRequest>,
    pub server_rx: mpsc::Receiver<McpServerRequest>,
    pub mcp_client_cancel: tokio_util::sync::CancellationToken,
    pub mcp_server_cancel: tokio_util::sync::CancellationToken,
}

pub struct McpRuntime {
    pub server: McpServer,
    pub client: McpClient,
}

impl McpRuntime {
    pub fn new() -> (Self, McpChannelDef) {
        // TODO: Buffer size?
        let (client_tx, client_rx) = mpsc::channel(32);
        let (server_tx, server_rx) = mpsc::channel(32);

        let client_cancellation_token = CancellationToken::new();
        let server_cancellation_token = CancellationToken::new();

        let server = McpServer::new(server_tx, client_cancellation_token.clone());
        let client = McpClient::new(client_rx, server_cancellation_token.clone());

        (
            Self { server, client },
            McpChannelDef {
                mcp_client_tx: client_tx,
                server_rx,
                mcp_client_cancel: client_cancellation_token,
                mcp_server_cancel: server_cancellation_token,
            },
        )
    }

    pub async fn run_server(self) {
        self.server.run().await;
    }

    pub async fn run_client(self) {
        self.client.run().await;
    }
}
