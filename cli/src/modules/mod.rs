use async_trait::async_trait;

use crate::target::Target;

pub mod app;
pub mod binding;
pub mod cli;
pub mod client;
pub mod core;
pub mod shared;
pub mod wasm;
pub mod wrapper;

#[async_trait]
pub trait Manager {
    fn owner(&self) -> Target;
}
