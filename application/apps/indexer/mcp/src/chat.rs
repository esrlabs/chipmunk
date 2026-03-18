use crate::config::AiConfig;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct Prompt {
    pub id: Uuid,
    pub message: String,
    pub config: AiConfig,
}
