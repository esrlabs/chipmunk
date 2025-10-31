use rmcp::handler::server::router::tool::ToolRouter;

use super::ai_config::AiConfig;

#[derive(Debug)]
pub struct ChipmunkAI {
    pub config: AiConfig,
    pub tool_router: ToolRouter<Self>,
}
