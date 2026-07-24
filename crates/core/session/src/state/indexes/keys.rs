use std::ops::RangeInclusive;

use super::IndexedNavigation;

/// A struct to collect the line keys (indices) to match the keys in map
/// in search controller.
///
/// This struct sort the items if needed to perform binary searches on getting
/// and removing operations to do them more efficiently especially on ranges.
#[derive(Debug)]
pub struct Keys {
    keys: Vec<u64>,
    sorted: bool,
}

impl Keys {
    pub fn new() -> Self {
        Keys {
            keys: vec![],
            sorted: false,
        }
    }

    pub fn as_ranges(&self) -> Vec<RangeInclusive<u64>> {
        let mut ranges = vec![];
        let mut from: u64 = 0;
        let mut to: u64 = 0;
        for (i, value) in self.keys.iter().enumerate() {
            if i == 0 {
                from = *value;
            } else if to + 1 != *value {
                ranges.push(RangeInclusive::new(from, to));
                from = *value;
            }
            to = *value;
        }
        if (!ranges.is_empty() && ranges[ranges.len() - 1].start() != &from)
            || (ranges.is_empty() && !self.keys.is_empty())
        {
            ranges.push(RangeInclusive::new(from, to));
        }
        ranges
    }

    pub fn add(&mut self, position: u64) {
        self.keys.push(position);
        self.sorted = false;
    }

    pub fn remove_ranges(&mut self, ranges: &[RangeInclusive<u64>]) -> Result<(), String> {
        self.sort();
        for range in ranges {
            if let (Ok(start), Ok(end)) = (
                self.keys.binary_search(range.start()),
                self.keys.binary_search(range.end()),
            ) {
                self.keys.drain(start..=end);
            } else {
                return Err(format!("Fail to find indexes for range: {range:?}"));
            }
        }
        Ok(())
    }

    pub fn clear(&mut self) -> &mut Self {
        self.keys.clear();
        self
    }

    pub fn sort(&mut self) {
        if !self.sorted {
            self.keys.sort_unstable();
            self.sorted = true;
        }
    }

    pub fn import(&mut self, indexes: Vec<u64>) {
        self.keys = indexes;
        self.sorted = false;
    }

    /// Returns the exact ordered index for a session position.
    pub fn get_index(&mut self, position: &u64) -> Result<usize, stypes::NativeError> {
        self.sort();
        self.keys
            .binary_search(position)
            .map_err(|_| stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Grabber,
                message: Some(format!("Cannot find index for position: {position}")),
            })
    }

    pub fn get_position(&self, index: usize) -> Result<u64, stypes::NativeError> {
        self.keys.get(index).copied().ok_or(stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Grabber,
            message: Some(format!("Cannot find position for index: {index}")),
        })
    }

    pub fn neighbor(&mut self, anchor: Option<u64>, direction: IndexedNavigation) -> Option<u64> {
        if self.keys.is_empty() {
            return None;
        }

        self.sort();

        let Some(anchor) = anchor else {
            return self.keys.first().copied();
        };

        match direction {
            IndexedNavigation::Next => {
                let index = match self.keys.binary_search(&anchor) {
                    Ok(index) => index + 1,
                    Err(index) => index,
                };
                self.keys
                    .get(index)
                    .copied()
                    .or_else(|| self.keys.first().copied())
            }
            IndexedNavigation::Previous => {
                let index = match self.keys.binary_search(&anchor) {
                    Ok(index) | Err(index) => index,
                };
                index
                    .checked_sub(1)
                    .and_then(|index| self.keys.get(index).copied())
                    .or_else(|| self.keys.last().copied())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use std::ops::RangeInclusive;

    use super::{IndexedNavigation, Keys};

    fn keys_with_rows(rows: impl IntoIterator<Item = u64>) -> Keys {
        let mut keys = Keys::new();
        for row in rows {
            keys.add(row);
        }
        keys
    }

    #[test]
    fn exact_lookup_sorts_and_finds_session_position() {
        let mut keys = keys_with_rows([13, 1, 8]);

        assert_eq!(keys.get_index(&1).unwrap(), 0);
        assert_eq!(keys.get_index(&8).unwrap(), 1);
        assert_eq!(keys.get_index(&13).unwrap(), 2);
        assert!(keys.get_index(&5).is_err());
    }

    #[test]
    fn contiguous_positions_are_compacted_into_ranges() {
        let mut keys = keys_with_rows([100, 4, 3, 11, 10, 5]);
        keys.sort();

        assert_eq!(
            keys.as_ranges(),
            vec![
                RangeInclusive::new(3, 5),
                RangeInclusive::new(10, 11),
                RangeInclusive::new(100, 100),
            ]
        );
    }

    #[test]
    fn neighbor_empty_returns_none() {
        let mut keys = Keys::new();

        assert_eq!(keys.neighbor(Some(10), IndexedNavigation::Next), None);
        assert_eq!(keys.neighbor(Some(10), IndexedNavigation::Previous), None);
        assert_eq!(keys.neighbor(None, IndexedNavigation::Next), None);
    }

    #[test]
    fn neighbor_without_anchor_returns_first_for_both_directions() {
        let mut keys = keys_with_rows([9, 1, 5]);

        assert_eq!(keys.neighbor(None, IndexedNavigation::Next), Some(1));
        assert_eq!(keys.neighbor(None, IndexedNavigation::Previous), Some(1));
    }

    #[test]
    fn neighbor_next_from_middle() {
        let mut keys = keys_with_rows([1, 5, 9]);

        assert_eq!(keys.neighbor(Some(5), IndexedNavigation::Next), Some(9));
    }

    #[test]
    fn neighbor_previous_from_middle() {
        let mut keys = keys_with_rows([1, 5, 9]);

        assert_eq!(keys.neighbor(Some(5), IndexedNavigation::Previous), Some(1));
    }

    #[test]
    fn neighbor_next_wraps_to_first() {
        let mut keys = keys_with_rows([1, 5, 9]);

        assert_eq!(keys.neighbor(Some(9), IndexedNavigation::Next), Some(1));
    }

    #[test]
    fn neighbor_previous_wraps_to_last() {
        let mut keys = keys_with_rows([1, 5, 9]);

        assert_eq!(keys.neighbor(Some(1), IndexedNavigation::Previous), Some(9));
    }

    #[test]
    fn neighbor_anchor_not_present_uses_adjacent_rows() {
        let mut keys = keys_with_rows([1, 5, 9]);

        assert_eq!(keys.neighbor(Some(4), IndexedNavigation::Next), Some(5));
        assert_eq!(keys.neighbor(Some(4), IndexedNavigation::Previous), Some(1));
    }
}
