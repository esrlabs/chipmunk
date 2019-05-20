use std::fs;
use std::io::{BufReader, Read, Seek, SeekFrom};

pub const ROW_NUMBER_SENTINAL: char = '\u{0002}';
pub const PLUGIN_ID_SENTINAL: char = '\u{0003}';
pub const SENTINAL_LENGTH: usize = 1;
const PEEK_END_SIZE: usize = 12;

#[inline]
pub fn is_newline(c: char) -> bool {
    match c {
        '\x0a' => true,
        '\x0d' => true,
        _ => false,
    }
}

#[inline]
pub fn create_tagged_line(
    tag: &str,
    out_buffer: &mut std::io::Write,
    trimmed_line: &str,
    line_nr: usize,
    with_newline: bool,
) -> std::io::Result<()> {
    write!(
        out_buffer,
        "{}{}{}{}{}{}{}{}",
        trimmed_line, //trimmed_line,
        PLUGIN_ID_SENTINAL,
        tag,
        PLUGIN_ID_SENTINAL,
        ROW_NUMBER_SENTINAL,
        line_nr,
        ROW_NUMBER_SENTINAL,
        if with_newline { "\n" } else { "" },
    )
}

#[inline]
pub fn extended_line_length(
    trimmed_len: usize,
    tag_len: usize,
    line_nr: usize,
    has_newline: bool,
) -> usize {
    trimmed_len
        + 4 * SENTINAL_LENGTH
        + tag_len
        + linenr_length(line_nr)
        + if has_newline { 1 } else { 0 }
}
fn linenr_length(linenr: usize) -> usize {
    if linenr == 0 {
        return 1;
    };
    let nr = linenr as f64;
    1 + nr.log10().floor() as usize
}

#[inline]
pub fn next_line_nr(path: &std::path::Path) -> Option<usize> {
    if !path.exists() {
        return Some(0);
    }
    let file = fs::File::open(path).expect("opening file did not work");
    let file_size = file.metadata().expect("could not read file metadata").len();
    if file_size == 0 {
        eprintln!("file was empty => next_line_nr was 0");
        return Some(0);
    };
    let mut reader = BufReader::new(file);
    let seek_offset: i64 = -(std::cmp::min(file_size - 1, PEEK_END_SIZE as u64) as i64);
    match reader.seek(SeekFrom::End(seek_offset as i64)) {
        Ok(_) => (),
        Err(e) => panic!("could not read last entry in file {:?}", e),
    };
    let size_of_slice = seek_offset.abs() as usize;
    let mut buf: Vec<u8> = vec![0; size_of_slice];
    reader
        .read_exact(&mut buf)
        .expect("reading to buffer should succeed");
    // |tag|#row#\n
    for i in 0..size_of_slice - 1 {
        if buf[i] == (PLUGIN_ID_SENTINAL as u8) && buf[i + 1] == ROW_NUMBER_SENTINAL as u8 {
            // row nr starts at i + 2
            let row_slice = &buf[i + 2..];
            let row_string = std::str::from_utf8(row_slice).expect("could not parse row number");
            let row_nr: usize = row_string
                .trim_end_matches(is_newline)
                .trim_end_matches(ROW_NUMBER_SENTINAL)
                .parse()
                .expect("expected number was was none");
            eprintln!("parsing: {:02X?} => last row_nr: {}", row_slice, row_nr);
            return Some(row_nr + 1);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    use super::*;
    use tempdir::TempDir;

    #[test]
    fn test_line_nr() {
        assert_eq!(1, linenr_length(0));
        assert_eq!(1, linenr_length(4));
        assert_eq!(2, linenr_length(10));
        assert_eq!(2, linenr_length(99));
        assert_eq!(3, linenr_length(100));
        assert_eq!(5, linenr_length(10000));
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
            assert_eq!(Some(expected), next_line_nr(&path));
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
