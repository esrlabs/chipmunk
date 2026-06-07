//! Host registry storage for named preset snapshots.

mod capture;
mod catalog;
mod model;

pub use catalog::{PresetRegistry, PresetUpdateOutcome};
pub use model::{Preset, PresetFilterEntry, PresetSearchValueEntry};
