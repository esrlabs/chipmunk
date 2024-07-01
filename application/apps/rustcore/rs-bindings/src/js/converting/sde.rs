use super::{error::E, FromBytes, JsIncomeI32Vec, ToBytes};
use prost::Message;
use protocol::*;
use sources::sde::{SdeRequest, SdeResponse};
use std::ops::Deref;
pub struct SdeResponseWrapped(pub SdeResponse);

impl Deref for SdeResponseWrapped {
    type Target = SdeResponse;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl ToBytes for SdeResponseWrapped {
    fn into_bytes(&mut self) -> Vec<u8> {
        let msg = sde::SdeResponse {
            bytes: self.bytes as u64,
        };
        prost::Message::encode_to_vec(&msg)
    }
}

impl FromBytes<SdeRequest> for JsIncomeI32Vec {
    fn from_bytes(&mut self) -> Result<SdeRequest, E> {
        let bytes = self.iter().map(|b| *b as u8).collect::<Vec<u8>>();
        let decoded = sde::SdeRequest::decode(&*bytes)?
            .request
            .ok_or(E::MissedField(String::from("value of SdeRequest")))?;
        Ok(match decoded {
            sde::sde_request::Request::WriteBytes(v) => SdeRequest::WriteBytes(v),
            sde::sde_request::Request::WriteText(v) => SdeRequest::WriteText(v),
        })
    }
}
