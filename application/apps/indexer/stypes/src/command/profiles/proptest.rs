use crate::*;

impl Arbitrary for Profile {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            any::<String>(),
            any::<PathBuf>(),
            any::<Option<HashMap<String, String>>>(),
            any::<bool>(),
        )
            .prop_map(|(name, path, envvars, symlink)| Profile {
                name,
                path,
                symlink,
                envvars,
            })
            .boxed()
    }
}

impl Arbitrary for ProfileList {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(Profile::arbitrary(), 0..10)
            .prop_map(ProfileList)
            .boxed()
    }
}

test_msg!(Profile, TESTS_USECASE_COUNT);
test_msg!(ProfileList, TESTS_USECASE_COUNT);
