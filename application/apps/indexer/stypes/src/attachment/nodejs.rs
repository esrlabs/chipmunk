use crate::*;

/// Implements the `TryIntoJs` trait for `AttachmentInfo`.
///
/// This allows `AttachmentInfo` to be converted into a JavaScript-compatible
/// format using the `node_bindgen` crate, enabling seamless integration with
/// Node.js environments.
try_into_js!(AttachmentInfo);

/// Implements the `TryIntoJs` trait for `AttachmentList`.
///
/// This allows `AttachmentList` to be converted into a JavaScript-compatible
/// format using the `node_bindgen` crate, enabling seamless integration with
/// Node.js environments.
try_into_js!(AttachmentList);
