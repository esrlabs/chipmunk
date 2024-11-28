mod err;
mod gen;

pub(crate) use err::*;
pub(crate) use serde::Serialize;
pub(crate) use serde_wasm_bindgen::{from_value, Serializer};
pub(crate) use stypes::*;
pub(crate) use wasm_bindgen::prelude::*;

gen_encode_decode_fns!(ObserveOptions);
gen_encode_decode_fns!(CallbackEvent);
gen_encode_decode_fns!(NativeError);
gen_encode_decode_fns!(NativeErrorKind);
gen_encode_decode_fns!(Severity);
gen_encode_decode_fns!(OperationDone);
gen_encode_decode_fns!(LifecycleTransition);
gen_encode_decode_fns!(AttachmentInfo);
gen_encode_decode_fns!(Notification);
gen_encode_decode_fns!(Progress);
gen_encode_decode_fns!(Ticks);
gen_encode_decode_fns!(Ranges);
gen_encode_decode_fns!(SourceDefinition);
gen_encode_decode_fns!(Sources);
gen_encode_decode_fns!(SdeRequest);
gen_encode_decode_fns!(SdeResponse);
gen_encode_decode_fns!(GrabbedElement);
gen_encode_decode_fns!(GrabbedElementList);
gen_encode_decode_fns!(AroundIndexes);
