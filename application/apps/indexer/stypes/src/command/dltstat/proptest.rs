use crate::*;

impl Arbitrary for DltLevelDistribution {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            any::<u32>(),
            any::<u32>(),
            any::<u32>(),
            any::<u32>(),
            any::<u32>(),
            any::<u32>(),
            any::<u32>(),
            any::<u32>(),
        )
            .prop_map(
                |(
                    non_log,
                    log_fatal,
                    log_error,
                    log_warning,
                    log_info,
                    log_debug,
                    log_verbose,
                    log_invalid,
                )| DltLevelDistribution {
                    non_log: non_log as usize,
                    log_fatal: log_fatal as usize,
                    log_error: log_error as usize,
                    log_warning: log_warning as usize,
                    log_info: log_info as usize,
                    log_debug: log_debug as usize,
                    log_verbose: log_verbose as usize,
                    log_invalid: log_invalid as usize,
                },
            )
            .boxed()
    }
}

impl Arbitrary for DltStatisticInfo {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            prop::collection::vec(any::<(String, DltLevelDistribution)>(), 0..10),
            prop::collection::vec(any::<(String, DltLevelDistribution)>(), 0..10),
            prop::collection::vec(any::<(String, DltLevelDistribution)>(), 0..10),
            any::<bool>(),
        )
            .prop_map(
                |(app_ids, context_ids, ecu_ids, contained_non_verbose)| DltStatisticInfo {
                    contained_non_verbose,
                    context_ids,
                    app_ids,
                    ecu_ids,
                },
            )
            .boxed()
    }
}

test_msg!(DltLevelDistribution, TESTS_USECASE_COUNT);
test_msg!(DltStatisticInfo, TESTS_USECASE_COUNT);
