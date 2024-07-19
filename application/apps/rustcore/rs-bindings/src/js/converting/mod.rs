// pub mod concat;
pub mod attachment;
pub mod error;
pub mod errors;
pub mod event;
pub mod filter;
pub mod grabbing;
pub mod merge;
pub mod observe;
pub mod progress;
pub mod ranges;
pub mod sde;
pub mod source;

use node_bindgen::{
    core::{val::JsEnv, NjError},
    sys::napi_value,
};
use std::ops::Deref;

/// Converts a vector of bytes (`u8`) to a JavaScript array of integers (`i32`).
///
/// This function takes a vector of bytes and converts each byte to an `i32`.
/// It then creates a JavaScript array with the same length and populates it
/// with the converted integers. This array is then returned as a `napi_value`.
///
/// # Arguments
///
/// * `bytes` - A vector of bytes (`u8`) to be converted.
/// * `js_env` - A reference to the JavaScript environment (`JsEnv`), used to create and manipulate JavaScript values.
///
/// # Returns
///
/// A `Result` containing the JavaScript array (`napi_value`) on success, or a `NjError` on failure.
///
/// # Errors
///
/// This function will return an `NjError` if there is an issue creating the JavaScript array,
/// converting the integers, or setting the array elements.
pub(crate) fn bytes_to_js_value(bytes: Vec<u8>, js_env: &JsEnv) -> Result<napi_value, NjError> {
    let bytes = u8_to_i32(bytes);
    let arr = js_env.create_array_with_len(bytes.len())?;
    for (i, b) in bytes.into_iter().enumerate() {
        let b = js_env.create_int32(b)?;
        js_env.set_element(arr, b, i)?;
    }
    Ok(arr)
}

pub struct JsIncomeI32Vec(pub Vec<i32>);

impl Deref for JsIncomeI32Vec {
    type Target = Vec<i32>;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// This function takes a vector of bytes (`u8`) and converts each byte to an `i32` value,
/// returning a new vector with the `i32` type. No data copying is performed; each `u8` value
/// is cast directly to an `i32`.
///
/// # Arguments
///
/// * `src` - A vector of bytes (`u8`) to be converted.
///
/// # Returns
///
/// A vector of integers (`i32`) containing the same values as the input vector.
///
/// # Reason
///
/// `node_bindgen` has support only `Vec<i32>` out of box. To have quick way to convert
/// `Vec<u8>` to `Vec<i32>` this function can be used.
pub fn u8_to_i32(src: Vec<u8>) -> Vec<i32> {
    src.into_iter().map(|b| b as i32).collect()
}
