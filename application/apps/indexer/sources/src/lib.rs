use itertools::Itertools;
use std::{fmt, fmt::Display};

#[cfg(test)]
#[macro_use]
extern crate lazy_static;

pub mod pcap;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Parse error: {0}")]
    Parse(String),
}

pub trait Parser<T: LogMessage> {
    fn parse<'a>(
        &self,
        input: &'a [u8],
        timestamp: Option<u64>,
    ) -> Result<(&'a [u8], Option<T>), Error>;
}

pub trait LineFormat {
    fn format_line(&self) -> String;
}

pub trait LogMessage: Display {
    fn as_stored_bytes(&self) -> Vec<u8>;
}

#[derive(Debug)]
pub enum MessageStreamItem<T: LogMessage> {
    Item(Vec<T>),
    Skipped,
    Incomplete,
    Empty,
    Done,
}

impl<T: LogMessage> fmt::Display for MessageStreamItem<T> {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Self::Item(v) => write!(f, "{}", v.iter().format(",")),
            Self::Skipped => write!(f, "Skipped"),
            Self::Incomplete => write!(f, "Incomplete"),
            Self::Empty => write!(f, "Empty"),
            Self::Done => write!(f, "Done"),
        }
    }
}
