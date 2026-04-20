//! Name-query matching and cached visibility helpers for preset cards.

use rustc_hash::FxHashSet;
use uuid::Uuid;

use crate::common::ui::substring_matcher::SubstringMatcher;

use super::{HostRegistry, Preset, PresetQueryState};

impl PresetQueryState {
    /// Refreshes the cached visible-id set when the query or preset catalog changes.
    pub(super) fn update_with_revision(
        &mut self,
        revision: u64,
        query_changed: bool,
        recompute_matches: impl FnOnce(&mut SubstringMatcher) -> Option<FxHashSet<Uuid>>,
    ) {
        if query_changed {
            self.matcher.build_query(self.query.trim());
        }

        if query_changed || self.cached_revision != revision {
            self.matching_ids = recompute_matches(&mut self.matcher);
            self.cached_revision = revision;
        }
    }

    /// Returns `true` when the preset should stay visible for the current query.
    pub(super) fn matches(&self, preset_id: &Uuid) -> bool {
        self.matching_ids
            .as_ref()
            .is_none_or(|matching_ids| matching_ids.contains(preset_id))
    }
}

/// Matches presets by name only; item contents do not participate in filtering.
fn matches_preset_query(preset: &Preset, matcher: &mut SubstringMatcher) -> bool {
    matcher.matches(preset.name.as_str())
}

/// Collects the visible preset ids for the current query.
///
/// Returns `None` for an empty normalized query so the caller can treat that
/// as "show everything" without storing a full-id snapshot.
pub(super) fn collect_matching_preset_ids(
    matcher: &mut SubstringMatcher,
    registry: &HostRegistry,
) -> Option<FxHashSet<Uuid>> {
    if !matcher.has_query() {
        return None;
    }

    Some(
        registry
            .presets
            .presets()
            .iter()
            .filter_map(|preset| matches_preset_query(preset, matcher).then_some(preset.id))
            .collect(),
    )
}

#[cfg(test)]
mod tests {
    use processor::search::filter::SearchFilter;
    use uuid::Uuid;

    use super::*;

    fn preset(name: &str) -> Preset {
        Preset {
            id: Uuid::new_v4(),
            name: name.to_owned(),
            filters: vec![SearchFilter::plain("filter")],
            search_values: vec![],
        }
    }

    fn build_matcher(query: &str) -> SubstringMatcher {
        let mut matcher = SubstringMatcher::default();
        matcher.build_query(query.trim());
        matcher
    }

    #[test]
    fn empty_query_matches_all() {
        let preset = preset("Errors");

        assert!(matches_preset_query(&preset, &mut build_matcher("")));
        assert!(matches_preset_query(&preset, &mut build_matcher("   ")));
    }

    #[test]
    fn query_matches_name() {
        let preset = preset("Error Group");

        assert!(matches_preset_query(&preset, &mut build_matcher("error")));
    }

    #[test]
    fn empty_query_cache_is_none() {
        let mut registry = HostRegistry::default();
        registry.presets.add_preset("Errors", vec![], vec![]);

        assert!(collect_matching_preset_ids(&mut build_matcher("   "), &registry).is_none());
    }

    #[test]
    fn query_cache_collects_matching_ids() {
        let mut registry = HostRegistry::default();
        let matching_id = registry.presets.add_preset("Status Errors", vec![], vec![]);
        let non_matching_id = registry.presets.add_preset("Warnings", vec![], vec![]);
        let matching_ids =
            collect_matching_preset_ids(&mut build_matcher(" status "), &registry).unwrap();

        assert!(matching_ids.contains(&matching_id));
        assert!(!matching_ids.contains(&non_matching_id));
    }

    #[test]
    fn query_ignores_items() {
        let preset = Preset {
            filters: vec![SearchFilter::plain("error")],
            ..preset("Alpha")
        };

        assert!(!matches_preset_query(&preset, &mut build_matcher("error")));
    }

    #[test]
    fn query_state_refreshes_on_revision_change() {
        let mut state = PresetQueryState {
            query: "warn".to_owned(),
            ..PresetQueryState::default()
        };
        let mut registry = HostRegistry::default();
        let first_id = registry.presets.add_preset("warn", vec![], vec![]);

        state.update_with_revision(registry.presets.definitions_revision(), true, |matcher| {
            collect_matching_preset_ids(matcher, &registry)
        });
        assert!(state.matches(&first_id));

        let second_id = registry.presets.add_preset("warn later", vec![], vec![]);

        assert!(!state.matches(&second_id));

        state.update_with_revision(registry.presets.definitions_revision(), false, |matcher| {
            collect_matching_preset_ids(matcher, &registry)
        });
        assert!(state.matches(&second_id));
    }
}
