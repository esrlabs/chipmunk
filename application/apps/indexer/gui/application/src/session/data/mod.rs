use std::ops::{Range, RangeInclusive};

use stypes::GrabbedElement;

#[derive(Debug, Default)]
pub struct SessionState {
    pub main_table: MainTable,
    pub logs_count: u64,
}

#[derive(Debug, Default)]
pub struct MainTable {
    /// The index of first line in logs window
    pub first_line: u64,
    pub logs_window: Vec<String>,
}

impl MainTable {
    pub fn append(&mut self, items: Vec<GrabbedElement>) {
        self.logs_window
            .extend(items.into_iter().map(|e| e.content));
    }

    pub fn get_log(&self, row_idx: u64) -> Option<&str> {
        self.logs_window.get(row_idx as usize).map(|s| s.as_str())
    }

    /// Checks if we need to fetch new data to be able to display the logs in the
    /// provided range.
    pub fn check_fetch(
        &self,
        rows_window: &Range<u64>,
        total_logs: u64,
    ) -> Option<RangeInclusive<u64>> {
        let last_line = self.last_line();

        let max = (rows_window.end + 200).min(total_logs.saturating_sub(1));
        if total_logs != 0 && max >= last_line {
            let rng = last_line..=max;
            Some(rng)
        } else {
            None
        }
    }

    #[inline]
    /// The index of the last line in logs window.
    pub fn last_line(&self) -> u64 {
        self.first_line + self.logs_window.len() as u64
    }
}
