use crate::*;
use uuid::Uuid;

impl Arbitrary for OperationDone {
    /// Implements the `Arbitrary` trait for `OperationDone` to generate random instances
    /// for property-based testing using the `proptest` framework.
    ///
    /// # Details
    /// - Randomly generates a `Uuid` for the `uuid` field.
    /// - Optionally generates a random `String` for the `result` field.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (Just(Uuid::new_v4()), any::<Option<Vec<u8>>>())
            .prop_map(|(uuid, result)| OperationDone { uuid, result })
            .boxed()
    }
}

impl Arbitrary for CallbackEvent {
    /// Implements the `Arbitrary` trait for `CallbackEvent` to generate random instances
    /// for property-based testing using the `proptest` framework.
    ///
    /// # Details
    /// This implementation supports the generation of all variants of `CallbackEvent`,
    /// including:
    /// - `StreamUpdated` with a random `u64` value.
    /// - `FileRead` as a predefined constant.
    /// - `SearchUpdated` with random values for `found` and a map of search conditions.
    /// - `IndexedMapUpdated` with a random `u64` length.
    /// - `SearchMapUpdated` with an optional `FilterMatchList`.
    /// - `SearchValuesUpdated` with a map of random values, converting `f32` to `f64`.
    /// - `AttachmentsUpdated` with random attachment information.
    /// - `Progress` with a random `Uuid` and `Progress` instance.
    /// - `SessionError` with a random `NativeError`.
    /// - `OperationError` with random `Uuid` and `NativeError`.
    /// - `OperationStarted` with a random `Uuid`.
    /// - `OperationProcessing` with a random `Uuid`.
    /// - `OperationDone` with a random `OperationDone` instance.
    /// - `SessionDestroyed` as a predefined constant.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            any::<u32>().prop_map(|n| CallbackEvent::StreamUpdated(n as u64)),
            Just(CallbackEvent::FileRead),
            (any::<u32>(), any::<HashMap<String, u32>>(),).prop_map(|(found, stat)| {
                CallbackEvent::SearchUpdated {
                    found: found as u64,
                    stat: stat.into_iter().map(|(k, v)| (k, v as u64)).collect(),
                }
            }),
            any::<u32>().prop_map(|len| CallbackEvent::IndexedMapUpdated { len: len as u64 }),
            any::<Option<FilterMatchList>>().prop_map(CallbackEvent::SearchMapUpdated),
            any::<Option<HashMap<u8, (f32, f32)>>>().prop_map(|ev| {
                CallbackEvent::SearchValuesUpdated(ev.map(|ev| {
                    ev.into_iter()
                        .map(|(k, (l, r))| (k, (l as f64, r as f64)))
                        .collect()
                }))
            }),
            (any::<u32>(), any::<AttachmentInfo>(),).prop_map(|(len, attachment)| {
                CallbackEvent::AttachmentsUpdated {
                    len: len as u64,
                    attachment,
                }
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
