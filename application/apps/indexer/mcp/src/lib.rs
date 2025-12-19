// Chipmunk AI integration using Model Context Protocol

use tokio::sync::mpsc;

use crate::{
    client::{MCPClient, McpConfig, llm::LlmConfig},
    server::McpServer,
};
use client::messages::{McpChipmunkToClient, McpClientToChipmunk};
use server::messages::McpServerToChipmunk;

pub mod client;
pub mod server;
pub mod types;

pub struct McpChannelEndpoints {
    pub chipmunk_to_client_tx: mpsc::Sender<McpChipmunkToClient>,
    pub client_to_chipmunk_rx: mpsc::Receiver<McpClientToChipmunk>,
    pub server_to_chipmunk_rx: mpsc::Receiver<McpServerToChipmunk>,
}

pub fn new() -> (McpServer, MCPClient, McpChannelEndpoints) {
    let llm_config = LlmConfig::Mock;
    let mcp_config = McpConfig {
        url: String::from("http//:localhost:8181"),
    };
    let (mcp_client, chipmunk_to_client_tx, client_to_chipmunk_rx) =
        MCPClient::new(mcp_config, llm_config);
    let (mcp_server, server_to_chipmunk_rx) = McpServer::new();

    let mcp_channel_endpoints = McpChannelEndpoints {
        chipmunk_to_client_tx,
        client_to_chipmunk_rx,
        server_to_chipmunk_rx,
    };

    (mcp_server, mcp_client, mcp_channel_endpoints)
}
