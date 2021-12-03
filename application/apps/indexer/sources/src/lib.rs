use std::fmt::Display;

#[cfg(test)]
#[macro_use]
extern crate lazy_static;

pub mod pcap;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    // #[error("IO error: {0:?}")]
    // Io(#[from] std::io::Error),
    #[error("Parse error: {0}")]
    Parse(String),
}

// pub trait SimpleParser {
//     fn parse<'a>(
//         &self,
//         input: &'a [u8],
//         timestamp: Option<u64>,
//     ) -> Result<(&'a [u8], Option<(Vec<u8>, String)>), Error>;
// }

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

// implement LogMessage for DltMessage
// trait SizedFormat<T>: LineFormat<T> + std::marker::Sized {}
