//! Implementation for sliding window for display logs in table.

//TODO AAZ: Compare this approach to simple one with maps before finalize solution.
#![allow(unused)]

use std::ops::{Range, RangeInclusive};

use stypes::GrabbedElement;

const LOGS_WINDOW_OFFSET: usize = 50;
const MAX_WINDOW_CAPACITY: usize = 200;

/// Implementation for displaying a window of the logs to be used
/// inside the logs viewer.
/// - It keeps track on the existing items trying to avoid calling for logs
///   which exist in the current window.
/// - It will keep offsets in the window to have logs directly available on
///   slow scrolling.
/// - It assumes that the provided logs will be in sequence and sorted
/// - NOTE: This needs testing before having it in production
#[derive(Debug, Default)]
pub struct LogsSlidingWindow {
    /// The index of first line in logs window
    first_line: usize,
    logs_window: Vec<String>,
}

impl LogsSlidingWindow {
    pub fn append(&mut self, items: Vec<GrabbedElement>) {
        if items.is_empty() {
            return;
        }
        //TODO AAZ: Remove after testing
        debug_assert!(items.is_sorted_by_key(|i| i.pos));

        let Some(min) = items.first().map(|i| i.pos) else {
            return;
        };

        let Some(max) = items.last().map(|i| i.pos) else {
            return;
        };

        // Handle the case where the new range isn't continues with
        // the older one (Happens with fast scrolling)
        if max < self.first_line || min > self.last_line() {
            self.logs_window = items.into_iter().map(|i| i.content).collect();
            self.first_line = min;
            return;
        }

        // Check if we are inserting at the start
        if min <= self.first_line {
            let mut incoming: Vec<_> = items.into_iter().map(|i| i.content).collect();
            incoming.extend(
                self.logs_window
                    // Drain because we can't take ownership of the victor and we need the items.
                    .drain(..)
                    // We need to count for overlapping between incoming messages and existing ones
                    // -------------------|    max is here
                    //              |----------------  first line is here.
                    .skip((max + 1).saturating_sub(self.first_line))
                    // Keep the window at maximum capacity.
                    .take(MAX_WINDOW_CAPACITY.saturating_sub(incoming.len())),
            );

            self.first_line = min;
            self.logs_window = incoming;
        } else {
            // -------------------|    last_line() is here
            //              |----------------   min start from there.
            let skip_count = (self.last_line() + 1).saturating_sub(min);

            // Drain amount before extending the window.
            let incoming_len = items.len();
            let current_len = self.logs_window.len();
            let drain_amount =
                (current_len + incoming_len - skip_count).saturating_sub(MAX_WINDOW_CAPACITY);
            if drain_amount > 0 {
                self.logs_window.drain(..drain_amount);
            }

            self.first_line += drain_amount;
            self.logs_window
                .extend(items.into_iter().skip(skip_count).map(|item| item.content));
        }

        //TODO AAZ: Remove after testing.
        if cfg!(debug_assertions) {
            // use itertools::Itertools;
            //
            // let duplicates = self.logs_window.iter().duplicates().collect_vec();
            // assert!(duplicates.is_empty(), "{duplicates:?}");
            assert!(self.logs_window.len() <= MAX_WINDOW_CAPACITY);
        }
    }

    pub fn get_log(&self, row_idx: u64) -> Option<&str> {
        self.logs_window
            .get((row_idx as usize).saturating_sub(self.first_line))
            .map(|s| s.as_str())
    }

    /// Checks if we need to fetch new data to be able to display the logs in the
    /// provided range.
    pub fn check_fetch(
        &self,
        rows_window: &Range<u64>,
        total_logs: usize,
    ) -> Option<RangeInclusive<u64>> {
        if total_logs == 0 {
            return None;
        }

        let last_line = self.last_line();

        // Handle before offset
        let start_needed = (rows_window.start as usize).saturating_sub(LOGS_WINDOW_OFFSET);
        let start = (start_needed < self.first_line || start_needed > last_line)
            .then_some(start_needed as u64);

        // Handle after offset

        let end_needed = (rows_window.end as usize + LOGS_WINDOW_OFFSET).min(total_logs);
        let end =
            (end_needed > last_line || end_needed < self.first_line).then_some(end_needed as u64);

        let rng = match (start, end) {
            (Some(start), Some(end)) => start..=end.saturating_sub(1),
            (Some(start), None) => start..=self.first_line.saturating_sub(1) as u64, //TODO: Should this be 2?
            (None, Some(end)) => (last_line as u64)..=end.saturating_sub(1),
            (None, None) => return None,
        };

        Some(rng)
    }

    #[inline]
    /// The index of the last line in logs window.
    fn last_line(&self) -> usize {
        self.first_line + self.logs_window.len()
    }
}
