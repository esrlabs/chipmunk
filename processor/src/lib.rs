extern crate indexer_base;

pub mod parse;
pub mod processor;

#[cfg(all(test, not(target_os = "windows")))]
mod tests;
