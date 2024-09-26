use super::{error::E, JsIncomeBuffer};
use prost::Message;
use proto::*;
use sources::sde::{SdeRequest, SdeResponse};
use std::{convert::TryInto, ops::Deref};
pub struct SdeResponseWrapped(pub SdeResponse);
use node_bindgen::{
    core::{safebuffer::SafeArrayBuffer, val::JsEnv, NjError, TryIntoJs},
    sys::napi_value,
};

impl Deref for SdeResponseWrapped {
    type Target = SdeResponse;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl From<SdeResponseWrapped> for Vec<u8> {
    fn from(val: SdeResponseWrapped) -> Self {
        let msg = sde::SdeResponse {
            bytes: val.bytes as u64,
        };
        prost::Message::encode_to_vec(&msg)
    }
}

impl TryInto<SdeRequest> for JsIncomeBuffer {
    type Error = E;
    fn try_into(self) -> Result<SdeRequest, E> {
        let decoded = sde::SdeRequest::decode(&*self.0)?
            .request_oneof
            .ok_or(E::MissedField(String::from("value of SdeRequest")))?;
        Ok(match decoded {
            sde::sde_request::RequestOneof::WriteBytes(v) => SdeRequest::WriteBytes(v),
            sde::sde_request::RequestOneof::WriteText(v) => SdeRequest::WriteText(v),
        })
    }
}

impl TryIntoJs for SdeResponseWrapped {
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        SafeArrayBuffer::new(self.into()).try_to_js(js_env)
    }
}
