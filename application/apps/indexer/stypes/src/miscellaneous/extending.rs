use std::ops::RangeInclusive;

use crate::*;
use regex::Regex;

impl CandlePoint {
    pub fn new(row: u64, y: f64) -> Self {
        Self {
            row,
            min_max_y: None,
            y_value: y,
        }
    }

    pub fn row_inside(&self, frame: &RangeInclusive<u64>) -> bool {
        &self.row >= frame.start() && &self.row <= frame.end()
    }

    pub fn row_before(&self, frame: &RangeInclusive<u64>) -> bool {
        &self.row < frame.start()
    }

    pub fn row_after(&self, frame: &RangeInclusive<u64>) -> bool {
        &self.row > frame.end()
    }

    pub fn between(left: &CandlePoint, right: &CandlePoint, pos: &u64) -> CandlePoint {
        let pos_distance = right.row - left.row;
        let value_diff = right.y_value - left.y_value;
        let step = value_diff / pos_distance as f64;
        CandlePoint::new(*pos, (pos - left.row) as f64 * step + left.y_value)
    }
}

impl GrabbedElement {
    /// Sets the `nature` field of the `GrabbedElement`.
    ///
    /// # Parameters
    /// - `nature`: A `u8` value representing the new nature of the element.
    pub fn set_nature(&mut self, nature: u8) {
        self.nature = nature;
    }
}

impl FilterMatch {
    /// Creates a new `FilterMatch` instance.
    ///
    /// # Parameters
    /// - `index`: The index of the log entry that matches the filter.
    /// - `filters`: A vector of `u8` values representing the filter IDs that matched.
    ///
    /// # Returns
    /// - A new `FilterMatch` instance with the specified index and filters.
    pub fn new(index: u64, filters: Vec<u8>) -> Self {
        Self { index, filters }
    }
}

impl ExtractedMatchValue {
    pub fn new(index: u64, input: &str, filters: &[Regex]) -> Self {
        Self {
            index,
            values: ExtractedMatchValue::extract(input, filters),
        }
    }

    pub fn extract(input: &str, filters: &[Regex]) -> Vec<(usize, Vec<String>)> {
        let mut values: Vec<(usize, Vec<String>)> = vec![];
        for (filter_index, filter) in filters.iter().enumerate() {
            for caps in filter.captures_iter(input) {
                let mut matches: Vec<String> = caps
                    .iter()
                    .flatten()
                    .map(|m| m.as_str().to_owned())
                    .collect();
                if matches.len() <= 1 {
                    // warn here
                } else {
                    // 0 always - whole match
                    matches.remove(0);
                    values.push((filter_index, matches));
                }
            }
        }
        values
    }
}
