pub mod chat;
pub mod client;
pub mod config;
pub mod errors;
pub mod server;
pub mod tool_params;
pub mod types;

use tokio::sync::mpsc;

use crate::{chat::Prompt, types::Response};
use server::tasks::Tasks;

pub struct McpChannelEndpoints {
    pub prompt_tx: mpsc::Sender<Prompt>,
    pub response_rx: mpsc::Receiver<Response>,
    pub task_rx: mpsc::Receiver<Tasks>,
}
