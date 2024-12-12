use crate::*;
use std::ops::RangeInclusive;

impl From<(u64, f64)> for CandlePoint {
    fn from(point: (u64, f64)) -> Self {
        CandlePoint::new(point.0, point.1)
    }
}

impl From<Vec<GrabbedElement>> for GrabbedElementList {
    /// Converts a `Vec<GrabbedElement>` into a `GrabbedElementList`.
    ///
    /// # Parameters
    /// - `els`: A vector of `GrabbedElement` instances.
    ///
    /// # Returns
    /// - A `GrabbedElementList` containing the elements from the input vector.
    fn from(els: Vec<GrabbedElement>) -> Self {
        Self(els)
    }
}

impl From<Vec<SourceDefinition>> for Sources {
    /// Converts a `Vec<SourceDefinition>` into a `Sources`.
    ///
    /// # Parameters
    /// - `els`: A vector of `SourceDefinition` instances.
    ///
    /// # Returns
    /// - A `Sources` containing the elements from the input vector.
    fn from(els: Vec<SourceDefinition>) -> Self {
        Self(els)
    }
}

impl From<(Option<u64>, Option<u64>)> for AroundIndexes {
    /// Converts a tuple `(Option<u64>, Option<u64>)` into an `AroundIndexes`.
    ///
    /// # Parameters
    /// - `value`: A tuple containing two optional `u64` values.
    ///
    /// # Returns
    /// - An `AroundIndexes` instance containing the input tuple.
    fn from(value: (Option<u64>, Option<u64>)) -> Self {
        Self(value)
    }
}

impl From<RangeInclusive<u64>> for Range {
    /// Converts a `RangeInclusive<u64>` into a `Range`.
    ///
    /// # Parameters
    /// - `value`: `RangeInclusive<u64>` instance.
    ///
    /// # Returns
    /// - A `Range` instance.
    fn from(range: RangeInclusive<u64>) -> Self {
        let (start, end) = range.into_inner();
        Self { start, end }
    }
}

impl From<Vec<RangeInclusive<u64>>> for Ranges {
    /// Converts a `Vec<RangeInclusive<u64>>` into a `Ranges`.
    ///
    /// # Parameters
    /// - `value`: A vector of `RangeInclusive<u64>` instances.
    ///
    /// # Returns
    /// - A `Ranges` instance containing the input ranges.
    fn from(value: Vec<RangeInclusive<u64>>) -> Self {
        Self(value.into_iter().map(|r| r.into()).collect())
    }
}

impl From<&Vec<FilterMatch>> for FilterMatchList {
    /// Converts a `&Vec<FilterMatch>` into a `FilterMatchList`.
    ///
    /// # Parameters
    /// - `value`: A reference to a vector of `FilterMatch` instances.
    ///
    /// # Returns
    /// - A `FilterMatchList` containing a copy of the elements in the input vector.
    fn from(value: &Vec<FilterMatch>) -> Self {
        FilterMatchList(value.to_vec())
    }
}
