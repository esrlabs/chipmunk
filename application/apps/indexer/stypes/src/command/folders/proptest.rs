use crate::*;

impl Arbitrary for FolderEntityType {
    /// Implements the `Arbitrary` trait for `FolderEntityType` to generate random variants
    /// for property-based testing using the `proptest` framework.
    ///
    /// # Details
    /// This implementation generates random variants of `FolderEntityType`, including:
    /// - `BlockDevice`
    /// - `CharacterDevice`
    /// - `Directory`
    /// - `FIFO`
    /// - `File`
    /// - `Socket`
    /// - `SymbolicLink`
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            Just(FolderEntityType::BlockDevice),
            Just(FolderEntityType::CharacterDevice),
            Just(FolderEntityType::Directory),
            Just(FolderEntityType::FIFO),
            Just(FolderEntityType::File),
            Just(FolderEntityType::Socket),
            Just(FolderEntityType::SymbolicLink),
        ]
        .boxed()
    }
}

impl Arbitrary for FolderEntityDetails {
    /// Implements the `Arbitrary` trait for `FolderEntityDetails` to generate random instances
    /// for property-based testing using the `proptest` framework.
    ///
    /// # Details
    /// Generates random values for all fields:
    /// - `filename`: A random `String`.
    /// - `full`: A random `String`.
    /// - `path`: A random `String`.
    /// - `basename`: A random `String`.
    /// - `ext`: A random `String`.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            any::<String>(),
            any::<String>(),
            any::<String>(),
            any::<String>(),
            any::<String>(),
        )
            .prop_map(
                |(filename, full, path, basename, ext)| FolderEntityDetails {
                    filename,
                    full,
                    path,
                    basename,
                    ext,
                },
            )
            .boxed()
    }
}

impl Arbitrary for FolderEntity {
    /// Implements the `Arbitrary` trait for `FolderEntity` to generate random instances
    /// for property-based testing using the `proptest` framework.
    ///
    /// # Details
    /// Generates random values for all fields:
    /// - `name`: A random `String`.
    /// - `fullname`: A random `String`.
    /// - `kind`: A random `FolderEntityType`.
    /// - `details`: An optional random `FolderEntityDetails`.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            any::<String>(),
            any::<String>(),
            any::<FolderEntityType>(),
            any::<Option<FolderEntityDetails>>(),
        )
            .prop_map(|(name, fullname, kind, details)| FolderEntity {
                name,
                fullname,
                kind,
                details,
            })
            .boxed()
    }
}

impl Arbitrary for FoldersScanningResult {
    /// Implements the `Arbitrary` trait for `FoldersScanningResult` to generate random instances
    /// for property-based testing using the `proptest` framework.
    ///
    /// # Details
    /// - Generates a random list of up to 10 `FolderEntity` instances.
    /// - Generates a random `bool` to indicate whether the maximum length was reached.
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            prop::collection::vec(any::<FolderEntity>(), 0..10),
            any::<bool>(),
        )
            .prop_map(|(list, max_len_reached)| FoldersScanningResult {
                list,
                max_len_reached,
            })
            .boxed()
    }
}

test_msg!(FolderEntityType, TESTS_USECASE_COUNT);
test_msg!(FolderEntityDetails, TESTS_USECASE_COUNT);
test_msg!(FoldersScanningResult, TESTS_USECASE_COUNT);
test_msg!(FolderEntity, TESTS_USECASE_COUNT);
