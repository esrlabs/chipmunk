use crate::*;
// use proptest::string::string_regex;
// string_regex(".{0,255}").unwrap()
impl Arbitrary for Severity {
    type Parameters = ();

    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![Just(Severity::WARNING), Just(Severity::ERROR)].boxed()
    }
}

impl Arbitrary for NativeErrorKind {
    type Parameters = ();

    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            Just(NativeErrorKind::FileNotFound),
            Just(NativeErrorKind::UnsupportedFileType),
            Just(NativeErrorKind::ComputationFailed),
            Just(NativeErrorKind::Configuration),
            Just(NativeErrorKind::Interrupted),
            Just(NativeErrorKind::OperationSearch),
            Just(NativeErrorKind::NotYetImplemented),
            Just(NativeErrorKind::ChannelError),
            Just(NativeErrorKind::Io),
            Just(NativeErrorKind::Grabber)
        ]
        .boxed()
    }
}

impl Arbitrary for NativeError {
    type Parameters = ();

    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            Severity::arbitrary().boxed(),
            NativeErrorKind::arbitrary().boxed(),
            prop::option::of(any::<String>()),
        )
            .prop_map(|(severity, kind, message)| NativeError {
                severity,
                kind,
                message,
            })
            .boxed()
    }
}

impl Arbitrary for ComputationError {
    type Parameters = ();

    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            Just(ComputationError::DestinationPath),
            Just(ComputationError::SessionCreatingFail),
            any::<String>().prop_map(ComputationError::Communication),
            any::<String>().prop_map(ComputationError::OperationNotSupported),
            any::<String>().prop_map(ComputationError::IoOperation),
            Just(ComputationError::InvalidData),
            any::<String>().prop_map(ComputationError::InvalidArgs),
            any::<String>().prop_map(ComputationError::Process),
            any::<String>().prop_map(ComputationError::Protocol),
            any::<String>().prop_map(ComputationError::SearchError),
            Just(ComputationError::MultipleInitCall),
            Just(ComputationError::SessionUnavailable),
            NativeError::arbitrary().prop_map(ComputationError::NativeError),
            any::<String>().prop_map(ComputationError::Grabbing),
            any::<String>().prop_map(ComputationError::Sde),
            any::<String>().prop_map(ComputationError::Decoding),
            any::<String>().prop_map(ComputationError::Encoding),
        ]
        .boxed()
    }
}

test_msg!(Severity, TESTS_USECASE_COUNT);
test_msg!(NativeErrorKind, TESTS_USECASE_COUNT);
test_msg!(NativeError, TESTS_USECASE_COUNT);
test_msg!(ComputationError, TESTS_USECASE_COUNT);
