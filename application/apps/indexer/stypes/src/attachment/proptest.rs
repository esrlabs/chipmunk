use crate::*;
use std::path::PathBuf;
use uuid::Uuid;

impl Arbitrary for AttachmentInfo {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            Just(Uuid::new_v4()),
            any::<PathBuf>(),
            any::<String>(),
            any::<Option<String>>(),
            any::<usize>(),
            any::<Option<String>>(),
            prop::collection::vec(any::<usize>(), 0..10),
        )
            .prop_map(
                |(uuid, filepath, name, ext, size, mime, messages)| AttachmentInfo {
                    uuid,
                    filepath,
                    name,
                    ext,
                    size,
                    mime,
                    messages,
                },
            )
            .boxed()
    }
}

impl Arbitrary for AttachmentList {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(any::<AttachmentInfo>(), 0..10)
            .prop_map(AttachmentList)
            .boxed()
    }
}
