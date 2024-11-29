#[macro_export]
macro_rules! try_into_js {
    ($($t:tt)+) => {
        impl TryIntoJs for $($t)+ {
            fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
                SafeArrayBuffer::new(self.encode().map_err(NjError::Other)?)
                    .try_to_js(js_env)
            }
        }
    };
}
