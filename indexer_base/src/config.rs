use std::path;
use std::fs;

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