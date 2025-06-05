/// The `stypes` crate provides data types used at the `rustcore` level and passed to clients.
/// While the `stypes` crate does not impose restrictions on the client type, some features are
/// specifically defined to support certain types of clients. This does not mean that `stypes` cannot
/// be used with other client types.
///
/// ## Features
/// - `nodejs`: Includes the implementation of the `TryIntoJs` trait, required for transferring data
///   into the Node.js context when using the `node_bindgen` crate.
/// - `rustcore`: Includes additional utilities and extensions for using `stypes` within the
///   `indexer` crate group.
///
/// ## Proptest Integration
/// The crate includes tests based on `proptest`. These tests not only validate the crate itself
/// but also generate binary files containing variations of each message in a predefined directory.
/// These files can later be used to test encoding/decoding on the client side.
///
/// The `test_msg` macro is used to generate tests for specific data types. For example:
///
/// ```ignore
/// test_msg!(ObserveOptions, 100);
/// ```
///
/// The above code generates 100 variations of `ObserveOptions`. During tests, the generated data
/// is saved to files in the specified path. To set the output path, use the `CHIPMUNK_PROTOCOL_TEST_OUTPUT`
/// environment variable:
///
/// ```ignore
/// export CHIPMUNK_PROTOCOL_TEST_OUTPUT="/tmp/test_data"
/// cargo test --release -- --nocapture
/// ```
///
/// If `CHIPMUNK_PROTOCOL_TEST_OUTPUT` is not set, the default path `$TMP/stypes_test` will be used.
/// It is recommended to run tests with the `--release` flag to speed up random variation generation,
/// as the process is significantly slower in debug mode.
///
/// Each data type will have its own directory, and each variation will be stored in files with
/// sequential names (`1.bin`, `2.bin`, etc.).
///
/// ## WARNING
/// When tests are run, the folder specified in `CHIPMUNK_PROTOCOL_TEST_OUTPUT` is completely deleted.
/// Be extremely cautious when setting the value of this environment variable.
///
/// ## Limitations
/// The current version of `stypes` uses `bincode` for encoding and decoding types. `bincode` requires
/// both serialization and deserialization implementations. However, using custom `serde` attributes
/// may lead to protocol instability, especially during decoding. For instance, the attribute
/// `#[serde(tag = "type", content = "value")]` makes decoding messages with these settings impossible.
/// Unfortunately, `bincode` does not raise compile-time or serialization-time errors, but only fails
/// during decoding. Therefore, it is strongly recommended to test encoding/decoding when using additional
/// attributes on types.
///
/// ## Implementation of `encode` and `decode` Methods
/// The `encode` and `decode` methods are added to each declared data type using the `encode_decode`
/// macro from the `extend` crate. This macro implements encoding and decoding for the data type
/// using `bincode`.
///
/// For example, the following code:
///
/// ```ignore
/// #[derive(Debug, Serialize, Deserialize, Clone)]
/// #[extend::encode_decode]
/// pub struct Notification {
///     pub severity: Severity,
///     pub content: String,
///     pub line: Option<usize>,
/// }
/// ```
///
/// Is transformed into:
///
/// ```ignore
/// #[derive(Debug, Serialize, Deserialize, Clone)]
/// pub struct Notification {
///     pub severity: Severity,
///     pub content: String,
///     pub line: Option<usize>,
/// }
///
/// impl Notification {
///     pub fn encode(&self) -> Result<Vec<u8>, String> {
///         bincode::serialize(self).map_err(|e| e.to_string())
///     }
///     
///     pub fn decode(buf: &[u8]) -> Result<Self, String> {
///         bincode::deserialize(buf).map_err(|e| e.to_string())
///     }
/// }
/// ```
#[cfg(test)]
mod tests;

#[cfg(feature = "nodejs")]
mod nodejs;

mod attachment;
mod callback;
mod command;
mod error;
mod lf_transition;
mod miscellaneous;
mod observe;
mod operations;
mod plugins;
mod progress;

pub use attachment::*;
pub use callback::*;
pub use command::*;
pub use error::*;
pub use lf_transition::*;
pub use miscellaneous::*;
pub use observe::*;
pub use operations::*;
pub use plugins::*;
pub use progress::*;

pub(crate) use serde::{Deserialize, Serialize, de::DeserializeOwned};
pub(crate) use std::{collections::HashMap, path::PathBuf};
#[cfg(all(test, feature = "test_and_gen"))]
pub(crate) use ts_rs::TS;
pub(crate) use uuid::Uuid;

#[cfg(feature = "nodejs")]
pub(crate) use node_bindgen::{
    core::{NjError, TryIntoJs, safebuffer::SafeArrayBuffer, val::JsEnv},
    sys::napi_value,
};

#[cfg(test)]
pub(crate) use proptest::prelude::*;
#[cfg(all(test, feature = "test_and_gen"))]
pub(crate) use tests::*;

#[cfg(feature = "rustcore")]
pub fn serialize<T: Serialize>(v: &T) -> Result<Vec<u8>, bincode::Error> {
    bincode::serialize(v)
}
