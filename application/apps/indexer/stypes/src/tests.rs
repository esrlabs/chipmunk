use std::{env::temp_dir, path::PathBuf};
/// The number of test cases to generate for use in test scenarios.
pub const TESTS_USECASE_COUNT: usize = 100;

/// The default directory name for storing test data.
pub const OUTPUT_PATH_DEFAULT: &str = "stypes_test";

/// The name of the environment variable that specifies the path for storing test data.
/// If this variable is not set, the default path will be used.
pub const OUTPUT_PATH_ENVVAR: &str = "CHIPMUNK_PROTOCOL_TEST_OUTPUT";

/// This function returns the path for writing test data (for testing in a different context).
/// The function checks the value of the `CHIPMUNK_PROTOCOL_TEST_OUTPUT` environment variable.
/// If the variable is defined, its value will be used as the path for writing test data.
/// If the `CHIPMUNK_PROTOCOL_TEST_OUTPUT` environment variable is not defined, the default path
/// `$TMP/stypes_test` will be used.
pub fn get_output_path() -> PathBuf {
    std::env::var(OUTPUT_PATH_ENVVAR)
        .map_err(|err| err.to_string())
        .and_then(|s| {
            if s.is_empty() {
                Err(String::from("Default output folder will be used"))
            } else {
                Ok(s)
            }
        })
        .map(PathBuf::from)
        .unwrap_or_else(|_| temp_dir().join(OUTPUT_PATH_DEFAULT))
}

/// The `test_msg` macro creates a `proptest` for the specified data type. The macro also supports
/// generic types. For example:
/// ```ignore
/// test_msg!(Progress, 10);
/// test_msg!(CommandOutcome<()>, 10);
/// test_msg!(CommandOutcome<bool>, 10);
/// test_msg!(CommandOutcome<Option<String>>, 10);
/// ```
/// The second numeric argument specifies the number of variants to generate for each type.
/// During testing, a separate directory is created for each type. For each variant of the type,
/// a file with a sequential name (e.g., `1.bin`, `2.bin`, ...) will be created.
///
/// **WARNING**: When running tests, the folder specified in the `CHIPMUNK_PROTOCOL_TEST_OUTPUT`
/// environment variable will be completely deleted. Be extremely cautious when setting the value
/// of the `CHIPMUNK_PROTOCOL_TEST_OUTPUT` environment variable.
#[macro_export]
macro_rules! test_msg {
    ($type:ident, $exp_count:expr) => {
        paste::item! {

            proptest! {
                #![proptest_config(ProptestConfig {
                    max_shrink_iters: 50,
                    ..ProptestConfig::with_cases(500)
                })]

                #[allow(non_snake_case)]
                #[test]
                fn [< write_test_data_for_ $type >](cases in proptest::collection::vec($type::arbitrary(), $exp_count)) {
                    use std::fs::{File, create_dir_all};
                    use std::io::{Write};
                    use remove_dir_all::remove_dir_all;

                    let dest = get_output_path().join(stringify!($type));
                    if dest.exists() {
                        remove_dir_all(&dest).expect("Folder for tests has been cleaned");
                    }
                    if !dest.exists()  {
                        create_dir_all(&dest).expect("Folder for tests has been created");
                    }
                    for (n, case) in cases.into_iter().enumerate() {
                        let bytes = case.encode();
                        assert!(bytes.is_ok());
                        let bytes = bytes.unwrap();
                        let mut file = File::create(dest.join(format!("{n}.raw")))?;
                        assert!(file.write_all(&bytes).is_ok());
                        assert!(file.flush().is_ok());
                        let msg = $type::decode(&bytes);
                        if let Err(err) = &msg {
                            eprintln!("Decoding error: {err:?}");
                        }
                        assert!(msg.is_ok());
                    }

                }

            }
        }
    };

    ($type:ident<()>, $exp_count:expr) => {
        paste::item! {

            proptest! {
                #![proptest_config(ProptestConfig {
                    max_shrink_iters: 50,
                    ..ProptestConfig::with_cases(500)
                })]

                #[allow(non_snake_case)]
                #[test]
                fn [< write_test_data_for_ $type Void >](cases in proptest::collection::vec($type::<()>::arbitrary(), $exp_count)) {
                    use std::fs::{File, create_dir_all};
                    use std::io::{Write};
                    use remove_dir_all::remove_dir_all;

                    let dest = get_output_path().join(format!("{}_Void",stringify!($type)));
                    if dest.exists() {
                        remove_dir_all(&dest).expect("Folder for tests has been cleaned");
                    }
                    if !dest.exists()  {
                        create_dir_all(&dest).expect("Folder for tests has been created");
                    }
                    for (n, case) in cases.into_iter().enumerate() {
                        let bytes = case.encode();
                        assert!(bytes.is_ok());
                        let bytes = bytes.unwrap();
                        let mut file = File::create(dest.join(format!("{n}.raw")))?;
                        assert!(file.write_all(&bytes).is_ok());
                        assert!(file.flush().is_ok());
                        let msg = $type::<()>::decode(&bytes);
                        if let Err(err) = &msg {
                            eprintln!("Decoding error: {err:?}");
                        }
                        assert!(msg.is_ok());
                    }

                }

            }
        }
    };

    ($type:ident<$generic:ident>, $exp_count:expr) => {
        paste::item! {

            proptest! {
                #![proptest_config(ProptestConfig {
                    max_shrink_iters: 50,
                    ..ProptestConfig::with_cases(500)
                })]

                #[allow(non_snake_case)]
                #[test]
                fn [< write_test_data_for_ $type $generic >](cases in proptest::collection::vec($type::<$generic>::arbitrary(), $exp_count)) {
                    use std::fs::{File, create_dir_all};
                    use std::io::{Write};
                    use remove_dir_all::remove_dir_all;

                    let dest = get_output_path().join(format!("{}_{}",stringify!($type), stringify!($generic)));
                    if dest.exists() {
                        remove_dir_all(&dest).expect("Folder for tests has been cleaned");
                    }
                    if !dest.exists()  {
                        create_dir_all(&dest).expect("Folder for tests has been created");
                    }
                    for (n, case) in cases.into_iter().enumerate() {
                        let bytes = case.encode();
                        assert!(bytes.is_ok());
                        let bytes = bytes.unwrap();
                        let mut file = File::create(dest.join(format!("{n}.raw")))?;
                        assert!(file.write_all(&bytes).is_ok());
                        assert!(file.flush().is_ok());
                        let msg = $type::<$generic>::decode(&bytes);
                        if let Err(err) = &msg {
                            eprintln!("Decoding error: {err:?}");
                        }
                    }
                }
            }
        }
    };

    ($type:ident<$generic:ident<$nested:ident>>, $exp_count:expr) => {
        paste::item! {

            proptest! {
                #![proptest_config(ProptestConfig {
                    max_shrink_iters: 50,
                    ..ProptestConfig::with_cases(500)
                })]

                #[allow(non_snake_case)]
                #[test]
                fn [< write_test_data_for_ $type $generic $nested>](cases in proptest::collection::vec($type::<$generic<$nested>>::arbitrary(), $exp_count)) {
                    use std::fs::{File, create_dir_all};
                    use std::io::{Write};
                    use remove_dir_all::remove_dir_all;

                    let dest = get_output_path().join(format!("{}_{}_{}",stringify!($type), stringify!($generic), stringify!($nested)));
                    if dest.exists() {
                        remove_dir_all(&dest).expect("Folder for tests has been cleaned");
                    }
                    if !dest.exists()  {
                        create_dir_all(&dest).expect("Folder for tests has been created");
                    }
                    for (n, case) in cases.into_iter().enumerate() {
                        let bytes = case.encode();
                        assert!(bytes.is_ok());
                        let bytes = bytes.unwrap();
                        let mut file = File::create(dest.join(format!("{n}.raw")))?;
                        assert!(file.write_all(&bytes).is_ok());
                        assert!(file.flush().is_ok());
                        let msg = $type::<$generic<$nested>>::decode(&bytes);
                        if let Err(err) = &msg {
                            eprintln!("Decoding error: {err:?}");
                        }
                    }
                }
            }
        }
    };
}
