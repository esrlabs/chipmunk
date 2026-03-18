use serde::{Deserialize, Serialize};

#[derive(Clone, Default, Debug, Serialize, Deserialize, PartialEq)]
pub enum LlmProvider {
    #[default]
    Ollama,
    OpenAI,
    Antropic,
    Gemini,
    Custom,
}

impl From<&str> for LlmProvider {
    fn from(val: &str) -> Self {
        match val.to_lowercase().as_str() {
            "ollama" => Self::Ollama,
            "openai" => Self::OpenAI,
            "anthropic" => Self::Antropic,
            "gemini" => Self::Gemini,
            _ => Self::Custom,
        }
    }
}

impl From<String> for LlmProvider {
    fn from(val: String) -> Self {
        Self::from(val.as_str())
    }
}

#[derive(Debug, Clone)]
pub struct AiConfig {
    pub provider: LlmProvider,
    pub model: String,
    pub url: String,
    pub api_key: Option<String>,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            provider: LlmProvider::default(),
            model: String::from("qwen3:8b"),
            url: String::from("http://localhost:11434"),
            api_key: None,
        }
    }
}
