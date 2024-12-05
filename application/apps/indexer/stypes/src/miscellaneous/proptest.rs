use crate::*;

impl Arbitrary for Ranges {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(
            (0u32.., 0u32..).prop_map(|(start, end)| start as u64..=end as u64),
            0..10,
        )
        .prop_map(Ranges)
        .boxed()
    }
}

impl Arbitrary for SourceDefinition {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (any::<u16>(), any::<String>())
            .prop_map(|(id, alias)| SourceDefinition { id, alias })
            .boxed()
    }
}

impl Arbitrary for Sources {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(any::<SourceDefinition>(), 0..10)
            .prop_map(Sources)
            .boxed()
    }
}

impl Arbitrary for SdeRequest {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            any::<String>().prop_map(SdeRequest::WriteText),
            prop::collection::vec(any::<u8>(), 0..100).prop_map(SdeRequest::WriteBytes),
        ]
        .boxed()
    }
}

impl Arbitrary for SdeResponse {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        any::<u32>()
            .prop_map(|n| n as usize)
            .prop_map(|bytes| SdeResponse { bytes })
            .boxed()
    }
}

impl Arbitrary for GrabbedElement {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (any::<u16>(), any::<String>(), rnd_usize(), any::<u8>())
            .prop_map(|(source_id, content, pos, nature)| GrabbedElement {
                source_id,
                content,
                pos,
                nature,
            })
            .boxed()
    }
}

impl Arbitrary for GrabbedElementList {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(any::<GrabbedElement>(), 0..10)
            .prop_map(GrabbedElementList)
            .boxed()
    }
}

impl Arbitrary for AroundIndexes {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (any::<Option<u32>>(), any::<Option<u32>>())
            .prop_map(|(start, end)| {
                AroundIndexes((start.map(|n| n as u64), end.map(|n| n as u64)))
            })
            .boxed()
    }
}

impl Arbitrary for FilterMatch {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (rnd_u64(), prop::collection::vec(any::<u8>(), 0..10))
            .prop_map(|(index, filters)| FilterMatch { index, filters })
            .boxed()
    }
}

impl Arbitrary for FilterMatchList {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(any::<FilterMatch>(), 0..10)
            .prop_map(FilterMatchList)
            .boxed()
    }
}

test_msg!(Ranges, TESTS_USECASE_COUNT);
test_msg!(SourceDefinition, TESTS_USECASE_COUNT);
test_msg!(Sources, TESTS_USECASE_COUNT);
test_msg!(SdeRequest, TESTS_USECASE_COUNT);
test_msg!(SdeResponse, TESTS_USECASE_COUNT);
test_msg!(GrabbedElement, TESTS_USECASE_COUNT);
test_msg!(GrabbedElementList, TESTS_USECASE_COUNT);
test_msg!(AroundIndexes, TESTS_USECASE_COUNT);
test_msg!(FilterMatch, TESTS_USECASE_COUNT);
test_msg!(FilterMatchList, TESTS_USECASE_COUNT);
