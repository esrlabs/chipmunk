use crate::*;

impl Arbitrary for FolderEntityType {
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
