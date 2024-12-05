use crate::*;
use uuid::Uuid;

impl Arbitrary for OperationDone {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (Just(Uuid::new_v4()), any::<Option<String>>())
            .prop_map(|(uuid, result)| OperationDone { uuid, result })
            .boxed()
    }
}

impl Arbitrary for CallbackEvent {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            rnd_u64().prop_map(CallbackEvent::StreamUpdated),
            Just(CallbackEvent::FileRead),
            (rnd_u64(), any::<Vec<(String, u32)>>(),).prop_map(|(found, stat)| {
                CallbackEvent::SearchUpdated {
                    found,
                    stat: stat.into_iter().map(|(k, v)| (k, v as u64)).collect(),
                }
            }),
            rnd_u64().prop_map(|len| CallbackEvent::IndexedMapUpdated { len }),
            any::<Option<FilterMatchList>>().prop_map(CallbackEvent::SearchMapUpdated),
            any::<Option<Vec<(u8, (f64, f64))>>>().prop_map(|ev| {
                CallbackEvent::SearchValuesUpdated(ev.map(|ev| ev.into_iter().collect()))
            }),
            (rnd_u64(), any::<AttachmentInfo>(),).prop_map(|(len, attachment)| {
                CallbackEvent::AttachmentsUpdated { len, attachment }
            }),
            (Just(Uuid::new_v4()), any::<Progress>(),)
                .prop_map(|(uuid, progress)| CallbackEvent::Progress { uuid, progress }),
            any::<NativeError>().prop_map(CallbackEvent::SessionError),
            (Just(Uuid::new_v4()), any::<NativeError>(),)
                .prop_map(|(uuid, error)| CallbackEvent::OperationError { uuid, error }),
            Just(Uuid::new_v4()).prop_map(CallbackEvent::OperationStarted),
            Just(Uuid::new_v4()).prop_map(CallbackEvent::OperationProcessing),
            any::<OperationDone>().prop_map(CallbackEvent::OperationDone),
            Just(CallbackEvent::SessionDestroyed),
        ]
        .boxed()
    }
}

test_msg!(OperationDone, TESTS_USECASE_COUNT);
test_msg!(CallbackEvent, TESTS_USECASE_COUNT);
