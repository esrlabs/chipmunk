use crate::*;

impl Arbitrary for Range {
    /// Implements the `Arbitrary` trait for `Ranges` to generate random values for
    /// property-based testing using the `proptest` framework.
    ///
    /// # Details
    /// - Generates a vector of random `RangeInclusive<u64>` instances, with up to 10 ranges.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (any::<u32>(), any::<u32>())
            .prop_map(|(start, end)| Range {
                start: start as u64,
                end: end as u64,
            })
            .boxed()
    }
}

impl Arbitrary for Ranges {
    /// Implements the `Arbitrary` trait for `Ranges` to generate random values for
    /// property-based testing using the `proptest` framework.
    ///
    /// # Details
    /// - Generates a vector of random `RangeInclusive<u64>` instances, with up to 10 ranges.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(Range::arbitrary(), 0..10)
            .prop_map(Ranges)
            .boxed()
    }
}

impl Arbitrary for SourceDefinition {
    /// Implements the `Arbitrary` trait for `SourceDefinition` to generate random instances.
    ///
    /// # Details
    /// - Generates random `id` (`u16`) and `alias` (`SessionDescriptor`) values.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (any::<u16>(), any::<SessionDescriptor>())
            .prop_map(|(id, descriptor)| SourceDefinition { id, descriptor })
            .boxed()
    }
}

impl Arbitrary for Sources {
    /// Implements the `Arbitrary` trait for `Sources` to generate random instances.
    ///
    /// # Details
    /// - Generates a vector of up to 10 random `SourceDefinition` instances.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(any::<SourceDefinition>(), 0..10)
            .prop_map(Sources)
            .boxed()
    }
}

impl Arbitrary for SdeRequest {
    /// Implements the `Arbitrary` trait for `SdeRequest` to generate random instances.
    ///
    /// # Details
    /// - Generates either:
    ///   - `WriteText` with a random `String`.
    ///   - `WriteBytes` with a random vector of `u8` values (up to 100 bytes).
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            any::<String>().prop_map(SdeRequest::WriteText),
            prop::collection::vec(any::<u8>(), 0..100).prop_map(SdeRequest::WriteBytes),
        ]
        .boxed()
    }
}

impl Arbitrary for SdeResponse {
    /// Implements the `Arbitrary` trait for `SdeResponse` to generate random instances.
    ///
    /// # Details
    /// - Generates a random `u32` for the `bytes` field.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        any::<u32>()
            .prop_map(|n| n as usize)
            .prop_map(|bytes| SdeResponse { bytes })
            .boxed()
    }
}

impl Arbitrary for GrabbedElement {
    /// Implements the `Arbitrary` trait for `GrabbedElement` to generate random instances.
    ///
    /// # Details
    /// - Generates:
    ///   - A random `source_id` (`u16`).
    ///   - A random `content` (`String`).
    ///   - A random `pos` (`usize`).
    ///   - A random `nature` (`u8`).
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (any::<u16>(), any::<String>(), any::<u32>(), any::<u8>())
            .prop_map(|(source_id, content, pos, nature)| GrabbedElement {
                source_id,
                content,
                pos: pos as usize,
                nature,
            })
            .boxed()
    }
}

impl Arbitrary for GrabbedElementList {
    /// Implements the `Arbitrary` trait for `GrabbedElementList` to generate random instances.
    ///
    /// # Details
    /// - Generates a vector of up to 10 random `GrabbedElement` instances.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(any::<GrabbedElement>(), 0..10)
            .prop_map(GrabbedElementList)
            .boxed()
    }
}

impl Arbitrary for AroundIndexes {
    /// Implements the `Arbitrary` trait for `AroundIndexes` to generate random instances.
    ///
    /// # Details
    /// - Generates a tuple of two optional `u32` values, mapped to `u64`.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (any::<Option<u32>>(), any::<Option<u32>>())
            .prop_map(|(start, end)| {
                AroundIndexes((start.map(|n| n as u64), end.map(|n| n as u64)))
            })
            .boxed()
    }
}

impl Arbitrary for FilterMatch {
    /// Implements the `Arbitrary` trait for `FilterMatch` to generate random instances.
    ///
    /// # Details
    /// - Generates:
    ///   - A random `index` (`u64`).
    ///   - A random vector of `u8` filter IDs (up to 10 filters).
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (any::<u32>(), prop::collection::vec(any::<u8>(), 0..10))
            .prop_map(|(index, filters)| FilterMatch {
                index: index as u64,
                filters,
            })
            .boxed()
    }
}

impl Arbitrary for FilterMatchList {
    /// Implements the `Arbitrary` trait for `FilterMatchList` to generate random instances.
    ///
    /// # Details
    /// - Generates a vector of up to 10 random `FilterMatch` instances.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(any::<FilterMatch>(), 0..10)
            .prop_map(FilterMatchList)
            .boxed()
    }
}

test_msg!(SourceDefinition, TESTS_USECASE_COUNT);
test_msg!(Sources, TESTS_USECASE_COUNT);
test_msg!(SdeRequest, TESTS_USECASE_COUNT);
test_msg!(SdeResponse, TESTS_USECASE_COUNT);
test_msg!(GrabbedElement, TESTS_USECASE_COUNT);
test_msg!(GrabbedElementList, TESTS_USECASE_COUNT);
test_msg!(AroundIndexes, TESTS_USECASE_COUNT);
test_msg!(FilterMatch, TESTS_USECASE_COUNT);
test_msg!(FilterMatchList, TESTS_USECASE_COUNT);
