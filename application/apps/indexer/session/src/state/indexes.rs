use crate::{
    events::{NativeError, NativeErrorKind},
    state::GrabbedElement,
};
use indexer_base::progress::Severity;
use std::{collections::BTreeMap, ops::RangeInclusive};

#[repr(u8)]
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum Nature {
    Search = 0u8,
    Bookmark = 1u8,
    Selection = 2u8,
    Breadcrumb = 3u8,
    BreadcrumbSeporator = 4u8,
}

impl Nature {
    pub fn as_u8(&self) -> u8 {
        *self as u8
    }

    pub fn from(i: u8) -> Result<Self, NativeError> {
        match i {
            0 => Ok(Self::Search),
            1 => Ok(Self::Bookmark),
            2 => Ok(Self::Selection),
            3 => Ok(Self::Breadcrumb),
            4 => Ok(Self::BreadcrumbSeporator),
            _ => Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!("Invalid index of Nature enum: {i}")),
            }),
        }
    }
}

#[derive(Debug)]
pub struct Index {
    position: u64,
    natures: Vec<Nature>,
}

impl Index {
    pub fn new(position: &u64, nature: &Nature) -> Self {
        Index {
            position: *position,
            natures: vec![*nature],
        }
    }

    pub fn extend(&mut self, nature: &Nature) {
        if self.natures.iter().any(|n| n == nature) {
            return;
        }
        self.natures.push(*nature);
    }

    pub fn abbreviate(&mut self, nature: &Nature) -> bool {
        if let Some(i) = self.natures.iter().position(|n| n == nature) {
            self.natures.remove(i);
        }
        self.natures.is_empty()
    }

    pub fn get_natures(&self) -> Vec<u8> {
        self.natures.iter().map(|n| n.as_u8()).collect()
    }
}

#[derive(Debug)]
pub struct Frame<'a> {
    pub indexes: Vec<&'a Index>,
}

impl<'a> Frame<'a> {
    pub fn new() -> Self {
        Self { indexes: vec![] }
    }

    pub fn insert(&mut self, index: &'a Index) {
        self.indexes.push(index);
    }

    pub fn len(&self) -> usize {
        self.indexes.len()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn ranges(&self) -> Vec<RangeInclusive<u64>> {
        let mut ranges = vec![];
        let mut from_pos: u64 = 0;
        let mut to_pos: u64 = 0;
        for (i, index) in self.indexes.iter().enumerate() {
            if i == 0 {
                from_pos = index.position;
            } else if to_pos + 1 != index.position {
                ranges.push(RangeInclusive::new(from_pos, to_pos));
                from_pos = index.position;
            }
            to_pos = index.position;
        }
        if (!ranges.is_empty() && ranges[ranges.len() - 1].start() != &from_pos)
            || (ranges.is_empty() && !self.indexes.is_empty())
        {
            ranges.push(RangeInclusive::new(from_pos, to_pos));
        }
        ranges
    }

    pub fn naturalize(&self, elements: &mut Vec<GrabbedElement>) -> Result<(), NativeError> {
        if elements.len() != self.indexes.len() {
            return Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!(
                    "Fail to naturalize range. Indexes len: {}; elements len: {}.",
                    self.indexes.len(),
                    elements.len()
                )),
            });
        }
        elements.iter_mut().enumerate().for_each(|(i, el)| {
            el.set_nature(self.indexes[i].get_natures());
        });
        Ok(())
    }
}

impl<'a> Default for Frame<'a> {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug)]
pub struct Indexes {
    pub indexes: BTreeMap<u64, Index>,
    pub stream_len: u64,
}

impl Indexes {
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
        if (end as usize) >= self.len() {
            return Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!(
                    "Out of range. Invalid index: {end}. Indexes len: {};",
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
        let middle = (end - start) / 2;
        self.insert_range(
            RangeInclusive::new(start, start + min_offset),
            &Nature::Breadcrumb,
        );
        self.insert(&[middle], &Nature::BreadcrumbSeporator);
        self.insert_range(
            RangeInclusive::new(end - min_offset, end),
            &Nature::Breadcrumb,
        );
        Ok(())
    }

    pub fn insert_breadcrumbs(
        &mut self,
        min_distance: u64,
        min_offset: u64,
    ) -> Result<(), NativeError> {
        let keys = self.indexes.keys().cloned().collect::<Vec<u64>>();
        let keys_ref = keys.iter().collect::<Vec<&u64>>();
        if keys.is_empty() {
            return Ok(());
        }
        for n in &keys {
            if *n == 0 {
                let first = self.get_by_key(&keys_ref, 0)?;
                if first.position <= min_distance + 2 {
                    self.insert_range(
                        RangeInclusive::new(0, first.position - 1),
                        &Nature::Breadcrumb,
                    );
                } else {
                    self.insert_between(RangeInclusive::new(0, first.position - 1), min_offset)?;
                }
            } else if *n as usize == keys.len() - 1 {
                let last = self.get_by_key(&keys_ref, 0)?;
                let rest = self.stream_len - last.position;
                if rest <= min_distance + 2 {
                    self.insert_range(
                        RangeInclusive::new(last.position, self.stream_len - 1),
                        &Nature::Breadcrumb,
                    );
                } else {
                    self.insert_between(
                        RangeInclusive::new(last.position, self.stream_len - 1),
                        min_offset,
                    )?;
                }
            } else {
                let from = self.get_by_key(&keys_ref, (*n as usize) - 1)?;
                let to = self.get_by_key(&keys_ref, *n as usize)?;
                if from.position >= to.position {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::Grabber,
                        message: Some(format!(
                            "Indexes map is broken. Fail to compare previous and next elements. Prev: {}; next: {}",
                            from.position,
                            to.position
                        )),
                    });
                }
                let distance = to.position - from.position;
                if distance == 1 {
                    continue;
                }
                if distance <= min_distance + 2 {
                    self.insert_range(
                        RangeInclusive::new(from.position, to.position - 1),
                        &Nature::Breadcrumb,
                    );
                } else {
                    self.insert_between(
                        RangeInclusive::new(from.position, to.position - 1),
                        min_offset,
                    )?;
                }
            }
        }
        Ok(())
    }

    fn get_by_key(&self, keys: &Vec<&u64>, key: usize) -> Result<&Index, NativeError> {
        if key >= keys.len() {
            return Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!(
                    "Key Index {key} doesn't exist. Indexes len: {};",
                    self.indexes.len()
                )),
            });
        }
        let key_value = keys[key];
        self.indexes.get(key_value).ok_or(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Grabber,
            message: Some(format!(
                "Key value {key_value} doesn't exist. Indexes len: {};",
                self.indexes.len()
            )),
        })
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
                    "Out of range. Indexes len: {len}; requested: {range:?}"
                )),
            });
        }
        let mut frame = Frame::new();
        for n in range {
            frame.insert(self.get_by_key(&keys, n as usize)?);
        }
        Ok(frame)
    }
}

impl Default for Indexes {
    fn default() -> Self {
        Self::new()
    }
}
