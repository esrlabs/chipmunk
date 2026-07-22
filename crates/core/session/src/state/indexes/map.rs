use std::ops::RangeInclusive;

use log::error;
use rustc_hash::FxHashMap;

use super::{IndexedNavigation, frame::Frame, keys::Keys, nature::Nature};

// This trigger is used to choose a way to remove key from a map.
// If count of keys, which should be removed grander than TRIGGER,
// whole map would be dropped and rebuilt; if not - keys will be
// removed one by one.
//
// Bench tests (creating ranges from indexes)
// keys: 800 000 000
// created ranges: 200 000 000 in 8923 ms (8923908630 nn)
// ==========================================================
// keys: 80 000 000
// created ranges: 20 000 000 in 366 ms (366996208 nn)
// ==========================================================
// keys: 8 000 000
// created ranges: 2 000 000 in 20 ms (20743126 nn)
// ==========================================================
// keys: 800 000
// created ranges: 200 000 in 4 ms (4432853 nn)
// ==========================================================
// keys: 80 000
// created ranges: 20 000 in 0 ms (433805 nn)
// ==========================================================
// Conclusion: ranges could be created if keys < ~100K
//
// Bench tests (removing keys one by one with binary search)
// keys: 80 000
// removed keys: 80 000 in 681 ms (681925515 nn)
// ==========================================================
// keys: 8 000
// removed keys: 8 000 in 4 ms (4864688 nn)
// ==========================================================
// keys: 800
// removed keys: 800 in 0 ms (59724 nn)
// ==========================================================
// Conclusion: removing keys one by one reasonable if keys <= ~1K

const KEYS_ITERATIONS_LIMIT: usize = 500; // based on bench test < 1K
const RANGES_LIMIT: usize = 10000; // based on bench test < 100K

#[derive(Debug)]
pub struct Map {
    indexes: FxHashMap<u64, Nature>,
    keys: Keys,
}

impl Map {
    pub fn new() -> Self {
        Self {
            indexes: FxHashMap::default(),
            keys: Keys::new(),
        }
    }

    fn as_ranges(values: &mut [u64]) -> Option<Vec<RangeInclusive<u64>>> {
        if values.len() > RANGES_LIMIT {
            return None;
        }
        let mut ranges = vec![];
        let mut from: u64 = 0;
        let mut to: u64 = 0;
        values.sort();
        for (i, value) in values.iter().enumerate() {
            if i == 0 {
                from = *value;
            } else if to + 1 != *value {
                ranges.push(RangeInclusive::new(from, to));
                if ranges.len() >= KEYS_ITERATIONS_LIMIT {
                    return None;
                }
                from = *value;
            }
            to = *value;
        }
        if (!ranges.is_empty() && ranges[ranges.len() - 1].start() != &from)
            || (ranges.is_empty() && !values.is_empty())
        {
            ranges.push(RangeInclusive::new(from, to));
        }
        Some(ranges)
    }

    pub fn get_all_as_ranges(&self) -> Vec<RangeInclusive<u64>> {
        self.keys.as_ranges()
    }

    fn index_add(&mut self, position: u64, nature: Nature) {
        if self.indexes.insert(position, nature).is_none() {
            self.keys.add(position);
        }
    }

    fn indexes_remove(&mut self, positions: &mut [u64]) {
        let ranges = Self::as_ranges(positions);
        positions.iter().for_each(|position| {
            self.indexes.remove(position);
        });
        let drop_keys = if let Some(ranges) = ranges.as_ref() {
            if let Err(err) = self.keys.remove_ranges(ranges) {
                error!("Cannot cleanup keys by ranges: {err}; map will be dropped");
                true
            } else {
                false
            }
        } else {
            true
        };
        if drop_keys {
            self.keys
                .clear()
                .import(self.indexes.keys().copied().collect::<Vec<u64>>());
        }
    }

    pub fn insert(&mut self, positions: impl IntoIterator<Item = u64>, nature: Nature) {
        positions.into_iter().for_each(|position| {
            if let Some(index) = self.indexes.get_mut(&position) {
                index.include(nature);
            } else {
                self.index_add(position, nature);
            }
        });
    }

    pub fn remove(&mut self, positions: &[u64], nature: Nature) {
        let mut to_be_removed = Vec::new();
        positions.iter().for_each(|position| {
            if let Some(index) = self.indexes.get_mut(position) {
                index.exclude(nature);
                if index.is_empty() {
                    to_be_removed.push(*position);
                }
            }
        });
        self.indexes_remove(&mut to_be_removed);
    }

    pub fn naturalize(&self, elements: &mut [stypes::GrabbedElement]) {
        elements.iter_mut().for_each(|element| {
            if let Some(nature) = self.indexes.get(&(element.pos as u64)) {
                element.set_nature(nature.bits());
            }
            // Elements outside the indexed map retain nature 0.
        });
    }

    pub fn indexed_neighbor(
        &mut self,
        anchor: Option<u64>,
        direction: IndexedNavigation,
    ) -> Option<u64> {
        self.keys.neighbor(anchor, direction)
    }

    pub fn clean(&mut self, nature: Nature) {
        let mut to_be_removed = vec![];
        self.indexes.iter_mut().for_each(|(position, index)| {
            index.exclude(nature);
            if index.is_empty() {
                to_be_removed.push(*position);
            }
        });
        self.indexes_remove(&mut to_be_removed);
    }

    pub fn len(&self) -> usize {
        self.indexes.len()
    }

    pub fn set_stream_len(&mut self, len: u64) {
        if len == 0 {
            self.indexes.clear();
            self.keys.clear();
        }
    }

    pub fn frame(&mut self, range: &mut RangeInclusive<u64>) -> Result<Frame, stypes::NativeError> {
        if range.end() >= &(self.indexes.len() as u64) {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Grabber,
                message: Some(format!(
                    "Out of range. Map len: {}; requested: {range:?}",
                    self.indexes.len()
                )),
            });
        }
        self.keys.sort();
        let mut frame = Frame::new();
        for index in range {
            let position = self.keys.get_position(index as usize)?;
            let nature = self.indexes.get(&position).ok_or(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Grabber,
                message: Some(format!("Cannot find nature for {position}")),
            })?;
            frame.insert((position, *nature));
        }
        Ok(frame)
    }
}

impl Default for Map {
    fn default() -> Self {
        Self::new()
    }
}
