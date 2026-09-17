//! Storage shape for named presets.
//!
//! Presets are owned by `HostRegistry`, which also tracks whether they need
//! persisting. This module only carries the snapshot exchanged with the storage
//! service, so there is no UI-side storage domain for presets.

use crate::host::ui::registry::presets::Preset;

/// Preset data kept in storage.
#[derive(Debug, Clone, Default)]
pub struct PresetsData {
    /// Stored presets in catalog order.
    pub presets: Vec<Preset>,
}

impl PresetsData {
    /// Wraps stored presets in catalog order.
    pub fn new(presets: Vec<Preset>) -> Self {
        Self { presets }
    }
}
