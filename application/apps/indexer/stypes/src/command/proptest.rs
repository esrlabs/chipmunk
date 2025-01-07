use crate::*;

impl Arbitrary for CommandOutcome<String> {
    /// Implements the `Arbitrary` trait for `CommandOutcome<String>` to generate random instances
    /// for property-based testing using the `proptest` framework.
    ///
    /// # Details
    /// - Generates either:
    ///   - `CommandOutcome::Finished` with a random `String`.
    ///   - `CommandOutcome::Cancelled`.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            any::<String>().prop_map(CommandOutcome::Finished),
            Just(CommandOutcome::Cancelled),
        ]
        .boxed()
    }
}

impl Arbitrary for CommandOutcome<FoldersScanningResult> {
    /// Implements the `Arbitrary` trait for `CommandOutcome<FoldersScanningResult>` to generate random instances.
    ///
    /// # Details
    /// - Generates either:
    ///   - `CommandOutcome::Finished` with a random `FoldersScanningResult`.
    ///   - `CommandOutcome::Cancelled`.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            any::<FoldersScanningResult>().prop_map(CommandOutcome::Finished),
            Just(CommandOutcome::Cancelled),
        ]
        .boxed()
    }
}

impl Arbitrary for CommandOutcome<SerialPortsList> {
    /// Implements the `Arbitrary` trait for `CommandOutcome<SerialPortsList>` to generate random instances.
    ///
    /// # Details
    /// - Generates either:
    ///   - `CommandOutcome::Finished` with a random `SerialPortsList`.
    ///   - `CommandOutcome::Cancelled`.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            any::<SerialPortsList>().prop_map(CommandOutcome::Finished),
            Just(CommandOutcome::Cancelled),
        ]
        .boxed()
    }
}

impl Arbitrary for CommandOutcome<ProfileList> {
    /// Implements the `Arbitrary` trait for `CommandOutcome<ProfileList>` to generate random instances.
    ///
    /// # Details
    /// - Generates either:
    ///   - `CommandOutcome::Finished` with a random `ProfileList`.
    ///   - `CommandOutcome::Cancelled`.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            any::<ProfileList>().prop_map(CommandOutcome::Finished),
            Just(CommandOutcome::Cancelled),
        ]
        .boxed()
    }
}

impl Arbitrary for CommandOutcome<DltStatisticInfo> {
    /// Implements the `Arbitrary` trait for `CommandOutcome<DltStatisticInfo>` to generate random instances.
    ///
    /// # Details
    /// - Generates either:
    ///   - `CommandOutcome::Finished` with a random `DltStatisticInfo`.
    ///   - `CommandOutcome::Cancelled`.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            any::<DltStatisticInfo>().prop_map(CommandOutcome::Finished),
            Just(CommandOutcome::Cancelled),
        ]
        .boxed()
    }
}
impl Arbitrary for CommandOutcome<()> {
    /// Implements the `Arbitrary` trait for `CommandOutcome<()>` to generate random instances.
    ///
    /// # Details
    /// - Generates either:
    ///   - `CommandOutcome::Finished` with `()`.
    ///   - `CommandOutcome::Cancelled`.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            Just(()).prop_map(CommandOutcome::Finished),
            Just(CommandOutcome::Cancelled),
        ]
        .boxed()
    }
}

impl Arbitrary for CommandOutcome<i64> {
    /// Implements the `Arbitrary` trait for `CommandOutcome<i64>` to generate random instances.
    ///
    /// # Details
    /// - Generates either:
    ///   - `CommandOutcome::Finished` with a random `i64` value converted from `i32`.
    ///   - `CommandOutcome::Cancelled`.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            any::<i32>().prop_map(|v| CommandOutcome::Finished(v as i64)),
            Just(CommandOutcome::Cancelled),
        ]
        .boxed()
    }
}

impl Arbitrary for CommandOutcome<Option<String>> {
    /// Implements the `Arbitrary` trait for `CommandOutcome<Option<String>>` to generate random instances.
    ///
    /// # Details
    /// - Generates either:
    ///   - `CommandOutcome::Finished` with a random `Option<String>`.
    ///   - `CommandOutcome::Cancelled`.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            any::<Option<String>>().prop_map(CommandOutcome::Finished),
            Just(CommandOutcome::Cancelled),
        ]
        .boxed()
    }
}

impl Arbitrary for CommandOutcome<bool> {
    /// Implements the `Arbitrary` trait for `CommandOutcome<bool>` to generate random instances.
    ///
    /// # Details
    /// - Generates either:
    ///   - `CommandOutcome::Finished` with a random `bool`.
    ///   - `CommandOutcome::Cancelled`.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            any::<bool>().prop_map(CommandOutcome::Finished),
            Just(CommandOutcome::Cancelled),
        ]
        .boxed()
    }
}

test_msg!(CommandOutcome<()>, TESTS_USECASE_COUNT);
test_msg!(CommandOutcome<bool>, TESTS_USECASE_COUNT);
test_msg!(CommandOutcome<Option<String>>, TESTS_USECASE_COUNT);
test_msg!(CommandOutcome<i64>, TESTS_USECASE_COUNT);
test_msg!(CommandOutcome<SerialPortsList>, TESTS_USECASE_COUNT);
test_msg!(CommandOutcome<String>, TESTS_USECASE_COUNT);
test_msg!(CommandOutcome<FoldersScanningResult>, TESTS_USECASE_COUNT);
test_msg!(CommandOutcome<DltStatisticInfo>, TESTS_USECASE_COUNT);
test_msg!(CommandOutcome<ProfileList>, TESTS_USECASE_COUNT);
