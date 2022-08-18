use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize)]
pub enum SdeRequest {
    WriteText(String),
    WriteBytes(Vec<u8>),
}

#[derive(Deserialize, Serialize)]
pub struct WriteResponse {
    pub bytes: usize,
}

#[derive(Deserialize, Serialize)]
pub enum SdeResponse {
    WriteText(WriteResponse),
    WriteBytes(WriteResponse),
    Error(String),
}
