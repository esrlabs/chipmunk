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

use std::ops::Deref;

pub struct JsIncomeBuffer(pub Vec<u8>);

impl Deref for JsIncomeBuffer {
    type Target = Vec<u8>;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
