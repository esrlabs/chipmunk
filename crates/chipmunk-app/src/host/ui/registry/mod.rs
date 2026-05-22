pub mod filters;
pub mod presets;

use filters::FilterRegistry;
use presets::PresetRegistry;
use uuid::Uuid;

/// Global registry for all shared state across sessions.
#[derive(Debug, Default)]
pub struct HostRegistry {
    pub filters: FilterRegistry,
    pub presets: PresetRegistry,
}

impl HostRegistry {
    /// Cleanup all usage records for a closing session.
    pub fn cleanup_session(&mut self, session_id: &Uuid) {
        self.filters.cleanup_session(session_id);
    }
}

#[cfg(test)]
mod tests {
    use processor::search::filter::SearchFilter;

    use super::*;

    #[test]
    fn defaults_empty_presets() {
        let registry = HostRegistry::default();

        assert!(registry.presets.presets().is_empty());
    }

    #[test]
    fn cleanup_keeps_presets() {
        let mut registry = HostRegistry::default();
        let preset_id =
            registry
                .presets
                .add_preset("Errors", vec![SearchFilter::plain("error")], vec![]);

        registry.cleanup_session(&Uuid::new_v4());

        assert_eq!(registry.presets.presets().len(), 1);
        assert_eq!(registry.presets.get(&preset_id).unwrap().name, "Errors");
    }
}
