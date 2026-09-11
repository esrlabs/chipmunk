//! UI-side storage state for named presets.
//!
//! Presets are owned by `HostRegistry`, so this domain does not hold canonical
//! preset state. It stages the snapshot that must be persisted and keeps it for
//! retries until an aggregate save succeeds.

use crate::host::ui::registry::presets::{Preset, PresetRegistry};

/// UI-side storage state for presets.
#[derive(Debug, Default)]
pub struct PresetsStorage {
    staged: Option<PresetsData>,
    dirty: bool,
}

/// Preset data kept in storage.
#[derive(Debug, Clone, Default)]
pub struct PresetsData {
    /// Stored presets in display order.
    pub presets: Vec<Preset>,
}

impl PresetsStorage {
    /// Takes the presets to persist from the registry when it has unsaved changes.
    pub fn stage(&mut self, presets: &mut PresetRegistry) {
        let Some(changed) = presets.take_save_data() else {
            return;
        };

        self.staged = Some(changed);
        self.dirty = true;
    }

    /// Returns the staged presets only when they still need to be saved.
    pub fn get_save_data(&mut self) -> Option<PresetsData> {
        if !self.dirty {
            return None;
        }

        self.dirty = false;
        self.staged.clone()
    }

    /// Marks the staged presets for retry after a failed aggregate save.
    pub fn mark_dirty(&mut self) {
        self.dirty = self.staged.is_some();
    }
}

impl PresetsData {
    /// Wraps stored presets in display order.
    pub fn new(presets: Vec<Preset>) -> Self {
        Self { presets }
    }
}

#[cfg(test)]
mod tests {
    use processor::search::filter::SearchFilter;

    use crate::host::ui::registry::presets::PresetFilterEntry;

    use super::*;

    fn registry_with_preset() -> PresetRegistry {
        let mut presets = PresetRegistry::default();
        presets.add_preset(
            "Errors",
            vec![PresetFilterEntry::with_default_color(
                SearchFilter::plain("error").ignore_case(true),
                0,
            )],
            Vec::new(),
        );

        presets
    }

    #[test]
    fn stage_requires_registry_changes() {
        let mut storage = PresetsStorage::default();
        let mut registry = registry_with_preset();

        storage.stage(&mut registry);

        assert!(
            storage
                .get_save_data()
                .is_some_and(|data| data.presets.len() == 1)
        );
        assert!(storage.get_save_data().is_none());

        storage.stage(&mut registry);

        assert!(storage.get_save_data().is_none());
    }

    #[test]
    fn mark_dirty_retries_staged_presets() {
        let mut storage = PresetsStorage::default();
        let mut registry = registry_with_preset();
        storage.stage(&mut registry);
        storage.get_save_data().expect("staged presets should save");

        storage.mark_dirty();

        assert!(storage.get_save_data().is_some());
    }

    #[test]
    fn mark_dirty_without_staged_presets_saves_nothing() {
        let mut storage = PresetsStorage::default();

        storage.mark_dirty();

        assert!(storage.get_save_data().is_none());
    }
}
