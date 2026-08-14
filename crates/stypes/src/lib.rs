//! Shared Rust data types used by the indexer core and native UI.

mod attachment;
mod callback;
mod error;
mod miscellaneous;
mod observe;
mod operations;
mod plugins;
mod shell;

pub use attachment::*;
pub use callback::*;
pub use error::*;
pub use miscellaneous::*;
pub use observe::*;
pub use operations::*;
pub use plugins::*;
pub use shell::*;

pub(crate) use serde::{Deserialize, Serialize};
pub(crate) use std::{collections::HashMap, path::PathBuf};
pub(crate) use uuid::Uuid;
