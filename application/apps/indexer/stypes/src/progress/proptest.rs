use crate::*;

impl Arbitrary for Notification {
    /// Implements the `Arbitrary` trait for `Notification` to generate random instances
    /// for property-based testing using the `proptest` framework.
    ///
    /// # Details
    /// - Generates:
    ///   - `severity`: A random `Severity` value.
    ///   - `content`: A random `String`.
    ///   - `line`: An optional random `usize` value.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (any::<Severity>(), any::<String>(), any::<Option<u32>>())
            .prop_map(|(severity, content, line)| Notification {
                severity,
                content,
                line: line.map(|n| n as usize),
            })
            .boxed()
    }
}

impl Arbitrary for Ticks {
    /// Implements the `Arbitrary` trait for `Ticks` to generate random instances
    /// for property-based testing using the `proptest` framework.
    ///
    /// # Details
    /// - Generates:
    ///   - `count`: A random `u64` value.
    ///   - `state`: An optional random `String`.
    ///   - `total`: An optional random `u64` value.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (any::<u32>(), any::<Option<String>>(), any::<Option<u32>>())
            .prop_map(|(count, state, total)| Ticks {
                count: count as u64,
                state,
                total: total.map(|n| n as u64),
            })
            .boxed()
    }
}

impl Arbitrary for Progress {
    /// Implements the `Arbitrary` trait for `Progress` to generate random instances
    /// for property-based testing using the `proptest` framework.
    ///
    /// # Details
    /// - Randomly generates one of the following variants:
    ///   - `Ticks` with a random `Ticks` value.
    ///   - `Notification` with a random `Notification` value.
    ///   - `Stopped` as a constant value.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            any::<Ticks>().prop_map(Progress::Ticks),
            any::<Notification>().prop_map(Progress::Notification),
            Just(Progress::Stopped),
        ]
        .boxed()
    }
}

test_msg!(Progress, TESTS_USECASE_COUNT);
