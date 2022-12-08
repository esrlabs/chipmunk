use super::{frame::Frame, index::Index, nature::Nature};
use crate::events::{NativeError, NativeErrorKind};
use indexer_base::progress::Severity;
use std::{cmp, collections::BTreeMap, ops::RangeInclusive};

#[derive(Debug)]
pub struct Map {
    pub indexes: BTreeMap<u64, Index>,
    pub stream_len: u64,
}

impl Map {
    pub fn new() -> Self {
        Self {
            indexes: BTreeMap::new(),
            stream_len: 0,
        }
    }

    pub fn insert(&mut self, positions: &[u64], nature: &Nature) {
        positions.iter().for_each(|position| {
            if let Some(index) = self.indexes.get_mut(position) {
                index.extend(nature);
            } else {
                self.indexes.insert(*position, Index::new(position, nature));
            }
        });
    }

    pub fn insert_range(&mut self, range: RangeInclusive<u64>, nature: &Nature) {
        let positions = range.collect::<Vec<u64>>();
        self.insert(&positions, nature);
    }

    pub fn remove(&mut self, positions: &[u64], nature: &Nature) {
        positions.iter().for_each(|position| {
            if let Some(index) = self.indexes.get_mut(position) {
                if index.abbreviate(nature) {
                    self.indexes.remove(position);
                }
            }
        });
    }

    pub fn remove_range(&mut self, range: RangeInclusive<u64>, nature: &Nature) {
        let positions = range.collect::<Vec<u64>>();
        self.remove(&positions, nature);
    }

    fn insert_between(
        &mut self,
        range: RangeInclusive<u64>,
        min_offset: u64,
    ) -> Result<(), NativeError> {
        let start = *range.start();
        let end = *range.end();
        if end >= self.stream_len {
            return Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!(
                    "Out of range. Invalid index: {end}. Map len: {};",
                    self.indexes.len()
                )),
            });
        }
        if end - start < min_offset * 2 + 1 {
            return Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!(
                    "Out of range. Invalid min offset configuration. Offset: {min_offset}. Range: {range:?};",
                )),
            });
        }
        let middle = (end - start) / 2 + start;
        self.insert_range(
            RangeInclusive::new(start, start + min_offset - 1),
            &Nature::Breadcrumb,
        );
        self.insert(&[middle], &Nature::BreadcrumbSeporator);
        self.insert_range(
            RangeInclusive::new(end - min_offset + 1, end),
            &Nature::Breadcrumb,
        );
        Ok(())
    }

    fn insert_breadcrumbs(
        &mut self,
        // from_key_index - index of key in self.indexes.keys(), but not (!) a stream-index
        from_key_index: usize,
        min_distance: u64,
        min_offset: u64,
    ) -> Result<(), NativeError> {
        if self.stream_len == 0 || self.is_empty() {
            return Ok(());
        }
        if from_key_index >= self.len() {
            return Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!(
                    "Cannot insert breadcrumbs from {from_key_index}, because len of map {}",
                    self.len()
                )),
            });
        }
        let keys: Vec<u64> = self.indexes.keys().copied().collect::<Vec<u64>>();
        let keys_ref = keys.iter().collect::<Vec<&u64>>();
        if keys.is_empty() {
            return Ok(());
        }
        if from_key_index == 0 {
            let first = self.get_by_index(&keys_ref, 0)?;
            if first.position > 0 {
                if first.position <= min_distance + 2 {
                    self.insert_range(
                        RangeInclusive::new(0, first.position - 1),
                        &Nature::Breadcrumb,
                    );
                } else {
                    self.insert_between(RangeInclusive::new(0, first.position - 1), min_offset)?;
                }
            }
        }
        let target: &[u64] = &keys[from_key_index..];
        for pair in target.windows(2) {
            let [from, to]: [u64; 2] = pair.try_into().unwrap();
            if from >= to {
                return Err(NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::Grabber,
                    message: Some(format!(
                        "Map map is broken. Fail to compare previous and next elements. Prev: {from}; next: {to}",
                    )),
                });
            }
            let distance = to - from;
            if distance == 1 {
                continue;
            }
            if distance <= min_distance + 2 {
                self.insert_range(RangeInclusive::new(from, to - 1), &Nature::Breadcrumb);
            } else {
                self.insert_between(RangeInclusive::new(from + 1, to - 1), min_offset)?;
            }
        }
        let last = self.get_by_index(&keys_ref, keys_ref.len() - 1)?;
        if last.position < self.stream_len - 1 {
            let rest = self.stream_len - last.position;
            if rest <= min_distance + 2 {
                self.insert_range(
                    RangeInclusive::new(last.position, self.stream_len - 1),
                    &Nature::Breadcrumb,
                );
            } else {
                self.insert_between(
                    RangeInclusive::new(last.position + 1, self.stream_len - 1),
                    min_offset,
                )?;
            }
        }
        Ok(())
    }

    pub fn build_breadcrumbs(
        &mut self,
        min_distance: u64,
        min_offset: u64,
    ) -> Result<(), NativeError> {
        self.clean(&Nature::Breadcrumb);
        self.clean(&Nature::BreadcrumbSeporator);
        self.clean(&Nature::Selection);
        self.insert_breadcrumbs(0, min_distance, min_offset)
    }

    pub fn update_breadcrumbs(
        &mut self,
        from: u64,
        min_distance: u64,
        min_offset: u64,
    ) -> Result<(), NativeError> {
        if self.stream_len == 0 {
            return Ok(());
        }
        let key_index = self.get_key_position(&from)?;
        // Remove breadcrumbs from bottom
        self.remove_range(
            RangeInclusive::new(from, self.stream_len - 1),
            &Nature::Breadcrumb,
        );
        self.remove_range(
            RangeInclusive::new(from, self.stream_len - 1),
            &Nature::BreadcrumbSeporator,
        );
        self.insert_breadcrumbs(key_index, min_distance, min_offset)
    }

    pub fn extend_breadcrumbs(
        &mut self,
        seporator: u64,
        offset: u64,
        above: bool,
    ) -> Result<(), NativeError> {
        let sep_index = self.indexes.get(&seporator).ok_or(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Grabber,
            message: Some(format!("Index {seporator} cannot be found.",)),
        })?;
        if !sep_index.includes(&Nature::BreadcrumbSeporator) {
            return Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!(
                    "Index {seporator} isn't Nature::BreadcrumbSeporator.",
                )),
            });
        }
        let (before, after) = self.get_arround_indexes(&seporator)?;
        let mut self_check = false;
        if above && before.is_some() {
            let before_pos = Option::unwrap(before).position;
            if before_pos != seporator - 1 {
                let min = cmp::min(seporator - 1, before_pos + offset);
                self.insert_range(
                    RangeInclusive::new(before_pos + 1, min),
                    &Nature::Breadcrumb,
                );
                self_check = min == seporator - 1;
            }
        } else if !above && after.is_some() {
            let after_pos = Option::unwrap(after).position;
            if after_pos != seporator + 1 {
                let max = cmp::max(
                    seporator + 1,
                    if after_pos >= offset {
                        after_pos - offset
                    } else {
                        0
                    },
                );
                self.insert_range(RangeInclusive::new(max, after_pos - 1), &Nature::Breadcrumb);
                self_check = max == seporator + 1;
            }
        }
        if self_check {
            let (before, after) = self.get_arround_indexes(&seporator)?;
            let clear = if before.is_some() && after.is_some() {
                let before_pos = Option::unwrap(before).position;
                let after_pos = Option::unwrap(after).position;
                after_pos - 1 == seporator && seporator == before_pos + 1
            } else if before.is_some() && after.is_none() {
                let before_pos = Option::unwrap(before).position;
                seporator == before_pos + 1
            } else if before.is_none() && after.is_some() {
                let after_pos = Option::unwrap(after).position;
                after_pos - 1 == seporator
            } else {
                true
            };
            if clear {
                self.remove(&vec![seporator][..], &Nature::BreadcrumbSeporator);
                self.insert(&vec![seporator][..], &Nature::Breadcrumb);
            }
        }
        Ok(())
    }

    fn get_by_index(&self, keys: &Vec<&u64>, index: usize) -> Result<&Index, NativeError> {
        if index >= keys.len() {
            return Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!(
                    "Key Index {index} doesn't exist. Map len: {};",
                    self.indexes.len()
                )),
            });
        }
        let key_value = keys[index];
        self.indexes.get(key_value).ok_or(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Grabber,
            message: Some(format!(
                "Key value {key_value} doesn't exist. Map len: {};",
                self.indexes.len()
            )),
        })
    }

    fn get_key_position(&self, key: &u64) -> Result<usize, NativeError> {
        self.indexes
            .keys()
            .position(|k| k == key)
            .ok_or(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!(
                    "Key value {key} doesn't exist. Map len: {};",
                    self.indexes.len()
                )),
            })
    }

    fn get_arround_indexes(
        &self,
        key: &u64,
    ) -> Result<(Option<&Index>, Option<&Index>), NativeError> {
        let mut before: Option<&Index> = None;
        let mut after: Option<&Index> = None;
        let sep_index_pos = self.get_key_position(key)?;
        let keys = self.indexes.keys().collect::<Vec<&u64>>();
        if sep_index_pos > 0 {
            before = self.indexes.get(keys[sep_index_pos - 1]);
        }
        if sep_index_pos < keys.len() - 1 {
            after = self.indexes.get(keys[sep_index_pos + 1]);
        }
        Ok((before, after))
    }

    pub fn get_last_key_for_nature(&self, natures: &[Nature]) -> Option<u64> {
        let keys = self.indexes.keys().collect::<Vec<&u64>>();
        for n in (0..keys.len()).rev() {
            if let Some(index) = self.indexes.get(keys[n]) {
                for nature in natures {
                    if index.includes(nature) {
                        return Some(*keys[n]);
                    }
                }
            }
        }
        None
    }

    pub fn clean(&mut self, nature: &Nature) {
        let mut to_be_removed: Vec<u64> = vec![];
        self.indexes.iter_mut().for_each(|(position, index)| {
            if index.abbreviate(nature) {
                to_be_removed.push(*position)
            }
        });
        to_be_removed.iter().for_each(|position| {
            self.indexes.remove(position);
        });
    }

    pub fn len(&self) -> usize {
        self.indexes.len()
    }

    pub fn set_stream_len(&mut self, len: u64) {
        self.stream_len = len;
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn frame(&self, range: &mut RangeInclusive<u64>) -> Result<Frame, NativeError> {
        let keys = self.indexes.keys().collect::<Vec<&u64>>();
        let len = keys.len();
        if range.end() >= &(len as u64) {
            return Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!(
                    "Out of range. Map len: {len}; requested: {range:?}"
                )),
            });
        }
        let mut frame = Frame::new();
        for n in range {
            frame.insert(self.get_by_index(&keys, n as usize)?);
        }
        Ok(frame)
    }
}

impl Default for Map {
    fn default() -> Self {
        Self::new()
    }
}
