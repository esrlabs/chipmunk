use crate::{
    chunks::ChunkResults,
    config::SectionConfig,
    progress::{IndexingProgress, Notification, Severity},
    utils::restore_line,
};
use crossbeam_channel as cc;
use std::{
    fs,
    io::{BufRead, BufWriter, Write},
};

use std::path::PathBuf;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Unexpected value found: {0}")]
    Export(String),
    #[error("IO error: {0:?}")]
    Io(#[from] std::io::Error),
}

/// will save sections of a file that is based on lines (newlines)
/// and remove session file data if required (if `was_session_file` is true)
pub fn export_file_line_based(
    file_path: PathBuf,
    destination_path: PathBuf,
    sections: SectionConfig,
    was_session_file: bool,
    update_channel: cc::Sender<ChunkResults>,
) -> Result<(), Error> {
    trace!(
        "export_file_line_based {:?} to file: {:?}, exporting {:?} ({})",
        file_path,
        destination_path,
        sections,
        if was_session_file {
            "cleanup session file"
        } else {
            "no cleanup required"
        }
    );
    if file_path.exists() {
        trace!("found file to export: {:?}", &file_path);
        let f = fs::File::open(&file_path)?;
        let reader = &mut std::io::BufReader::new(f);
        let out_file = std::fs::File::create(destination_path)?;
        let lines_iter = &mut reader.lines();
        let mut out_writer = BufWriter::new(out_file);
        // check if we have to export the whole file
        if sections.sections.is_empty() {
            for elem in lines_iter {
                if was_session_file {
                    out_writer.write_fmt(format_args!("{}\n", restore_line(&elem?)))?;
                } else {
                    out_writer.write_fmt(format_args!("{}\n", elem?))?;
                }
            }
        } else {
            let mut index = 0usize;
            for section in sections.sections {
                let forward = section.first_line - index;
                /* since section [1,2] is 2 lines, we have to add 1 here */
                let section_size = section.last_line - section.first_line + 1;
                let elem_iter = lines_iter.skip(forward).take(section_size);
                for elem in elem_iter {
                    if was_session_file {
                        out_writer.write_fmt(format_args!("{}\n", restore_line(&elem?)))?;
                    } else {
                        out_writer.write_fmt(format_args!("{}\n", elem?))?;
                    }
                }
                index += forward;
                index += section_size;
            }
        }

        let _ = update_channel.send(Ok(IndexingProgress::Finished));
        Ok(())
    } else {
        let reason = format!("couln't find session file: {:?}", file_path,);
        let _ = update_channel.send(Err(Notification {
            severity: Severity::ERROR,
            content: reason.clone(),
            line: None,
        }));
        Err(Error::Export(reason))
    }
}
