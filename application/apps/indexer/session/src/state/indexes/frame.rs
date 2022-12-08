use super::index::Index;
use crate::{
    events::{NativeError, NativeErrorKind},
    state::GrabbedElement,
};
use indexer_base::progress::Severity;
use std::ops::RangeInclusive;

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
