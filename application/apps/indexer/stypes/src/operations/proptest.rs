use crate::*;

impl Arbitrary for NearestPosition {
    /// Implements the `Arbitrary` trait for `ExtractedMatchValue` to generate random values for
    /// property-based testing using the `proptest` framework.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            any::<u32>().prop_map(|n| n as u64),
            any::<u32>().prop_map(|n| n as u64),
        )
            .prop_map(|(index, position)| NearestPosition { index, position })
            .boxed()
    }
}

impl Arbitrary for ResultNearestPosition {
    /// Implements the `Arbitrary` trait for `ExtractedMatchValue` to generate random values for
    /// property-based testing using the `proptest` framework.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::option::of(NearestPosition::arbitrary())
            .prop_map(ResultNearestPosition)
            .boxed()
    }
}

impl Arbitrary for Point {
    /// Implements the `Arbitrary` trait for `ExtractedMatchValue` to generate random values for
    /// property-based testing using the `proptest` framework.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            any::<u32>().prop_map(|n| n as u64),
            any::<f32>().prop_map(|n| n as f64),
            any::<f32>().prop_map(|n| n as f64),
            any::<f32>().prop_map(|n| n as f64),
        )
            .prop_map(|(row, min, max, y_value)| Point {
                row,
                min,
                max,
                y_value,
            })
            .boxed()
    }
}

impl Arbitrary for ResultSearchValues {
    /// Implements the `Arbitrary` trait for `ExtractedMatchValue` to generate random values for
    /// property-based testing using the `proptest` framework.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        any::<HashMap<u8, Vec<Point>>>()
            .prop_map(ResultSearchValues)
            .boxed()
    }
}

impl Arbitrary for ResultScaledDistribution {
    /// Implements the `Arbitrary` trait for `ExtractedMatchValue` to generate random values for
    /// property-based testing using the `proptest` framework.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(
            prop::collection::vec((any::<u8>(), any::<u16>()), 0..10),
            0..10,
        )
        .prop_map(ResultScaledDistribution)
        .boxed()
    }
}

impl Arbitrary for ExtractedMatchValue {
    /// Implements the `Arbitrary` trait for `ExtractedMatchValue` to generate random values for
    /// property-based testing using the `proptest` framework.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            any::<u32>().prop_map(|n| n as u64),
            prop::collection::vec(
                (
                    any::<u32>().prop_map(|n| n as usize),
                    prop::collection::vec(any::<String>(), 0..10),
                ),
                0..10,
            ),
        )
            .prop_map(|(index, values)| ExtractedMatchValue { index, values })
            .boxed()
    }
}

impl Arbitrary for ResultExtractedMatchValues {
    /// Implements the `Arbitrary` trait for `ResultExtractedMatchValues` to generate random values for
    /// property-based testing using the `proptest` framework.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(ExtractedMatchValue::arbitrary(), 0..10)
            .prop_map(ResultExtractedMatchValues)
            .boxed()
    }
}

impl Arbitrary for ResultU64 {
    /// Implements the `Arbitrary` trait for `ResultU64` to generate random values for
    /// property-based testing using the `proptest` framework.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        any::<u32>()
            .prop_map(|n| n as u64)
            .prop_map(ResultU64)
            .boxed()
    }
}

impl Arbitrary for ResultBool {
    /// Implements the `Arbitrary` trait for `ResultBool` to generate random values for
    /// property-based testing using the `proptest` framework.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        any::<bool>().prop_map(ResultBool).boxed()
    }
}

impl Arbitrary for ResultSleep {
    /// Implements the `Arbitrary` trait for `ResultBool` to generate random values for
    /// property-based testing using the `proptest` framework.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        any::<bool>()
            .prop_map(|sleep_well| ResultSleep { sleep_well })
            .boxed()
    }
}

test_msg!(NearestPosition, TESTS_USECASE_COUNT);
test_msg!(ResultNearestPosition, TESTS_USECASE_COUNT);
test_msg!(Point, TESTS_USECASE_COUNT);
test_msg!(ResultSearchValues, TESTS_USECASE_COUNT);
test_msg!(ResultScaledDistribution, TESTS_USECASE_COUNT);
test_msg!(ExtractedMatchValue, TESTS_USECASE_COUNT);
test_msg!(ResultExtractedMatchValues, TESTS_USECASE_COUNT);
test_msg!(ResultU64, TESTS_USECASE_COUNT);
test_msg!(ResultBool, TESTS_USECASE_COUNT);
test_msg!(ResultSleep, TESTS_USECASE_COUNT);
