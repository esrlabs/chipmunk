use std::collections::BTreeMap;

use stypes::FilterMatch;

use crate::session::data::indexed_mapped::IndexedMapped;
#[derive(Debug, Clone, Copy)]

pub struct FilterIndex(pub u8);

#[derive(Debug, Default)]
pub struct SearchData {
    is_active: bool,
    //TODO AAZ: This should be equal to `results_map.len()`.
    //Make sure we need to keep both
    pub search_count: u64,
    pub matches_map: Option<BTreeMap<u64, Vec<FilterIndex>>>,
    pub search_table: IndexedMapped,
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
            search_table,
        } = self;

        *is_active = false;
        *search_count = 0;
        *matches_map = None;
        search_table.clear();
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
                mat.index,
                mat.filters.into_iter().map(FilterIndex).collect(),
            );
        });

        debug_assert_eq!(
            matches_map.len() as u64,
            self.search_count,
            "Search count and matches length can't go out of sync"
        );
    }
}
