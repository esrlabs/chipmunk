use crate::*;
use uuid::Uuid;

impl Arbitrary for LifecycleTransition {
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
