use std::borrow::Cow;

use crate::*;
use serde::Serialize;

pub const COLUMN_SENTINAL: char = '\u{0004}';

#[derive(Debug, Clone, Serialize)]
pub struct Attachment {
    pub name: String,
    pub size: usize,
    pub created_date: Option<String>,
    pub modified_date: Option<String>,
    /// The indexes of the message within the original trace (0-based).
    pub messages: Vec<usize>,
    pub data: Vec<u8>,
}

impl Attachment {
    pub fn add_data(&mut self, new_data: &[u8]) {
        self.data.extend_from_slice(new_data);
    }
}

#[derive(Debug)]
pub struct ParseOperationResult {
    /// Number of consumed bytes
    pub consumed: usize,
    /// Count of parsed and sent messages
    pub count: usize,
}

impl ParseOperationResult {
    pub fn new(consumed: usize, count: usize) -> Self {
        Self { consumed, count }
    }
    pub fn parsed_any_msg(&self) -> bool {
        self.count > 0
    }
}
pub enum LogRecordOutput<'a> {
    Raw(&'a [u8]),
    Str(&'a str),
    Cow(Cow<'a, str>),
    String(String),
    Columns(&'a [&'a str]),
    Attachment(Attachment),
    Multiple(Vec<LogRecordOutput<'a>>),
}

#[allow(async_fn_in_trait)]
pub trait LogRecordWriter {
    async fn write(&mut self, record: LogRecordOutput<'_>) -> Result<(), stypes::NativeError>;
}
