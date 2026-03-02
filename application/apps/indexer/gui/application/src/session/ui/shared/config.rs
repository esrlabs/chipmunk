#[derive(Debug, Clone)]
pub struct AiConfig {
    pub model: String,
    pub url: String,
    pub api_token: Option<String>,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            model: String::from("llama3.2"),
            url: String::from("http://localhost:11434"),
            api_token: None,
        }
    }
}
