use crate::chunks::{Chunk, ChunkFactory};
use crate::dlt_parse;
use crate::dlt;
use crate::utils;
use std::path;
use std::fs;
use std::collections::HashSet;
use std::io::{BufRead, BufReader, BufWriter, Write, Read};
use failure::{err_msg, Error};
use buf_redux::BufReader as ReduxReader;
use buf_redux::policy::MinBuffered;

const REPORT_PROGRESS_LINE_BLOCK: usize = 250_000;

pub struct IndexingConfig<'a> {
    pub tag: &'a str,
    pub max_lines: usize,
    pub chunk_size: usize,
    pub in_file: fs::File,
    pub out_path: &'a path::PathBuf,
    pub append: bool,
    pub source_file_size: usize,
    pub to_stdout: bool,
    pub status_updates: bool,
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
pub fn create_index_and_mapping(config: IndexingConfig) -> Result<Vec<Chunk>, Error> {
    let initial_line_nr = match utils::next_line_nr(config.out_path) {
        Some(nr) => nr,
        None => {
            eprintln!(
                "could not determine last line number of {:?}",
                config.out_path
            );
            std::process::exit(2)
        }
    };
    index_file(config, initial_line_nr)
}
pub fn create_index_and_mapping_dlt(
    config: IndexingConfig,
    filter_conf: dlt::DltFilterConfig,
) -> Result<Vec<Chunk>, Error> {
    let initial_line_nr = match utils::next_line_nr(config.out_path) {
        Some(nr) => nr,
        None => {
            eprintln!(
                "could not determine last line number of {:?}",
                config.out_path
            );
            std::process::exit(2)
        }
    };
    index_dlt_file(config, filter_conf, initial_line_nr)
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
pub fn index_file(config: IndexingConfig, initial_line_nr: usize) -> Result<Vec<Chunk>, Error> {
    let (out_file, current_out_file_size) = get_out_file_and_size(config.append, &config.out_path)?;

    let mut chunks = vec![];
    let mut chunk_factory =
        ChunkFactory::new(config.chunk_size, config.to_stdout, current_out_file_size);

    let mut reader = BufReader::new(config.in_file);
    let mut line_nr = initial_line_nr;
    let mut buf_writer = BufWriter::with_capacity(10 * 1024 * 1024, out_file);

    let mut buf = vec![];
    let mut processed_bytes = get_processed_bytes(config.append, &config.out_path) as usize;
    while let Ok(len) = reader.read_until(b'\n', &mut buf) {
        let s = unsafe { std::str::from_utf8_unchecked(&buf) };
        let trimmed_line = s.trim_matches(utils::is_newline);
        let trimmed_len = trimmed_line.len();
        let had_newline = trimmed_len != len;
        processed_bytes += len;
        if len == 0 {
            // no more content
            break;
        };
        // only use non-empty lines, others will be dropped
        if trimmed_len != 0 {
            if had_newline {
                writeln!(
                    buf_writer,
                    "{}{}{}{}{}{}{}",
                    trimmed_line,
                    utils::PLUGIN_ID_SENTINAL,
                    config.tag,
                    utils::PLUGIN_ID_SENTINAL,
                    utils::ROW_NUMBER_SENTINAL,
                    line_nr,
                    utils::ROW_NUMBER_SENTINAL,
                )?;
            } else {
                write!(
                    buf_writer,
                    "{}{}{}{}{}{}{}",
                    trimmed_line,
                    utils::PLUGIN_ID_SENTINAL,
                    config.tag,
                    utils::PLUGIN_ID_SENTINAL,
                    utils::ROW_NUMBER_SENTINAL,
                    line_nr,
                    utils::ROW_NUMBER_SENTINAL,
                )?;
            }
            let additional_bytes =
                utils::extended_line_length(trimmed_len, config.tag.len(), line_nr, had_newline);
            line_nr += 1;

            if let Some(chunk) = chunk_factory.create_chunk_if_needed(line_nr, additional_bytes) {
                chunks.push(chunk);
                buf_writer.flush()?;
            }
            report_progress(
                line_nr,
                chunk_factory.get_current_byte_index(),
                processed_bytes,
                config.source_file_size,
            );
        }
        buf = vec![];
    }
    buf_writer.flush()?;
    if let Some(chunk) = chunk_factory.create_last_chunk(line_nr, chunks.is_empty()) {
        chunks.push(chunk);
    }
    match chunks.last() {
        Some(last_chunk) => {
            let last_expected_byte_index =
                fs::metadata(config.out_path).map(|md| md.len() as usize)?;
            if last_expected_byte_index != last_chunk.b.1 {
                return Err(err_msg(format!(
                    "error in computation! last byte in chunks is {} but should be {}",
                    last_chunk.b.1, last_expected_byte_index
                )));
            }
        }
        None => eprintln!("no content found"),
    }
    Ok(chunks)
}
fn read_one_dlt_message<T: Read>(
    reader: &mut ReduxReader<T, MinBuffered>,
    dlt_filter: &dlt::DltFilterConfig,
) -> Result<Option<(usize, Option<dlt::Message>)>, Error> {
    loop {
        match reader.fill_buf() {
            Ok(content) => {
                if content.is_empty() {
                    return Ok(None);
                }
                let available = content.len();
                let res: nom::IResult<&[u8], Option<dlt::Message>> =
                    dlt_parse::dlt_message(content, dlt_filter.min_log_level);
                match res {
                    Ok(r) => {
                        let consumed = available - r.0.len();
                        break Ok(Some((consumed, r.1)));
                    }
                    e => match e {
                        Err(nom::Err::Incomplete(_)) => continue,
                        Err(nom::Err::Error(_)) => panic!("nom error"),
                        Err(nom::Err::Failure(_)) => panic!("nom failure"),
                        _ => panic!("error while iterating..."),
                    },
                }
            }
            Err(e) => {
                panic!("error while iterating...{}", e);
            }
        }
    }
}
pub fn index_dlt_file(
    config: IndexingConfig,
    dlt_filter: dlt::DltFilterConfig,
    initial_line_nr: usize,
) -> Result<Vec<Chunk>, Error> {
    let (out_file, current_out_file_size) = get_out_file_and_size(config.append, &config.out_path)?;

    let mut chunks = vec![];
    let mut chunk_factory =
        ChunkFactory::new(config.chunk_size, config.to_stdout, current_out_file_size);

    let mut reader = ReduxReader::with_capacity(10 * 1024 * 1024, config.in_file)
        .set_policy(MinBuffered(10 * 1024));
    let mut line_nr = initial_line_nr;
    let mut processed_lines = 0usize;
    let mut buf_writer = BufWriter::with_capacity(10 * 1024 * 1024, out_file);

    let mut processed_bytes = get_processed_bytes(config.append, &config.out_path) as usize;
    loop {
        // println!("line index: {}", line_nr);
        match read_one_dlt_message(&mut reader, &dlt_filter) {
            Ok(Some((consumed, Some(msg)))) => {
                // println!("consumed: {}", consumed);
                reader.consume(consumed);
                let written_bytes_len =
                    utils::create_tagged_line_d(config.tag, &mut buf_writer, &msg, line_nr, true)?;
                processed_bytes += consumed;
                line_nr += 1;
                processed_lines += 1;
                if let Some(chunk) =
                    chunk_factory.create_chunk_if_needed(line_nr, written_bytes_len)
                {
                    chunks.push(chunk);
                    buf_writer.flush()?;
                }
                if config.status_updates {
                    report_progress(
                        processed_lines,
                        chunk_factory.get_current_byte_index(),
                        processed_bytes,
                        config.source_file_size,
                    );
                }
            }
            Ok(Some((consumed, None))) => {
                reader.consume(consumed);
                processed_bytes += consumed;
                processed_lines += 1;
                if config.status_updates {
                    report_progress(
                        processed_lines,
                        chunk_factory.get_current_byte_index(),
                        processed_bytes,
                        config.source_file_size,
                    );
                }
            }
            Ok(None) => {
                // println!("nothing more to parse");
                break;
            }
            Err(e) => return Err(err_msg(format!("error while parsing dlt messages: {}", e))),
        }
    }

    buf_writer.flush()?;
    if let Some(chunk) = chunk_factory.create_last_chunk(line_nr, chunks.is_empty()) {
        chunks.push(chunk);
    }
    match chunks.last() {
        Some(last_chunk) => {
            let last_expected_byte_index =
                fs::metadata(config.out_path).map(|md| md.len() as usize)?;
            if last_expected_byte_index != last_chunk.b.1 {
                eprintln!(
                    "error in computation! last byte in chunks is {} but should be {}",
                    last_chunk.b.1, last_expected_byte_index
                );
            }
        }
        None => eprintln!("no content found"),
    }
    Ok(chunks)
}
#[allow(dead_code)]
pub fn get_dlt_file_info(
    in_file: &fs::File,
) -> Result<HashSet<String>, Error> {
    let mut reader = ReduxReader::with_capacity(10 * 1024 * 1024, in_file)
        .set_policy(MinBuffered(10 * 1024));

    let mut app_ids = HashSet::new();
    loop {
        // println!("line index: {}", line_nr);
        match read_one_dlt_message_info(&mut reader) {
            Ok(Some((consumed, Some(app_id)))) => {
                // println!("consumed: {}", consumed);
                reader.consume(consumed);
                app_ids.insert(app_id);
            }
            Ok(Some((consumed, None))) => {
                reader.consume(consumed);
            }
            Ok(None) => {
                // println!("nothing more to parse");
                break;
            }
            Err(e) => return Err(err_msg(format!("error while parsing dlt messages: {}", e))),
        }
    }
    Ok(app_ids)
}
fn read_one_dlt_message_info<T: Read>(
    reader: &mut ReduxReader<T, MinBuffered>,
) -> Result<Option<(usize, Option<String>)>, Error> {
    loop {
        match reader.fill_buf() {
            Ok(content) => {
                if content.is_empty() {
                    return Ok(None);
                }
                let available = content.len();
                let res: nom::IResult<&[u8], Option<String>> =
                    dlt_parse::dlt_app_id(content);
                match res {
                    Ok(r) => {
                        let consumed = available - r.0.len();
                        break Ok(Some((consumed, r.1)));
                    }
                    e => match e {
                        Err(nom::Err::Incomplete(_)) => continue,
                        Err(nom::Err::Error(_)) => panic!("nom error"),
                        Err(nom::Err::Failure(_)) => panic!("nom failure"),
                        _ => panic!("error while iterating..."),
                    },
                }
            }
            Err(e) => {
                panic!("error while iterating...{}", e);
            }
        }
    }
}
