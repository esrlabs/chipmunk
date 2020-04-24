#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    // use super::*;
    use crate::utils::*;
    use std::fs;
    use tempdir::TempDir;

    #[test]
    fn test_line_nr() {
        assert_eq!(1, number_string_len(0));
        assert_eq!(1, number_string_len(4));
        assert_eq!(2, number_string_len(10));
        assert_eq!(2, number_string_len(99));
        assert_eq!(3, number_string_len(100));
        assert_eq!(5, number_string_len(10000));
    }

    const D1: u8 = PLUGIN_ID_SENTINAL as u8;
    const D2: u8 = ROW_NUMBER_SENTINAL as u8;
    const NL: u8 = 0x0a;
    #[test]
    fn test_extract_row_nr() {
        fn check(c: Vec<u8>, expected: usize) {
            let tmp_dir = TempDir::new("my_directory_prefix").expect("could not create temp dir");
            let path = tmp_dir.path().join("extract_row_test.txt");
            fs::write(&path, c).expect("testfile could not be written");
            let res = next_line_nr(&path).unwrap();
            assert_eq!(expected, res);
            let _ = tmp_dir.close();
        }
        let content = [b'A', D1, b't', b'a', b'g', D1, D2, 0x30, D2, NL];
        check(content.to_vec(), 1);
        let content2 = [
            b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A',
            b'A', D1, b't', b'a', b'g', D1, D2, 0x30, D2, NL,
        ];
        check(content2.to_vec(), 1);
        let content3 = &[
            [b'A', D1, b't', b'a', b'g', D1, D2, 0x30, D2, NL],
            [b'B', D1, b't', b'a', b'g', D1, D2, 0x31, D2, NL],
            [b'C', D1, b't', b'a', b'g', D1, D2, 0x32, D2, NL],
        ]
        .concat();
        check(content3.to_vec(), 3);
    }
}
