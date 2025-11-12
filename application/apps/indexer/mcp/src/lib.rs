mod ai_config;
mod ai_manager;
mod parameters;
mod tools;
mod utils;

use anyhow::Result;

use ai_config::AiConfig;
use ai_manager::ChipmunkAI;

async fn start() -> Result<()> {
    let config = AiConfig::init();
    let service = ChipmunkAI::new(config);
    Ok(())
}
