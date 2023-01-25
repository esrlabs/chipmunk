use node_bindgen::{
    core::{val::JsEnv, NjError, TryIntoJs},
    sys::napi_value,
};
use std::collections::HashMap;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub struct Cancellation {
    map: HashMap<Uuid, CancellationToken>,
}

impl Cancellation {
    pub fn new() -> Self {
        Cancellation {
            map: HashMap::new(),
        }
    }

    pub fn create_token(&mut self) -> (Uuid, CancellationToken) {
        let uuid = Uuid::new_v4();
        let token = CancellationToken::new();
        self.map.insert(uuid, token.clone());
        (uuid, token)
    }

    pub fn remove_token(&mut self, uuid: &Uuid) {
        self.map.remove(uuid);
    }

    pub fn cancel(&mut self, uuid: &Uuid) {
        if let Some(token) = self.map.remove(uuid) {
            token.cancel();
        }
    }
}

impl TryIntoJs for Cancellation {
    fn try_to_js(self, _js_env: &JsEnv) -> Result<napi_value, NjError> {
        Err(NjError::Other("not implemented".to_owned()))
    }
}
