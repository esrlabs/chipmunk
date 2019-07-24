use failure::Error;
use std::char;
use std::fmt::Display;
use std::fs;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path;
use std::str;

pub const ROW_NUMBER_SENTINAL: char = '\u{0002}';
// pub const ROW_NUMBER_SENTINAL_SLICE: &[u8] = &[0x2];
pub const PLUGIN_ID_SENTINAL: char = '\u{0003}';
// pub const PLUGIN_ID_SENTINAL_SLICE: &[u8] = &[0x3];
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
pub fn create_tagged_line_d<T: Display>(
    tag: &str,
    out_buffer: &mut dyn std::io::Write,
    trimmed_line: T,
    line_nr: usize,
    with_newline: bool,
) -> std::io::Result<usize> {
    let s = format!(
        // out_buffer,
        "{}{}{}{}{}{}{}{}",
        trimmed_line, //trimmed_line,
        PLUGIN_ID_SENTINAL,
        tag,
        PLUGIN_ID_SENTINAL,
        ROW_NUMBER_SENTINAL,
        line_nr,
        ROW_NUMBER_SENTINAL,
        if with_newline { "\n" } else { "" },
    );
    let len = s.len();
    write!(out_buffer, "{}", s)?;
    Ok(len)
}
#[inline]
pub fn create_tagged_line(
    tag: &str,
    out_buffer: &mut dyn std::io::Write,
    trimmed_line: &str,
    line_nr: usize,
    with_newline: bool,
) -> std::io::Result<usize> {
    // // let line_tag = &[trimmed_line, tag].join([PLUGIN_ID_SENTINAL]);
    // let v: &[u8] = &[0x3];
    // let mut tmp = [0; 4];
    // let p = PLUGIN_ID_SENTINAL.encode_utf8(&mut tmp);
    // let mut tmp2 = [0; 4];
    // let p2 = ROW_NUMBER_SENTINAL.encode_utf8(&mut tmp2);
    // let nr = line_nr.to_string();
    // // let p = unsafe { str::from_utf8_unchecked(v) };
    // // let line_tag = &[trimmed_line, p, tag, p, p2, &nr[..], p2].join("");
    if with_newline {
        writeln!(
            out_buffer,
            "{}",
            format_args!(
                "{}{}{}{}{}{}{}",
                trimmed_line,
                PLUGIN_ID_SENTINAL,
                tag,
                PLUGIN_ID_SENTINAL,
                ROW_NUMBER_SENTINAL,
                line_nr,
                ROW_NUMBER_SENTINAL,
            ),
        )?;
    } else {
        write!(
            out_buffer,
            "{}",
            format_args!(
                "{}{}{}{}{}{}{}",
                trimmed_line,
                PLUGIN_ID_SENTINAL,
                tag,
                PLUGIN_ID_SENTINAL,
                ROW_NUMBER_SENTINAL,
                line_nr,
                ROW_NUMBER_SENTINAL,
            ),
        )?;
    }
    Ok(trimmed_line.len() + 4 * SENTINAL_LENGTH + tag.len() + linenr_length(line_nr) + 1) // nl
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
pub fn linenr_length(linenr: usize) -> usize {
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
            return Some(row_nr + 1);
        }
    }
    None
}
pub fn get_out_file_and_size(
    append: bool,
    out_path: &path::PathBuf,
) -> Result<(fs::File, usize), Error> {
    let out_file: std::fs::File = if append {
        std::fs::OpenOptions::new()
            .append(true)
            .create(true)
            .open(out_path)?
    } else {
        std::fs::File::create(out_path)?
    };
    let current_out_file_size = out_file.metadata().map(|md| md.len() as usize)?;
    Ok((out_file, current_out_file_size))
}

#[inline]
pub fn report_progress(
    line_nr: usize,
    current_byte_index: usize,
    processed_bytes: usize,
    source_file_size: usize,
    progress_every_n_lines: usize,
) {
    if line_nr % progress_every_n_lines == 0 {
        eprintln!(
            "processed {} lines -- byte-index {} ({} %)",
            line_nr,
            current_byte_index,
            (processed_bytes as f32 / source_file_size as f32 * 100.0).round()
        );
    }
}

pub fn get_processed_bytes(append: bool, out: &path::PathBuf) -> u64 {
    if append {
        match fs::metadata(out) {
            Ok(metadata) => metadata.len(),
            Err(_) => 0,
        }
    } else {
        0
    }
}
