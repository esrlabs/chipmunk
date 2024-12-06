/// This macro is used with the `feature=nodejs`. It allows adding an implementation of the `TryIntoJs` trait,
/// enabling seamless data conversion for use in a Node.js context when using the `node_bindgen` crate.
///
/// It's important to note that data can still be passed without implementing this trait; however, its use
/// significantly simplifies the code and improves readability by allowing explicit type annotations in function outputs.
///
/// Example code from a trait using `node_bindgen`:
/// ```ignore
/// // OutputType implements TryIntoJs
/// pub fn public_api_call() -> Result<OutputType, ErrType> { ... }
///
/// // OutputType doesn't implement TryIntoJs
/// pub fn public_api_call() -> Result<SafeArrayBuffer, SafeArrayBuffer> { ... }
/// ```
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
