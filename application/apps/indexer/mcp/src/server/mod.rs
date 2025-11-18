use log::{error, warn};
use tokio::{
    sync::{mpsc, oneshot},
    time::{self, sleep},
};

pub mod messages;

use messages::McpServerToChipmunk;

use crate::server::messages::SearchFilter;

#[derive(Debug)]
pub struct McpServer {
    server_to_chipmunk_tx: mpsc::Sender<McpServerToChipmunk>,
}

impl McpServer {
    pub fn new() -> (Self, mpsc::Receiver<McpServerToChipmunk>) {
        let (server_to_chipmunk_tx, server_to_chipmunk_rx) = mpsc::channel(32);

        (
            Self {
                server_to_chipmunk_tx,
            },
            server_to_chipmunk_rx,
        )
    }

    pub fn start(self) {
        tokio::spawn(self.run());
    }

    async fn run(self) {
        // TODO: Send a mock message after 1 seconds
        warn!("🔅 MCP: sleep timer started");
        let duration = time::Duration::from_secs(10);
        sleep(duration).await;
        warn!("🔅 MCP: {:?} seconds passed", duration);

        let (response_tx, response_rx) = oneshot::channel();

        let filters = vec![SearchFilter {
            value: String::from("icmp_seq=13"),
            is_regex: false,
            ignore_case: true,
            is_word: true,
        }];

        let message = McpServerToChipmunk::ApplyFilter {
            filters,
            response_tx,
        };

        if let Err(err) = self.server_to_chipmunk_tx.send(message).await {
            error!(
                "[Chipmunk] <-X- [MCP server]: server failed to send request: ApplyFilter: {err}"
            );
            return;
        }

        match response_rx.await {
            Err(err) => {
                error!(
                    "[Chipmunk] -X-> [MCP server]: server failed to receive response: ApplyFilter: {err}"
                );
            }
            Ok(result) => {
                error!(
                    "[Chipmunk] --> [MCP server]: ✅ Received response: {:?}",
                    result
                )
            }
        }
    }
}
