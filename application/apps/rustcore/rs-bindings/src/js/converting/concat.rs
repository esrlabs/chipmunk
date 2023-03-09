// use merging::concatenator::ConcatenatorInput;
// use node_bindgen::{
//     core::{
//         val::{JsEnv, JsObject},
//         JSValue, NjError,
//     },
//     sys::napi_value,
// };
// use serde::Serialize;

// #[derive(Serialize, Debug, Clone)]
// pub struct WrappedConcatenatorInput(ConcatenatorInput);

// // impl WrappedConcatenatorInput {
// //     pub fn as_concatenator_input(&self) -> ConcatenatorInput {
// //         self.0.clone()
// //     }
// // }

// impl JSValue<'_> for WrappedConcatenatorInput {
//     fn convert_to_rust(env: &JsEnv, n_value: napi_value) -> Result<Self, NjError> {
//         if let Ok(js_obj) = env.convert_to_rust::<JsObject>(n_value) {
//             let path: String = match js_obj.get_property("path") {
//                 Ok(Some(value)) => value.as_value()?,
//                 Ok(None) => {
//                     return Err(NjError::Other("[path] property is not found".to_owned()));
//                 }
//                 Err(e) => {
//                     return Err(e);
//                 }
//             };
//             let tag: String = match js_obj.get_property("tag") {
//                 Ok(Some(value)) => value.as_value()?,
//                 Ok(None) => {
//                     return Err(NjError::Other("[tag] property is not found".to_owned()));
//                 }
//                 Err(e) => {
//                     return Err(e);
//                 }
//             };
//             Ok(WrappedConcatenatorInput(ConcatenatorInput { path, tag }))
//         } else {
//             Err(NjError::Other("not valid format".to_owned()))
//         }
//     }
// }
