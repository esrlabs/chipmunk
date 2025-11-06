use std::collections::HashMap;

use stypes::FilterMatch;

#[derive(Debug, Clone, Copy)]
pub struct FilterIndex(pub u8);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct LogMainIndex(pub u64);

#[derive(Debug, Default)]
pub struct SearchData {
    is_active: bool,
    //TODO AAZ: This should be equal to `results_map.len()`.
    //Make sure we need to keep both
    pub search_count: u64,
    matches_map: Option<HashMap<LogMainIndex, Vec<FilterIndex>>>,
}

impl SearchData {
    pub fn activate(&mut self) {
        self.is_active = true;
    }

    pub fn is_search_active(&self) -> bool {
        self.is_active
    }

    pub fn drop_search(&mut self) {
        let Self {
            is_active,
            search_count,
            matches_map,
        } = self;

        *is_active = false;
        *search_count = 0;
        *matches_map = None;
    }

    pub fn append_matches(&mut self, filter_matches: Vec<FilterMatch>) {
        if !self.is_active {
            return;
        }

        let matches_map = self.matches_map.get_or_insert_default();

        //TODO AAZ: Check when pending search should be updated.
        filter_matches.into_iter().for_each(|mat| {
            // Filter indexes get combined in chipmunk core.
            // We don't need to extend the indices vector and check for duplications here.
            matches_map.insert(
                LogMainIndex(mat.index),
                mat.filters.into_iter().map(FilterIndex).collect(),
            );
        });

        debug_assert_eq!(
            matches_map.len() as u64,
            self.search_count,
            "Search count and matches length can't go out of sync"
        );
    }

    pub fn current_matches_map(&self) -> Option<&HashMap<LogMainIndex, Vec<FilterIndex>>> {
        self.matches_map.as_ref()
    }
}
