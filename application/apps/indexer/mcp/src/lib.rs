pub mod agents;
pub mod client;
pub mod errors;
pub mod server;
pub mod types;

use tokio::sync::mpsc;

use crate::{
    client::McpClient,
    server::McpServer,
    types::{Prompt, Response},
};
use server::tasks::Tasks;

pub struct McpChannelEndpoints {
    pub prompt_tx: mpsc::Sender<Prompt>,
    pub response_rx: mpsc::Receiver<Response>,
    pub task_rx: mpsc::Receiver<Tasks>,
}

pub fn new() -> (McpServer, McpClient, McpChannelEndpoints) {
    // let llm_config = LlmConfig::Mock;
    // let mcp_config = McpConfig {
    //     url: String::from("http//:localhost:8181"),
    // };
    let (mcp_client, prompt_tx, response_rx) = McpClient::new();
    let (mcp_server, task_rx) = McpServer::new();

    let mcp_channel_endpoints = McpChannelEndpoints {
        prompt_tx,
        response_rx,
        task_rx,
    };

    (mcp_server, mcp_client, mcp_channel_endpoints)
}
