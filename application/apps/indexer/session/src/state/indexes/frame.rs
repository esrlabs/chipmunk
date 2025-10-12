use super::nature::Nature;
use std::ops::RangeInclusive;

/// Represents a (vertical) frame search results view containing the indices
/// of the lines and their nature (kind).
#[derive(Debug, Default)]
pub struct Frame {
    pub indexes: Vec<(u64, Nature)>,
}

impl Frame {
    pub fn new() -> Self {
        Self { indexes: vec![] }
    }

    pub fn insert(&mut self, index: (u64, Nature)) {
        self.indexes.push(index);
    }

    pub fn set(&mut self, indexes: Vec<(u64, Nature)>) {
        self.indexes = indexes;
    }

    pub fn len(&self) -> usize {
        self.indexes.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn ranges(&self) -> Vec<RangeInclusive<u64>> {
        let mut ranges = vec![];
        let mut from_pos: u64 = 0;
        let mut to_pos: u64 = 0;
        for (i, (position, _)) in self.indexes.iter().enumerate() {
            if i == 0 {
                from_pos = *position;
            } else if to_pos + 1 != *position {
                ranges.push(RangeInclusive::new(from_pos, to_pos));
                from_pos = *position;
            }
            to_pos = *position;
        }
        if (!ranges.is_empty() && ranges[ranges.len() - 1].start() != &from_pos)
            || (ranges.is_empty() && !self.indexes.is_empty())
        {
            ranges.push(RangeInclusive::new(from_pos, to_pos));
        }
        ranges
    }

    /// Sets the nature of each element of the provided elements to the nature
    /// of their matching indices.
    /// This function will error if the length of the provided elements and doesn't
    /// match the length of the indices.
    pub fn set_elements_nature(
        &self,
        elements: &mut [stypes::GrabbedElement],
    ) -> Result<(), stypes::NativeError> {
        if elements.len() != self.indexes.len() {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Grabber,
                message: Some(format!(
                    "Fail to naturalize range. Indexes len: {}; elements len: {}.",
                    self.indexes.len(),
                    elements.len()
                )),
            });
        }
        elements.iter_mut().enumerate().for_each(|(i, el)| {
            el.set_nature(self.indexes[i].1.bits());
        });
        Ok(())
    }
}
