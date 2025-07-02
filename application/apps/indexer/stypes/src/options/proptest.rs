use crate::*;

impl Arbitrary for IODataType {
    type Parameters = bool;
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(nested: Self::Parameters) -> Self::Strategy {
        if !nested {
            prop_oneof![
                Just(IODataType::Raw),
                Just(IODataType::PlaitText),
                Just(IODataType::NetworkFramePayload),
                IODataType::arbitrary_with(true)
                    .prop_map(|inner| IODataType::Multiple(vec![inner]))
            ]
            .boxed()
        } else {
            prop_oneof![
                Just(IODataType::Raw),
                Just(IODataType::PlaitText),
                Just(IODataType::NetworkFramePayload),
            ]
            .boxed()
        }
    }
}
