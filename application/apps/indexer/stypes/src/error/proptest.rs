use crate::*;
// Arbitrary implementations for Severity, NativeErrorKind, NativeError, and ComputationError.

impl Arbitrary for Severity {
    /// Implements the `Arbitrary` trait for `Severity` to generate random values
    /// for property-based testing using the `proptest` framework.
    ///
    /// # Details
    /// - Generates random variants of `Severity`:
    ///   - `Severity::WARNING`
    ///   - `Severity::ERROR`
    type Parameters = ();

    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![Just(Severity::WARNING), Just(Severity::ERROR)].boxed()
    }
}

impl Arbitrary for NativeErrorKind {
    /// Implements the `Arbitrary` trait for `NativeErrorKind` to generate random values
    /// for property-based testing using the `proptest` framework.
    ///
    /// # Details
    /// - Generates random variants of `NativeErrorKind`, including:
    ///   - `FileNotFound`
    ///   - `UnsupportedFileType`
    ///   - `ComputationFailed`
    ///   - `Configuration`
    ///   - `Interrupted`
    ///   - `OperationSearch`
    ///   - `NotYetImplemented`
    ///   - `ChannelError`
    ///   - `Io`
    ///   - `Grabber`
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
    /// Implements the `Arbitrary` trait for `NativeError` to generate random values
    /// for property-based testing using the `proptest` framework.
    ///
    /// # Details
    /// - Generates:
    ///   - A random `Severity` value.
    ///   - A random `NativeErrorKind` value.
    ///   - An optional random `String` for the message.
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
    /// Implements the `Arbitrary` trait for `ComputationError` to generate random values
    /// for property-based testing using the `proptest` framework.
    ///
    /// # Details
    /// - Generates random variants of `ComputationError`, including:
    ///   - Fixed errors such as `DestinationPath`, `SessionCreatingFail`, etc.
    ///   - Errors with random `String` values for fields like `Communication`, `IoOperation`, etc.
    ///   - Nested errors, such as `NativeError`.
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
