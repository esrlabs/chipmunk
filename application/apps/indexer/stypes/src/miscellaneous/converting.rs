use crate::*;
use std::ops::RangeInclusive;

impl From<Vec<GrabbedElement>> for GrabbedElementList {
    fn from(els: Vec<GrabbedElement>) -> Self {
        Self(els)
    }
}

impl From<Vec<SourceDefinition>> for Sources {
    fn from(els: Vec<SourceDefinition>) -> Self {
        Self(els)
    }
}

impl From<(Option<u64>, Option<u64>)> for AroundIndexes {
    fn from(value: (Option<u64>, Option<u64>)) -> Self {
        Self(value)
    }
}

impl From<Vec<RangeInclusive<u64>>> for Ranges {
    fn from(value: Vec<RangeInclusive<u64>>) -> Self {
        Self(value)
    }
}
