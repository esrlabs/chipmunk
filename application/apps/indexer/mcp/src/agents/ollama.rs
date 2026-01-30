use reqwest::Client;
use reqwest::IntoUrl;
use reqwest::Url;

use crate::errors::McpError;

pub const BASE_URL: &str = "http://localhost:11434";
pub const MODEL: &str = "llama3.2";

#[derive(Debug, Clone)]
pub struct Ollama {
    pub(crate) url: Url,
    pub(crate) reqwest_client: Client,
    pub(crate) headers: reqwest::header::HeaderMap,
}

impl Default for Ollama {
    fn default() -> Self {
        Self {
            url: Url::parse("http://127.0.0.1:11434").unwrap(),
            reqwest_client: reqwest::Client::new(),
            headers: reqwest::header::HeaderMap::new(),
        }
    }
}

impl Ollama {
    fn new(host: Url, port: u16) -> Self {
        let mut url = host.clone();
        url.set_port(Some(port));

        Self {
            url: url,
            reqwest_client: Client::new(),
            headers: reqwest::header::HeaderMap::new(),
        }
    }
}
