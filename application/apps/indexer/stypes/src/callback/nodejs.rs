use crate::*;

/// Implements the `TryIntoJs` trait for `OperationDone`.
///
/// This allows `OperationDone` to be seamlessly converted into a JavaScript-compatible
/// format when using the `node_bindgen` crate. It facilitates passing `OperationDone`
/// instances to Node.js contexts.
try_into_js!(OperationDone);

/// Implements the `TryIntoJs` trait for `CallbackEvent`.
///
/// This allows `CallbackEvent` to be seamlessly converted into a JavaScript-compatible
/// format when using the `node_bindgen` crate. It facilitates passing `CallbackEvent`
/// instances to Node.js contexts.
try_into_js!(CallbackEvent);
