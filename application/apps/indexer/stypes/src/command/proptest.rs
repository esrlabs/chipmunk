use crate::*;

impl Arbitrary for CommandOutcome<String> {
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

impl Arbitrary for CommandOutcome<()> {
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
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            any::<i64>().prop_map(CommandOutcome::Finished),
            Just(CommandOutcome::Cancelled),
        ]
        .boxed()
    }
}

impl Arbitrary for CommandOutcome<Option<String>> {
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
