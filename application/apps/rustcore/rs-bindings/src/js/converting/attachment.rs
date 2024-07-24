use node_bindgen::{
    core::{val::JsEnv, NjError, TryIntoJs},
    sys::napi_value,
};
use proto::*;
use session::state::AttachmentInfo;
use std::{mem, ops::Deref};

pub struct AttachmentInfoList(pub Vec<AttachmentInfo>);

impl Deref for AttachmentInfoList {
    type Target = Vec<AttachmentInfo>;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl From<AttachmentInfoList> for Vec<u8> {
    fn from(mut val: AttachmentInfoList) -> Self {
        let els = mem::take(&mut val.0);
        let elements: Vec<attachment::AttachmentInfo> = els
            .into_iter()
            .map(|mut el| attachment::AttachmentInfo {
                uuid: el.uuid.to_string(),
                filepath: el.filepath.to_string_lossy().to_string(),
                name: mem::take(&mut el.name),
                ext: el.ext.take().unwrap_or_default(),
                size: el.size as u64,
                mime: el.mime.take().unwrap_or_default(),
                messages: el.messages.into_iter().map(|v| v as u64).collect(),
            })
            .collect();
        let list = attachment::AttachmentInfoList { elements };
        prost::Message::encode_to_vec(&list)
    }
}

impl TryIntoJs for AttachmentInfoList {
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        let bytes: Vec<u8> = self.into();
        bytes.try_to_js(js_env)
    }
}
