use crate::*;

impl Arbitrary for SerialPortsList {
    /// Implements the `Arbitrary` trait for `SerialPortsList` to generate random instances
    /// for property-based testing using the `proptest` framework.
    ///
    /// # Details
    /// - Generates a vector of up to 10 random `String` values, where each string represents
    ///   the name or identifier of a serial port.
    /// - Wraps the generated vector into a `SerialPortsList`.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(any::<String>(), 0..10)
            .prop_map(SerialPortsList)
            .boxed()
    }
}

test_msg!(SerialPortsList, TESTS_USECASE_COUNT);
