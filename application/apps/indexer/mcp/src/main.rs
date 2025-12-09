use anyhow::Result;

use mcp_server::start;
use rmcp::{ServiceExt, transport::io::stdio};

#[tokio::main]
async fn main() -> Result<()> {
    let (ai_manager, _server_comm, _client_comm) = start()?;

    let service = ai_manager
        .serve(stdio())
        .await
        .inspect_err(|err| eprintln!("Error while starting the AI Server; {err:?}"))?;

    service.waiting().await?;
    Ok(())
}

