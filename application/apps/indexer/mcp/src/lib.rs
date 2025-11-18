// Chipmunk AI integration using Model Context Protocol

use tokio::sync::mpsc;

use crate::{client::McpClient, server::McpServer};
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

pub fn new() -> (McpServer, McpClient, McpChannelEndpoints) {
    let (mcp_client, chipmunk_to_client_tx, client_to_chipmunk_rx) = McpClient::new();
    let (mcp_server, server_to_chipmunk_rx) = McpServer::new();

    let mcp_channel_endpoints = McpChannelEndpoints {
        chipmunk_to_client_tx,
        client_to_chipmunk_rx,
        server_to_chipmunk_rx,
    };

    (mcp_server, mcp_client, mcp_channel_endpoints)
}
