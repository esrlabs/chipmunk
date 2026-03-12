use rustc_hash::FxHashSet;
use stypes::GrabbedElement;

#[derive(Debug, Default)]
pub struct LogsState {
    pub logs_count: u64,
    /// The stream position of the log which the main logs table
    /// should scroll into.
    pub scroll_main_row: Option<u64>,
    /// Currently selected log.
    pub selected_log: Option<GrabbedElement>,
    /// Bookmarked rows keyed by original stream position.
    pub bookmarked_rows: FxHashSet<u64>,
}

impl LogsState {
    #[inline]
    pub fn is_bookmarked(&self, row: u64) -> bool {
        self.bookmarked_rows.contains(&row)
    }

    #[inline]
    pub fn insert_bookmark(&mut self, row: u64) {
        self.bookmarked_rows.insert(row);
    }

    #[inline]
    pub fn remove_bookmark(&mut self, row: u64) {
        self.bookmarked_rows.remove(&row);
    }
}
