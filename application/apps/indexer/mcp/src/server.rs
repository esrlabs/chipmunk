use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use crate::messages::McpServerRequest;

pub struct McpServer {
    cancellation_token: CancellationToken,
    tx: mpsc::Sender<McpServerRequest>,
}

impl McpServer {
    pub fn new(tx: mpsc::Sender<McpServerRequest>, cancellation_token: CancellationToken) -> Self {
        Self {
            cancellation_token,
            tx,
        }
    }

    pub async fn run(self) {
        // TODO: Implement server
    }
}
