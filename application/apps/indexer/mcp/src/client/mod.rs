use tokio::sync::mpsc;

pub mod messages;

use messages::McpChipmunkToClient;
use messages::McpClientToChipmunk;

#[derive(Debug)]

pub struct McpClient {
    client_to_chipmunk_tx: mpsc::Sender<McpClientToChipmunk>,
    chipmunk_to_client_rx: mpsc::Receiver<McpChipmunkToClient>,
}

impl McpClient {
    pub fn new() -> (
        Self,
        mpsc::Sender<McpChipmunkToClient>,
        mpsc::Receiver<McpClientToChipmunk>,
    ) {
        let (client_to_chipmunk_tx, client_to_chipmunk_rx) = mpsc::channel(32);
        let (chipmunk_to_client_tx, chipmunk_to_client_rx) = mpsc::channel(32);

        (
            Self {
                client_to_chipmunk_tx,
                chipmunk_to_client_rx,
            },
            chipmunk_to_client_tx,
            client_to_chipmunk_rx,
        )
    }

    pub fn start(self) {
        // Start listening for messages
        tokio::spawn(self.run());

        // TODO: Start client, ...
    }

    // TODO: handle incoming messages
    async fn run(mut self) {
        while let Some(message) = self.chipmunk_to_client_rx.recv().await {
            match message {
                McpChipmunkToClient::Prompt { .. } => {}
            }
        }
    }
}
