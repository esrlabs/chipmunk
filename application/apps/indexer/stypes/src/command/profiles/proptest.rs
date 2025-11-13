use crate::*;

impl Arbitrary for ShellType {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        // Reminder to add new fields here.
        match Self::Bash {
            ShellType::Bash => {}
            ShellType::Zsh => {}
            ShellType::Fish => {}
            ShellType::NuShell => {}
            ShellType::Elvish => {}
            ShellType::Pwsh => {}
        };

        prop_oneof![
            Just(Self::Bash),
            Just(Self::Zsh),
            Just(Self::Fish),
            Just(Self::NuShell),
            Just(Self::Elvish),
            Just(Self::Pwsh)
        ]
        .boxed()
    }
}

impl Arbitrary for ShellProfile {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (any::<ShellType>(), any::<PathBuf>())
            .prop_map(|(shell, path)| ShellProfile { shell, path })
            .boxed()
    }
}

impl Arbitrary for ProfileList {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(ShellProfile::arbitrary(), 0..10)
            .prop_map(ProfileList)
            .boxed()
    }
}

test_msg!(ShellType, TESTS_USECASE_COUNT);
test_msg!(ShellProfile, TESTS_USECASE_COUNT);
test_msg!(ProfileList, TESTS_USECASE_COUNT);
