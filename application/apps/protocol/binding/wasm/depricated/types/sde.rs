use crate::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
pub enum SdeRequest {
    WriteText(String),
    WriteBytes(Vec<u8>),
}

impl TryFrom<sde::SdeRequest> for SdeRequest {
    type Error = E;
    fn try_from(v: sde::SdeRequest) -> Result<Self, Self::Error> {
        use sde::sde_request::Request;
        let req = v.request.ok_or(E::MissedField(String::from("request")))?;
        Ok(match req {
            Request::WriteBytes(v) => SdeRequest::WriteBytes(v),
            Request::WriteText(v) => SdeRequest::WriteText(v),
        })
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SdeResponse {
    pub bytes: usize,
}

impl TryFrom<sde::SdeResponse> for SdeResponse {
    type Error = E;
    fn try_from(v: sde::SdeResponse) -> Result<Self, Self::Error> {
        Ok(SdeResponse {
            bytes: v.bytes as usize,
        })
    }
}
