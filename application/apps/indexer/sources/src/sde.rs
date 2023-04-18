use serde::{Deserialize, Serialize};
use tokio::sync::oneshot;

// SourceDataExchange - Sde
// Channel allows to send message into ByteSource implementaion in run-time
pub type SdeMsg = (SdeRequest, oneshot::Sender<Result<SdeResponse, String>>);

#[derive(Deserialize, Serialize)]
pub enum SdeRequest {
    WriteText(String),
    WriteBytes(Vec<u8>),
}

#[derive(Deserialize, Serialize)]
pub struct SdeResponse {
    pub bytes: usize,
}
