use anyhow::Result;
use rmcp::{
    handler::server::{ServerHandler, router::tool::ToolRouter},
    model::{ServerCapabilities, ServerInfo},
    tool_handler,
};

use super::ai_config::AiConfig;

#[derive(Debug)]
pub struct ChipmunkAI {
    pub config: AiConfig,
    pub tool_router: ToolRouter<Self>,
}

#[tool_handler]
impl ServerHandler for ChipmunkAI {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            instructions: Some(
                "Sample tool for generating the Search filters for Chipmunk".to_string(),
            ),
            capabilities: ServerCapabilities::builder()
                .enable_tools()
                .enable_prompts()
                .enable_resources()
                .build(),
            ..Default::default()
        }
    }
}
