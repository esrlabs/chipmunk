//! Provides the output sink of a session, combining the message formatter with
//! the output file and the message counters.

use std::{
    fs::File,
    io::{BufWriter, Write as _},
    path::Path,
};

use anyhow::Context;
use parsers::LogMessage;

use super::{create_append_file_writer, format::MessageFormatter};

/// Writes produced messages to the output file and tracks how many of them were
/// written and how many the formatter dropped.
pub struct MessageWriter<W: MessageFormatter> {
    formatter: W,
    file_writer: BufWriter<File>,
    written: usize,
    filtered_out: usize,
}

impl<W: MessageFormatter> MessageWriter<W> {
    /// Creates or appends to the output file at `output_path`.
    pub fn new(output_path: &Path, formatter: W) -> anyhow::Result<Self> {
        let file_writer = create_append_file_writer(output_path)?;

        Ok(Self {
            formatter,
            file_writer,
            written: 0,
            filtered_out: 0,
        })
    }

    /// Writes the message unless the formatter's filter rejects it.
    ///
    /// Returns whether the message reached the output.
    pub fn write<M: LogMessage>(&mut self, msg: &M) -> anyhow::Result<bool> {
        if !self.formatter.write_msg(&mut self.file_writer, msg)? {
            self.filtered_out += 1;

            return Ok(false);
        }

        self.written += 1;

        Ok(true)
    }

    /// Flushes buffered output.
    pub fn flush(&mut self) -> anyhow::Result<()> {
        self.file_writer
            .flush()
            .context("Error while writing to output file")
    }

    /// Number of messages written to the output.
    pub fn written(&self) -> usize {
        self.written
    }

    /// Number of messages dropped by the preset filter.
    pub fn filtered_out(&self) -> usize {
        self.filtered_out
    }
}
