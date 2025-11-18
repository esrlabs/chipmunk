use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use crate::messages::{McpClientRequest, McpServerRequest};

pub struct McpClient {
    cancellation_token: CancellationToken,
    rx: mpsc::Receiver<McpClientRequest>,
}

impl McpClient {
    pub fn new(
        rx: mpsc::Receiver<McpClientRequest>,
        cancellation_token: CancellationToken,
    ) -> Self {
        Self {
            cancellation_token,
            rx,
        }
    }

    pub async fn run(self) {
        // TODO: Implement  client
    }
}
