use crate::*;
use uuid::Uuid;

impl Arbitrary for LifecycleTransition {
    /// Implements the `Arbitrary` trait for `LifecycleTransition` to generate random values
    /// for property-based testing using the `proptest` framework.
    ///
    /// # Details
    /// - Randomly generates one of the `LifecycleTransition` variants:
    ///   - `Started`: Generates a random `Uuid` and a random alias (`String`).
    ///   - `Ticks`: Generates a random `Uuid` and a random `Ticks` value.
    ///   - `Stopped`: Generates a random `Uuid`.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            (Just(Uuid::new_v4()), any::<String>())
                .prop_map(|(uuid, alias)| LifecycleTransition::Started { uuid, alias }),
            (Just(Uuid::new_v4()), any::<Ticks>())
                .prop_map(|(uuid, ticks)| LifecycleTransition::Ticks { uuid, ticks }),
            Just(Uuid::new_v4()).prop_map(LifecycleTransition::Stopped),
        ]
        .boxed()
    }
}

test_msg!(LifecycleTransition, TESTS_USECASE_COUNT);
