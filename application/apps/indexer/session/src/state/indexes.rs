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
        if end >= self.stream_len {
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

    pub fn insert_breadcrumbs(
        &mut self,
        min_distance: u64,
        min_offset: u64,
    ) -> Result<(), NativeError> {
        let keys: Vec<u64> = self.indexes.keys().copied().collect::<Vec<u64>>();
        let keys_ref = keys.iter().collect::<Vec<&u64>>();
        if keys.is_empty() {
            return Ok(());
        }
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
        for pair in keys.windows(2) {
            let [from, to]: [u64; 2] = pair.try_into().unwrap();
            if from >= to {
                return Err(NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::Grabber,
                    message: Some(format!(
                        "Indexes map is broken. Fail to compare previous and next elements. Prev: {from}; next: {to}",
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

    fn get_by_index(&self, keys: &Vec<&u64>, index: usize) -> Result<&Index, NativeError> {
        if index >= keys.len() {
            return Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!(
                    "Key Index {index} doesn't exist. Indexes len: {};",
                    self.indexes.len()
                )),
            });
        }
        let key_value = keys[index];
        self.indexes.get(key_value).ok_or(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Grabber,
            message: Some(format!(
                "Key value {key_value} doesn't exist. Indexes len: {};",
                self.indexes.len()
            )),
        })
    }

    fn get_by_key(&self, key: &u64) -> Result<&Index, NativeError> {
        self.indexes.get(key).ok_or(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Grabber,
            message: Some(format!(
                "Key value {key} doesn't exist. Indexes len: {};",
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
                    "Out of range. Indexes len: {len}; requested: {range:?}"
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

impl Default for Indexes {
    fn default() -> Self {
        Self::new()
    }
}

#[test]
fn test_basic() {
    let mut map = Indexes::new();
    let search_matches = vec![0, 10, 20, 30, 40, 50, 60, 70, 80, 90];
    // Add into map search matches
    map.insert(&search_matches, &Nature::Search);
    assert_eq!(map.len(), 10);
    // Get frame
    let frame = map.frame(&mut RangeInclusive::new(0, 9)).unwrap();
    assert_eq!(frame.len(), 10);
    let sum: u64 = frame
        .indexes
        .iter()
        .map(|i| i.natures.iter().map(|n| n.as_u8() as u64).sum::<u64>())
        .sum();
    // Value of Nature::Search is 0, it means sum of all natures should be 0 for frame
    assert_eq!(sum, 0);
    // Add bookmarks into same rows as matches.
    map.insert(&search_matches, &Nature::Bookmark);
    let frame = map.frame(&mut RangeInclusive::new(0, 9)).unwrap();
    assert_eq!(frame.len(), 10);
    let sum: u64 = frame
        .indexes
        .iter()
        .map(|i| i.natures.iter().map(|n| n.as_u8() as u64).sum::<u64>())
        .sum();
    // As soon as Nature::Bookmark = 1, sum should be 10.
    assert_eq!(sum, 10);
    assert_eq!(map.len(), 10);
    // Remove all bookmarks
    map.remove_range(RangeInclusive::new(0, 90), &Nature::Bookmark);
    assert_eq!(map.len(), 10);
    let frame = map.frame(&mut RangeInclusive::new(0, 9)).unwrap();
    assert_eq!(frame.len(), 10);
    let sum: u64 = frame
        .indexes
        .iter()
        .map(|i| i.natures.iter().map(|n| n.as_u8() as u64).sum::<u64>())
        .sum();
    // No bookmarks, all indexes has nature Nature::Search = 0, sum should 0 as well
    assert_eq!(sum, 0);
    // Add bookmarks between 0 and 10
    map.insert_range(RangeInclusive::new(1, 9), &Nature::Bookmark);
    assert_eq!(map.len(), 19);
    // This frame should have only 2 matches and 9 bookmarks
    let frame = map.frame(&mut RangeInclusive::new(0, 10)).unwrap();
    assert_eq!(frame.len(), 11);
    let sum: u64 = frame
        .indexes
        .iter()
        .map(|i| i.natures.iter().map(|n| n.as_u8() as u64).sum::<u64>())
        .sum();
    // 9 bookmarks should give sum = 9
    assert_eq!(sum, 9);
    // First and last elements in frame should be search match only
    assert_eq!(frame.indexes[0].natures[0].as_u8(), 0);
    assert_eq!(frame.indexes[10].natures[0].as_u8(), 0);
    assert_eq!(frame.indexes[0].natures.len(), 1);
    assert_eq!(frame.indexes[10].natures.len(), 1);
    // Select extra 10 rows
    map.insert_range(RangeInclusive::new(91, 100), &Nature::Selection);
    assert_eq!(map.len(), 19 + 10);
    // Will request only selection
    let frame = map.frame(&mut RangeInclusive::new(19, 28)).unwrap();
    assert_eq!(frame.len(), 10);
    let sum: u64 = frame
        .indexes
        .iter()
        .map(|i| i.natures.iter().map(|n| n.as_u8() as u64).sum::<u64>())
        .sum();
    // 10 selections should give sum = 20 = 2 * 10
    frame.indexes.iter().for_each(|i| {
        assert_eq!(i.natures.len(), 1);
        assert_eq!(i.natures[0].as_u8(), 2);
    });
    assert_eq!(sum, 2 * 10);
    //Remove all search result. Only bookmarks and selections should stay
    map.remove_range(RangeInclusive::new(0, 100), &Nature::Search);
    assert_eq!(map.len(), 19 + 10 - 10);
    // Request all
    let frame = map.frame(&mut RangeInclusive::new(0, 18)).unwrap();
    assert_eq!(frame.len(), 19);
    let sum: u64 = frame
        .indexes
        .iter()
        .map(|i| i.natures.iter().map(|n| n.as_u8() as u64).sum::<u64>())
        .sum();
    // Now we should have 9 bookmarks (+ 9 * 1) and 10 selected rows (+ 2 * 10)
    assert_eq!(sum, 9 + 10 * 2);
}

#[test]
fn test_breadcrumbs_basic() {
    let mut map = Indexes::new();
    map.set_stream_len(30);
    let search_matches = vec![0, 10, 20];
    // Add into map search matches
    map.insert(&search_matches, &Nature::Search);
    assert_eq!(map.len(), 3);
    // Insert breadcrumbs
    map.insert_breadcrumbs(4, 2).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Search),
        (1, Nature::Breadcrumb),
        (2, Nature::Breadcrumb),
        (5, Nature::BreadcrumbSeporator),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
        (20, Nature::Search),
        (21, Nature::Breadcrumb),
        (22, Nature::Breadcrumb),
        (25, Nature::BreadcrumbSeporator),
        (28, Nature::Breadcrumb),
        (29, Nature::Breadcrumb),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
    // map.indexes.iter().for_each(|(n, i)| {
    //     println!("{i:?}");
    // });
}

#[test]
fn test_breadcrumbs_borders_a() {
    let mut map = Indexes::new();
    map.set_stream_len(20);
    let search_matches = vec![10, 20];
    // Add into map search matches
    map.insert(&search_matches, &Nature::Search);
    assert_eq!(map.len(), 2);
    // Insert breadcrumbs
    map.insert_breadcrumbs(4, 2).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Breadcrumb),
        (1, Nature::Breadcrumb),
        (4, Nature::BreadcrumbSeporator),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
        (20, Nature::Search),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
}

#[test]
fn test_breadcrumbs_borders_b() {
    let mut map = Indexes::new();
    map.set_stream_len(20);
    let search_matches = vec![5, 10, 20];
    // Add into map search matches
    map.insert(&search_matches, &Nature::Search);
    assert_eq!(map.len(), 3);
    // Insert breadcrumbs
    map.insert_breadcrumbs(4, 2).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Breadcrumb),
        (1, Nature::Breadcrumb),
        (2, Nature::Breadcrumb),
        (3, Nature::Breadcrumb),
        (4, Nature::Breadcrumb),
        (5, Nature::Search),
        (6, Nature::Breadcrumb),
        (7, Nature::Breadcrumb),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
        (20, Nature::Search),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
}

#[test]
fn test_breadcrumbs_borders_c() {
    let mut map = Indexes::new();
    map.set_stream_len(25);
    let search_matches = vec![5, 10, 20];
    // Add into map search matches
    map.insert(&search_matches, &Nature::Search);
    assert_eq!(map.len(), 3);
    // Insert breadcrumbs
    map.insert_breadcrumbs(4, 2).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Breadcrumb),
        (1, Nature::Breadcrumb),
        (2, Nature::Breadcrumb),
        (3, Nature::Breadcrumb),
        (4, Nature::Breadcrumb),
        (5, Nature::Search),
        (6, Nature::Breadcrumb),
        (7, Nature::Breadcrumb),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
        (20, Nature::Search),
        (21, Nature::Breadcrumb),
        (22, Nature::Breadcrumb),
        (23, Nature::Breadcrumb),
        (24, Nature::Breadcrumb),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
}

#[test]
fn test_breadcrumbs_borders_d() {
    let mut map = Indexes::new();
    map.set_stream_len(22);
    let search_matches = vec![1, 10, 20];
    // Add into map search matches
    map.insert(&search_matches, &Nature::Search);
    assert_eq!(map.len(), 3);
    // Insert breadcrumbs
    map.insert_breadcrumbs(4, 2).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Breadcrumb),
        (1, Nature::Search),
        (2, Nature::Breadcrumb),
        (3, Nature::Breadcrumb),
        (5, Nature::BreadcrumbSeporator),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
        (20, Nature::Search),
        (21, Nature::Breadcrumb),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
}

#[test]
fn test_breadcrumbs_borders_e() {
    let mut map = Indexes::new();
    map.set_stream_len(21);
    let search_matches = vec![0, 10, 20];
    // Add into map search matches
    map.insert(&search_matches, &Nature::Search);
    assert_eq!(map.len(), 3);
    // Insert breadcrumbs
    map.insert_breadcrumbs(4, 2).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Search),
        (1, Nature::Breadcrumb),
        (2, Nature::Breadcrumb),
        (5, Nature::BreadcrumbSeporator),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
        (20, Nature::Search),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
}

#[test]
fn test_breadcrumbs_borders_f() {
    let mut map = Indexes::new();
    map.set_stream_len(20);
    let search_matches = vec![10];
    // Add into map search matches
    map.insert(&search_matches, &Nature::Search);
    assert_eq!(map.len(), 1);
    // Insert breadcrumbs
    map.insert_breadcrumbs(4, 2).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Breadcrumb),
        (1, Nature::Breadcrumb),
        (4, Nature::BreadcrumbSeporator),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
}

#[test]
fn test_breadcrumbs_borders_g() {
    let mut map = Indexes::new();
    map.set_stream_len(20);
    let search_matches = vec![];
    // Add into map search matches
    map.insert(&search_matches, &Nature::Search);
    assert_eq!(map.len(), 0);
    // Insert breadcrumbs
    map.insert_breadcrumbs(4, 2).unwrap();
    assert_eq!(map.len(), 0);
}
