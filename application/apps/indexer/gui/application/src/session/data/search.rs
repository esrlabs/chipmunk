use std::{
    collections::HashMap,
    sync::atomic::{AtomicBool, Ordering},
};

use stypes::FilterMatch;

#[derive(Debug, Clone, Copy)]
pub struct FilterIndex(pub u8);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct LogMainIndex(pub u64);

#[derive(Debug, Default)]
pub struct SearchData {
    /// Search state should be able to set directly from the UI immediately to avoid
    /// the UI requesting for logs after the session is dropped.
    is_active: AtomicBool,
    //TODO AAZ: This should be equal to `results_map.len()`.
    //Make sure we need to keep both
    pub search_count: u64,
    matches_map: Option<HashMap<LogMainIndex, Vec<FilterIndex>>>,
}

impl SearchData {
    #[inline]
    pub fn activate(&mut self) {
        // This function has mutable reference to self to prevent the UI from
        // using it, because such change should come from the service only.
        self.is_active.store(true, Ordering::Relaxed);
    }

    #[inline]
    pub fn is_search_active(&self) -> bool {
        self.is_active.load(Ordering::Relaxed)
    }

    #[inline]
    pub fn deactivate(&self) {
        self.is_active.store(false, Ordering::Release);
    }

    pub fn drop_search(&mut self) {
        self.deactivate();

        let Self {
            is_active: _,
            search_count,
            matches_map,
        } = self;

        *search_count = 0;
        *matches_map = None;
    }

    pub fn append_matches(&mut self, filter_matches: Vec<FilterMatch>) {
        if !self.is_search_active() {
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
