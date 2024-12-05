use proptest::prelude::*;

pub const TESTS_USECASE_COUNT: usize = 100;

pub fn rnd_usize() -> BoxedStrategy<usize> {
    any::<u32>().prop_map(|n| n as usize).boxed()
}
pub fn rnd_u64() -> BoxedStrategy<u64> {
    any::<u32>().prop_map(|n| n as u64).boxed()
}

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
                    use std::{env::temp_dir};
                    use std::fs::{File, create_dir_all};
                    use std::io::{Write};
                    use remove_dir_all::remove_dir_all;

                    let dest = temp_dir().join("stypes_test").join(stringify!($type));
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

    // Subtype returns void: gen_encode_decode_fns!(CommandOutcome<()>);
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
                    use std::{env::temp_dir};
                    use std::fs::{File, create_dir_all};
                    use std::io::{Write};
                    use remove_dir_all::remove_dir_all;

                    let dest = temp_dir().join("stypes_test").join(format!("{}_Void",stringify!($type)));
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

    // With subtypes: gen_encode_decode_fns!(CommandOutcome<String>);
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
                    use std::{env::temp_dir};
                    use std::fs::{File, create_dir_all};
                    use std::io::{Write};
                    use remove_dir_all::remove_dir_all;

                    let dest = temp_dir().join("stypes_test").join(format!("{}_{}",stringify!($type), stringify!($generic)));
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

    // With nested subtypes: gen_encode_decode_fns!(CommandOutcome<Option<String>>);
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
                    use std::{env::temp_dir};
                    use std::fs::{File, create_dir_all};
                    use std::io::{Write};
                    use remove_dir_all::remove_dir_all;

                    let dest = temp_dir().join("stypes_test").join(format!("{}_{}_{}",stringify!($type), stringify!($generic), stringify!($nested)));
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
