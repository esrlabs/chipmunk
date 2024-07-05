use std::{
    io::{BufWriter, Write},
    path::Path,
};

use futures::StreamExt;
use indexer_base::config::IndexSection;
use parsers::{LogMessage, MessageStreamItem, ParseYield};
use thiserror::Error;
use tokio_util::sync::CancellationToken;

#[derive(Error, Debug)]
pub enum ExportError {
    #[error("Configuration error ({0})")]
    Config(String),
    #[error("IO error: {0:?}")]
    Io(#[from] std::io::Error),
    #[error("Cancelled")]
    Cancelled,
}

/// Exporting data as raw into a given destination. Would be exported only data
/// defined in selections as indexes of rows (messages).
///
/// Returns usize - count of read messages (not exported, but read messages)
///
/// # Arguments
/// * `s` - instance of MessageProducer stream
/// * `destination_path` - destination path to a target file. If the file doesn't
/// exist it would be created; if exists - it will be opened to append new
/// content to the end of the file
/// * `sections` - an array of ranges, which should be written into destination
/// file
/// * `read_to_end` - in "true" will continue iterating stream after all ranges
/// are processed; in "false" will stop listening to a stream as soon as all ranges
/// are processed. It should be used in "true" for example if exporting applied
/// to concatenated files.
/// * `cancel` - cancellation token to stop operation
///
/// # Errors
/// In case of cancellation will return ExportError::Cancelled
pub async fn export_raw<S, T>(
    mut s: S,
    destination_path: &Path,
    sections: &Vec<IndexSection>,
    read_to_end: bool,
    text_file: bool,
    cancel: &CancellationToken,
) -> Result<usize, ExportError>
where
    T: LogMessage + Sized,
    S: futures::Stream<Item = Vec<(usize, MessageStreamItem<T>)>> + Unpin,
{
    trace!("export_raw, sections: {sections:?}");
    if !sections_valid(sections) {
        return Err(ExportError::Config("Invalid sections".to_string()));
    }
    let out_file = if destination_path.exists() {
        std::fs::OpenOptions::new()
            .append(true)
            .open(destination_path)?
    } else {
        std::fs::File::create(destination_path)?
    };
    let mut out_writer = BufWriter::new(out_file);
    let mut section_index = 0usize;
    let mut current_index = 0usize;
    let mut inside = false;
    let mut exported = 0usize;
    if sections.is_empty() {
        debug!("no sections configured");
        // export everything
        while let Some(items) = s.next().await {
            if cancel.is_cancelled() {
                return Err(ExportError::Cancelled);
            }

            for (_, item) in items {
                let written = match item {
                    MessageStreamItem::Item(ParseYield::Message(msg)) => {
                        msg.to_writer(&mut out_writer)?;
                        true
                    }
                    MessageStreamItem::Item(ParseYield::MessageAndAttachment((msg, _))) => {
                        msg.to_writer(&mut out_writer)?;
                        true
                    }
                    MessageStreamItem::Done => break,
                    _ => false,
                };
                if written && text_file {
                    out_writer.write_all("\n".as_bytes())?;
                }
                if written {
                    exported += 1;
                }
            }
        }
        return Ok(exported);
    }

    while let Some(items) = s.next().await {
        if cancel.is_cancelled() {
            return Err(ExportError::Cancelled);
        }
        for (_, item) in items {
            if !inside {
                if sections[section_index].first_line == current_index {
                    inside = true;
                }
            } else if sections[section_index].last_line < current_index {
                inside = false;
                section_index += 1;
                if sections.len() <= section_index {
                    // no more sections
                    if matches!(item, MessageStreamItem::Item(_)) {
                        current_index += 1;
                    }
                    break;
                }
                // check if we are in next section again
                if sections[section_index].first_line == current_index {
                    inside = true;
                }
            }
            let written = match item {
                MessageStreamItem::Item(ParseYield::Message(msg)) => {
                    if inside {
                        msg.to_writer(&mut out_writer)?;
                    }
                    current_index += 1;
                    inside
                }
                MessageStreamItem::Item(ParseYield::MessageAndAttachment((msg, _))) => {
                    if inside {
                        msg.to_writer(&mut out_writer)?;
                    }
                    current_index += 1;
                    inside
                }
                MessageStreamItem::Done => {
                    debug!("No more messages to export");
                    break;
                }
                _ => false,
            };
            if written && text_file {
                out_writer.write_all("\n".as_bytes())?;
            }
        }
    }
    if read_to_end {
        while let Some(items) = s.next().await {
            if cancel.is_cancelled() {
                return Err(ExportError::Cancelled);
            }
            for (_, item) in items {
                match item {
                    MessageStreamItem::Item(_) => {
                        current_index += 1;
                    }
                    MessageStreamItem::Done => {
                        break;
                    }
                    _ => {}
                }
            }
        }
    }
    debug!("export_raw done ({current_index} messages)");
    Ok(current_index)
}

fn sections_valid(sections: &[IndexSection]) -> bool {
    let pairs = sections.iter().zip(sections.iter().skip(1));
    for p in pairs {
        if p.0.last_line >= p.1.first_line {
            // overlap
            return false;
        }
    }
    sections.iter().all(|s| s.first_line <= s.last_line)
}

#[test]
fn test_sections_valid_valid_single_section() {
    let sections = vec![IndexSection {
        first_line: 0,
        last_line: 2,
    }];
    assert!(sections_valid(&sections));
}
#[test]
fn test_sections_valid_validity_valid_sections_no_gap() {
    let sections = vec![
        IndexSection {
            first_line: 0,
            last_line: 2,
        },
        IndexSection {
            first_line: 3,
            last_line: 4,
        },
    ];
    assert!(sections_valid(&sections));
}
#[test]
fn test_sections_valid_invalidity_valid_single_section() {
    let sections = vec![IndexSection {
        first_line: 2,
        last_line: 1,
    }];
    assert!(!sections_valid(&sections));
}
#[test]
fn test_sections_valid_empty_sections() {
    let sections = vec![];
    assert!(sections_valid(&sections));
}
#[test]
fn test_sections_valid_invalidity_overlapping() {
    let sections = vec![
        IndexSection {
            first_line: 1,
            last_line: 4,
        },
        IndexSection {
            first_line: 9,
            last_line: 11,
        },
        IndexSection {
            first_line: 11,
            last_line: 15,
        },
    ];
    assert!(!sections_valid(&sections));
}
