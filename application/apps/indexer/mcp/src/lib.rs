pub mod client;
pub mod errors;
pub mod server;
pub mod types;

use tokio::sync::mpsc;

use crate::types::{Prompt, Response};
use server::tasks::Tasks;

pub struct McpChannelEndpoints {
    pub prompt_tx: mpsc::Sender<Prompt>,
    pub response_rx: mpsc::Receiver<Response>,
    pub task_rx: mpsc::Receiver<Tasks>,
}
