use crate::*;

impl Arbitrary for SerialPortsList {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(any::<String>(), 0..10)
            .prop_map(SerialPortsList)
            .boxed()
    }
}
