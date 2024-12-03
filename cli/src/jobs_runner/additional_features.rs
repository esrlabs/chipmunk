//! Module for type definitions and implementations of additional features that can be applied
//! to specific targets in the build process.

use serde::{Deserialize, Serialize};

use crate::target::Target;

/// Represents defined additional features that can activated on parts on build process.
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, clap::ValueEnum, Serialize, Deserialize,
)]
pub enum AdditionalFeatures {
    /// Activate `custom-alloc` feature in rs-binding to use custom memory allocator
    /// instead of the default one.
    #[serde(rename = "custom-alloc")]
    #[value(name = "custom-alloc")]
    CustomAllocator = 1,
}

impl AdditionalFeatures {
    pub fn as_usize(self) -> usize {
        self as usize
    }

    /// Returns the target to which this feature applies.
    pub fn apply_to_target(self) -> Target {
        match self {
            AdditionalFeatures::CustomAllocator => Target::Binding,
        }
    }
}
