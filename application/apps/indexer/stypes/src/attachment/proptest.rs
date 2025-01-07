use crate::*;
use std::path::PathBuf;
use uuid::Uuid;

/// Implements the `Arbitrary` trait for `AttachmentInfo` to generate random instances
/// for property-based testing using the `proptest` framework.
///
/// # Details
/// - This implementation generates random values for all fields of `AttachmentInfo`,
///   including:
///   - A randomly generated `Uuid`.
///   - A random `PathBuf` for the file path.
///   - A random `String` for the file name.
///   - An optional random file extension (`Option<String>`).
///   - A random file size (`u32`, converted to `usize`).
///   - An optional random MIME type (`Option<String>`).
///   - A vector of random log entry indices (`Vec<u32>`, converted to `Vec<usize>`).
impl Arbitrary for AttachmentInfo {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            Just(Uuid::new_v4()),
            any::<PathBuf>(),
            any::<String>(),
            any::<Option<String>>(),
            any::<u32>(),
            any::<Option<String>>(),
            prop::collection::vec(any::<u32>(), 0..10),
        )
            .prop_map(
                |(uuid, filepath, name, ext, size, mime, messages)| AttachmentInfo {
                    uuid,
                    filepath,
                    name,
                    ext,
                    size: size as usize,
                    mime,
                    messages: messages.into_iter().map(|p| p as usize).collect(),
                },
            )
            .boxed()
    }
}

/// Implements the `Arbitrary` trait for `AttachmentList` to generate random instances
/// for property-based testing using the `proptest` framework.
///
/// # Details
/// - This implementation generates a vector of random `AttachmentInfo` objects with
///   up to 10 elements, which is then wrapped into an `AttachmentList`.
impl Arbitrary for AttachmentList {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(any::<AttachmentInfo>(), 0..10)
            .prop_map(AttachmentList)
            .boxed()
    }
}

test_msg!(AttachmentInfo, TESTS_USECASE_COUNT);
test_msg!(AttachmentList, TESTS_USECASE_COUNT);
