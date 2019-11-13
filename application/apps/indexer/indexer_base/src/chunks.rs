// Copyright (c) 2019 E.S.R.Labs. All rights reserved.
//
// NOTICE:  All information contained herein is, and remains
// the property of E.S.R.Labs and its suppliers, if any.
// The intellectual and technical concepts contained herein are
// proprietary to E.S.R.Labs and its suppliers and may be covered
// by German and Foreign Patents, patents in process, and are protected
// by trade secret or copyright law.
// Dissemination of this information or reproduction of this material
// is strictly forbidden unless prior written permission is obtained
// from E.S.R.Labs.
use serde::{Deserialize, Serialize};
use serde_json::Result;
use std::fs;
use crate::progress::{IndexingProgress, Notification};

pub type ChunkResults = std::result::Result<IndexingProgress<Chunk>, Notification>;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Chunk {
    pub r: (usize, usize),
    pub b: (usize, usize),
}
pub fn serialize_chunks(chunks: &[Chunk], out_file_name: &std::path::Path) -> Result<()> {
    // Serialize it to a JSON string.
    let j = serde_json::to_string(chunks)?;
    fs::write(out_file_name, j).expect("Unable to write file");
    Ok(())
}
pub struct ChunkFactory {
    pub chunk_size: usize, // how many lines in one chunk?
    pub to_stdout: bool,   // write chunks to stdout
    pub start_of_chunk_byte_index: usize,
    last_line_current_chunk: usize,
    current_byte_index: usize,
    lines_in_chunk: usize,
}

impl ChunkFactory {
    pub fn new(
        chunk_size: usize,
        to_stdout: bool,
        start_of_chunk_byte_index: usize,
    ) -> ChunkFactory {
        ChunkFactory {
            chunk_size,
            to_stdout,
            start_of_chunk_byte_index,
            current_byte_index: start_of_chunk_byte_index,
            last_line_current_chunk: 0,
            lines_in_chunk: 0,
        }
    }
    pub fn get_current_byte_index(&self) -> usize {
        self.current_byte_index
    }
    pub fn create_chunk_if_needed(
        &mut self,
        line_nr: usize,
        additional_bytes: usize,
    ) -> Option<Chunk> {
        self.current_byte_index += additional_bytes;
        self.lines_in_chunk += 1;
        // check if we need to construct a new mapping chunk
        if self.lines_in_chunk >= self.chunk_size {
            self.last_line_current_chunk = line_nr;
            let chunk = Chunk {
                r: (
                    self.last_line_current_chunk - self.lines_in_chunk,
                    self.last_line_current_chunk - 1,
                ),
                b: (self.start_of_chunk_byte_index, self.current_byte_index),
            };
            if self.to_stdout {
                if let Ok(c) = serde_json::to_string(&chunk) {
                    println!("{}", c);
                }
            }

            self.start_of_chunk_byte_index = self.current_byte_index + 1;
            self.lines_in_chunk = 0;
            return Some(chunk);
        }
        None
    }
    pub fn create_last_chunk(&mut self, line_nr: usize, only_chunk: bool) -> Option<Chunk> {
        // only add junk if we produced any output lines
        if line_nr > 0 && self.start_of_chunk_byte_index != self.current_byte_index {
            // check if we still need to spit out a chunk
            if line_nr > self.last_line_current_chunk || only_chunk {
                self.last_line_current_chunk = line_nr;
                let chunk = Chunk {
                    r: (
                        self.last_line_current_chunk - self.lines_in_chunk,
                        self.last_line_current_chunk - 1,
                    ),
                    b: (self.start_of_chunk_byte_index, self.current_byte_index),
                };
                if self.to_stdout {
                    println!(
                        "{}",
                        serde_json::to_string(&chunk).expect("chunk could not be serialized")
                    );
                }
                return Some(chunk);
            }
        }
        None
    }
}
