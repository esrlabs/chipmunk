use crate::*;

impl Arbitrary for Notification {
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
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (rnd_u64(), any::<Option<String>>(), any::<Option<u32>>())
            .prop_map(|(count, state, total)| Ticks {
                count,
                state,
                total: total.map(|n| n as u64),
            })
            .boxed()
    }
}

impl Arbitrary for Progress {
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
