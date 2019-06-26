use crate::chunks::{Chunk, ChunkFactory};
use crate::utils;
use crate::dlt_parse::*;
use failure::{err_msg, Error};
use std::fs;
use std::path;
use std::io::{BufRead, BufReader, BufWriter, Read, Write};

const REPORT_PROGRESS_LINE_BLOCK: usize = 1_000_000;

pub trait IndexedIter: Iterator<Item = TaggedLine> {}

#[derive(Eq, PartialEq, Debug)]
pub struct TaggedLine {
    pub content: String,
    pub line_nr: usize,
    pub processed_bytes: usize,
    pub has_newline: bool,
}
pub struct IndexedLineIter<T: Read> {
    reader: BufReader<T>,
    processed_bytes: usize,
    processed_lines: usize,
}
impl<T: Read> IndexedIter for IndexedLineIter<T> {}

impl<T: Read> IndexedLineIter<T> {
    pub fn new(
        reader: T,
        processed_bytes: usize,
        processed_lines: usize,
    ) -> IndexedLineIter<T> {
        IndexedLineIter {
            reader: BufReader::new(reader),
            processed_bytes,
            processed_lines,
        }
    }
}
impl<T: Read> Iterator for IndexedLineIter<T> {
    type Item = TaggedLine;
    fn next(&mut self) -> Option<Self::Item> {
        let mut buf = vec![];

        while let Ok(len) = self.reader.read_until(b'\n', &mut buf) {
            if len == 0 {
                break;
            } else {
                let s = unsafe { std::str::from_utf8_unchecked(&buf) };
                let trimmed_line = s.trim_matches(utils::is_newline);
                let trimmed_len = trimmed_line.len();
                self.processed_bytes += len;
                if trimmed_len != 0 {
                    let had_newline = trimmed_len != len;
                    let res = Some(TaggedLine {
                        content: trimmed_line.to_string(),
                        line_nr: self.processed_lines,
                        has_newline: had_newline,
                        processed_bytes: self.processed_bytes,
                    });
                    self.processed_lines += 1;
                    return res;
                }
            }
        }
        None
    }
}

pub struct IndexingConfig<'a> {
    pub tag: &'a str,
    pub max_lines: usize,
    pub chunk_size: usize,
    pub in_file: fs::File,
    pub out_path: &'a path::PathBuf,
    pub append: bool,
    pub source_file_size: usize,
    pub to_stdout: bool,
}
pub fn create_index_and_mapping_dlt(config: IndexingConfig) -> Result<Vec<Chunk>, Error> {
    let initial_line_nr = match utils::next_line_nr(config.out_path) {
        Some(nr) => nr,
        None => {
            eprintln!("could not determine last line number of {:?}", config.out_path);
            std::process::exit(2)
        }
    };
    index_dlt_file(config, initial_line_nr)
}
pub fn create_index_and_mapping(config: IndexingConfig) -> Result<Vec<Chunk>, Error> {
    let initial_line_nr = match utils::next_line_nr(config.out_path) {
        Some(nr) => nr,
        None => {
            eprintln!("could not determine last line number of {:?}", config.out_path);
            std::process::exit(2)
        }
    };
    index_file(config, initial_line_nr)
}

#[inline]
fn report_progress(
    line_nr: usize,
    current_byte_index: usize,
    processed_bytes: usize,
    source_file_size: usize,
) {
    if line_nr % REPORT_PROGRESS_LINE_BLOCK == 0 {
        eprintln!(
            "processed {} lines -- byte-index {} ({} %)",
            line_nr,
            current_byte_index,
            (processed_bytes as f32 / source_file_size as f32 * 100.0).round()
        );
    }
}
pub fn index_dlt_file(config: IndexingConfig, initial_line_nr: usize) -> Result<Vec<Chunk>, Error> {
    let (out_file, current_out_file_size) = get_out_file_and_size(config.append, &config.out_path)?;

    let mut chunks = vec![];
    let mut processed_lines = 0usize;
    let mut chunk_factory =
        ChunkFactory::new(config.chunk_size, config.to_stdout, current_out_file_size);
    let mut buf_writer = BufWriter::with_capacity(100 * 1024 * 1024, out_file);
    let reader: BufReader<&std::fs::File> = BufReader::new(&config.in_file);
    let message_iter = MessageIter::new(reader, config.tag, initial_line_nr);
    for counted_message in message_iter {
        let written_bytes_len = utils::create_tagged_line_d(
            config.tag,
            &mut buf_writer,
            &counted_message, //trimmed_line,
            counted_message.line_index,
            false,
        )?;
        if let Some(chunk) = chunk_factory
            .create_chunk_if_needed(counted_message.line_index + 1, written_bytes_len)
        {
            chunks.push(chunk);
            buf_writer.flush()?;
        }
        processed_lines = counted_message.line_index;
        report_progress(
            processed_lines,
            chunk_factory.get_current_byte_index(),
            counted_message.byte_index,
            config.source_file_size,
        );
    }

    buf_writer.flush()?;
    if let Some(chunk) = chunk_factory.create_last_chunk(processed_lines + 1, chunks.is_empty()) {
        chunks.push(chunk);
    }
    last_chunk_integrity_check(&chunks, &config.out_path)?;
    Ok(chunks)
}
fn get_processed_bytes(append: bool, out: &path::PathBuf) -> u64 {
    if append {
        match fs::metadata(out) {
            Ok(metadata) => metadata.len(),
            Err(_) => 0,
        }
    } else {
        0
    }
}
fn get_out_file_and_size(
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

pub fn index_file(config: IndexingConfig, initial_line_nr: usize) -> Result<Vec<Chunk>, Error> {
    let (out_file, current_out_file_size) = get_out_file_and_size(config.append, &config.out_path)?;

    let mut chunks = vec![];
    let mut processed_lines = 0usize;
    let mut chunk_factory =
        ChunkFactory::new(config.chunk_size, config.to_stdout, current_out_file_size);
    let mut buf_writer = BufWriter::with_capacity(100 * 1024 * 1024, out_file);
    let indexed_iter = IndexedLineIter::new(
        BufReader::new(&config.in_file),
        get_processed_bytes(config.append, &config.out_path) as usize,
        initial_line_nr,
    );
    for tagged_line in indexed_iter {
        let written_bytes_len = utils::create_tagged_line_d(
            config.tag,
            &mut buf_writer,
            tagged_line.content, //trimmed_line,
            tagged_line.line_nr,
            tagged_line.has_newline,
        )?;
        if let Some(chunk) = chunk_factory
            .create_chunk_if_needed(tagged_line.line_nr + 1, written_bytes_len)
        {
            chunks.push(chunk);
            buf_writer.flush()?;
        }
        processed_lines = tagged_line.line_nr;
        report_progress(
            processed_lines,
            chunk_factory.get_current_byte_index(),
            tagged_line.processed_bytes,
            config.source_file_size,
        );
    }

    buf_writer.flush()?;
    if let Some(chunk) = chunk_factory.create_last_chunk(processed_lines + 1, chunks.is_empty()) {
        chunks.push(chunk);
    }
    last_chunk_integrity_check(&chunks, &config.out_path)?;
    Ok(chunks)
}
fn last_chunk_integrity_check(chunks: &[Chunk], out_path: &path::PathBuf) -> Result<(), Error> {
    match chunks.last() {
        Some(last_chunk) => {
            let last_expected_byte_index = fs::metadata(out_path).map(|md| md.len() as usize)?;
            if last_expected_byte_index != last_chunk.b.1 {
                Err(err_msg(format!(
                    "error in computation! last byte in chunks is {} but should be {}",
                    last_chunk.b.1, last_expected_byte_index
                )))
            } else {
                Ok(())
            }
        }
        None => Ok(()),
    }
}
#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    extern crate rand;
    extern crate tempdir;
    use super::*;
    use pretty_assertions::assert_eq;
    use std::fs;
    use std::fs::File;
    use std::path::PathBuf;
    use tempdir::TempDir;

    fn get_chunks(
        test_content: &str,
        chunk_size: usize,
        tag: &str,
        tmp_file_name: Option<&str>,
    ) -> (Vec<Chunk>, String) {
        let tmp_dir = TempDir::new("test_dir").expect("could not create temp dir");
        let test_file_path = tmp_dir.path().join("tmpTestFile.txt");
        let out_file_path = tmp_dir.path().join("tmpTestFile.txt.out");
        fs::write(&test_file_path, test_content).expect("testfile could not be written");

        // call our function
        let f = File::open(&test_file_path).unwrap();
        let source_file_size = f.metadata().unwrap().len() as usize;
        let chunks = create_index_and_mapping(IndexingConfig {
            tag,
            max_lines: 5,
            chunk_size,
            in_file: f,
            out_path: &out_file_path,
            append: tmp_file_name.is_some(),
            source_file_size,
            to_stdout: false,
        })
        .unwrap();
        let out_file_content: String =
            fs::read_to_string(out_file_path).expect("could not read file");

        // cleanup
        let _ = tmp_dir.close();

        (chunks, out_file_content)
    }
    type Pair = (usize, usize);

    fn chunks_fit_together(chunks: &[Chunk]) -> bool {
        if chunks.is_empty() {
            return true;
        }
        let byte_ranges: Vec<(usize, usize)> = chunks.iter().map(|x| x.b).collect();
        let bytes_tail: &[(usize, usize)] = &byte_ranges[1..];
        let bytes_pairs: Vec<(&Pair, &Pair)> = byte_ranges.iter().zip(bytes_tail.iter()).collect();
        let row_ranges: Vec<(usize, usize)> = chunks.iter().map(|x| x.r).collect();
        let row_tail: &[(usize, usize)] = &row_ranges[1..];
        let row_pairs: Vec<(&Pair, &Pair)> = row_ranges.iter().zip(row_tail.iter()).collect();
        bytes_pairs.iter().all(|&(p1, p2)| p1.1 + 1 == p2.0)
            && row_pairs.iter().all(|&(p1, p2)| p1.1 + 1 == p2.0)
    }

    #[test]
    fn test_append_to_empty_output() {
        let tmp_dir = TempDir::new("my_directory_prefix").unwrap();
        let empty_file = std::fs::OpenOptions::new()
            .append(true)
            .create(true)
            .open(tmp_dir.path().join("empty.log")).unwrap();
        let out_path = tmp_dir.path().join("test_append_to_empty_output.log.out");
        let source_file_size = empty_file.metadata().unwrap().len() as usize;
        let chunks = create_index_and_mapping(IndexingConfig {
            tag: "tag",
            max_lines: 5,
            chunk_size: 1,
            in_file: empty_file,
            out_path: &out_path,
            append: false,
            source_file_size,
            to_stdout: false,
        })
        .expect("could not index file");
        assert_eq!(0, chunks.len(), "empty file should produce 0 chunks");
        let out_file_content: String = fs::read_to_string(&out_path).expect("could not read file");
        assert_eq!(
            0,
            out_file_content.len(),
            "empty file should produce empty output"
        );
    }
    #[test]
    fn test_append_to_nonempty_output() {
        let tmp_dir = TempDir::new("my_directory_prefix").expect("could not create temp dir");
        let out_path = tmp_dir.path().join("test_append_to_empty_output.log.out");
        let nonempty_file_path = tmp_dir.path().join("not_empty.log");
        fs::write(&nonempty_file_path, "A").unwrap();
        let nonempty_file = File::open(nonempty_file_path).unwrap();
        let nonempty_file_size = nonempty_file.metadata().unwrap().len() as usize;
        let chunks2 = create_index_and_mapping(IndexingConfig {
            tag: "tag",
            max_lines: 5,
            chunk_size: 1,
            in_file: nonempty_file,
            out_path: &out_path,
            append: true,
            source_file_size: nonempty_file_size,
            to_stdout: false,
        })
        .expect("could not index file");
        let out_file_content: String = fs::read_to_string(out_path).expect("could not read file");
        println!("outfile: {}\nchunks: {:?}", out_file_content, chunks2);
        assert_eq!(
            1,
            chunks2.len(),
            "nonempty file should produce nonempty output"
        );
        assert_eq!(0, chunks2[0].r.0, "first chunk row should start with 0");
    }
    #[test]
    fn test_chunking_one_chunk_exact() {
        let (chunks, content) = get_chunks("A\n", 1, "some_new_tag", None);
        println!("chunks: {:?}", chunks);
        println!("content: {:02X?}", content.as_bytes());
        assert_eq!(1, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[test]
    fn test_chunking_one_chunk_to_big() {
        let (chunks, content) = get_chunks("A\n", 2, "tag_ok", None);
        println!("chunks: {:?}", chunks);
        println!("content: {:02X?}", content.as_bytes());
        assert_eq!(1, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[test]
    fn test_chunking_one_chunk_exact_no_nl() {
        let (chunks, content) = get_chunks("A", 1, "tag_no_nl", None);
        assert_eq!(1, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[test]
    fn test_chunking_multiple_chunks_partly() {
        let (chunks, content) = get_chunks("A\nB\nC", 2, "T", None);
        println!("chunks: {:?}", chunks);
        println!(
            "content ({} bytes): {:02X?}",
            content.as_bytes().len(),
            content.as_bytes()
        );
        assert_eq!(2, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[test]
    fn test_chunking_multiple_chunks_complete() {
        let (chunks, content) = get_chunks("A\nB\nC\nD\n", 2, "tag_chunk_complet", None);
        assert_eq!(2, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[test]
    fn test_chunking_multiple_chunks_complete_no_nl() {
        let (chunks, content) = get_chunks("A\nB\nC\nD", 2, "tag_complete_no_nl", None);
        println!("chunks: {:?}", chunks);
        println!("content: {:02X?}", content.as_bytes());
        assert_eq!(2, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    fn size_of_all_chunks(chunks: &[Chunk]) -> usize {
        let res = chunks
            .iter()
            .fold(0, |acc, x: &Chunk| acc + (x.b.1 - x.b.0));
        if chunks.len() > 1 {
            res + 1
        } else {
            res
        }
    }

    test_generator::test_expand_paths! { test_input_output; "test_samples/indexing/*" }

    fn test_input_output(dir_name: &str) {
        let in_path = PathBuf::from(&dir_name).join("in.txt");
        let in_file = File::open(in_path).unwrap();
        let tmp_dir = TempDir::new("test_dir").expect("could not create temp dir");
        let out_file_path = tmp_dir.path().join("tmpTestFile.txt.out");
        let in_file_size = in_file.metadata().unwrap().len() as usize;
        let append_to_this = PathBuf::from(&dir_name).join("append_here.log");
        let append_use_case = append_to_this.exists();

        if append_use_case {
            println!("append use case...trying to append to {:?}", append_to_this);
            fs::copy(&append_to_this, &out_file_path).expect("copy content failed");
            println!("copied from {:?}", append_to_this);
            let content = fs::read_to_string(append_to_this).expect("could not read file");
            println!("content was: {:?}", content);
            println!("copied content to: {:?}", out_file_path);
            let content2 = fs::read_to_string(&out_file_path).expect("could not read file");
            println!("copied content was: {:?}", content2);
        }
        let chunks = create_index_and_mapping(IndexingConfig {
            tag: "TAG",
            max_lines: 5,
            chunk_size: 1,
            in_file,
            out_path: &out_file_path,
            append: append_use_case,
            source_file_size: in_file_size,
            to_stdout: false,
        })
        .unwrap();
        let out_file_content_bytes = fs::read(out_file_path).expect("could not read file");
        let out_file_content = String::from_utf8_lossy(&out_file_content_bytes[..]);
        let expected_path = PathBuf::from(&dir_name).join("expected.output");
        let expected_content_bytes = fs::read(expected_path).expect("could not read expected file");
        let expected_content = String::from_utf8_lossy(&expected_content_bytes[..]);
        println!(
            "comparing\n{}\nto expected:\n{}",
            out_file_content, expected_content
        );
        assert_eq!(expected_content, out_file_content);
        assert_eq!(true, chunks_fit_together(&chunks), "chunks need to fit");
    }

}
