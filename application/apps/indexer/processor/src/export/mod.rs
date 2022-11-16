use std::{io::BufWriter, path::Path};

use futures::StreamExt;
use indexer_base::config::IndexSection;
use parsers::{LogMessage, MessageStreamItem};
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

/// Exporting data as raw into given destination. Would be exported only data
/// defined in selections as indexes of rows (messages).
/// Returns (usize, usize) - (exported_count, read_count)
/// read_count is equal to total count of messages (rows) in source.
pub async fn export_raw<S, T>(
    mut s: S,
    destination_path: &Path,
    sections: &Vec<IndexSection>,
    cancel: &CancellationToken,
) -> Result<(usize, usize), ExportError>
where
    T: LogMessage + Sized,
    S: futures::Stream<Item = (usize, MessageStreamItem<T>)> + Unpin,
{
    trace!("export_raw, sections: {sections:?}");
    if !sections_valid(sections) {
        return Err(ExportError::Config("Invalid sections".to_string()));
    }
    let out_file = std::fs::File::create(destination_path)?;
    let mut out_writer = BufWriter::new(out_file);
    let mut section_index = 0usize;
    let mut current_index = 0usize;
    let mut inside = false;
    let mut exported = 0usize;
    if sections.is_empty() {
        debug!("no sections configured");
        // export everything
        while let Some((_, item)) = s.next().await {
            if cancel.is_cancelled() {
                return Err(ExportError::Cancelled);
            }
            match item {
                MessageStreamItem::Item(i) => {
                    i.to_writer(&mut out_writer)?;
                    exported += 1;
                }
                MessageStreamItem::Skipped => {}
                MessageStreamItem::Incomplete => {}
                MessageStreamItem::Empty => {}
                MessageStreamItem::Done => break,
            }
        }
        return Ok((exported, exported));
    }

    while let Some((_, item)) = s.next().await {
        if cancel.is_cancelled() {
            return Err(ExportError::Cancelled);
        }
        if !inside {
            if sections[section_index].first_line == current_index {
                inside = true;
            }
        } else if sections[section_index].last_line < current_index {
            inside = false;
            section_index += 1;
            if sections.len() <= section_index {
                // no more sections
                break;
            }
            // check if we are in next section again
            if sections[section_index].first_line == current_index {
                inside = true;
            }
        }
        match item {
            MessageStreamItem::Item(i) => {
                if inside {
                    i.to_writer(&mut out_writer)?;
                    exported += 1;
                }
                current_index += 1;
            }
            MessageStreamItem::Skipped => {}
            MessageStreamItem::Incomplete => {}
            MessageStreamItem::Empty => {}
            MessageStreamItem::Done => {
                println!("No more messages to export");
                break;
            }
        }
    }
    debug!("export_raw done ({exported} messages)");
    Ok((exported, current_index))
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
