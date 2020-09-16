use std::path;

#[derive(Debug)]
pub struct IndexingThreadConfig {
    pub in_file: path::PathBuf,
    pub out_path: path::PathBuf,
    pub append: bool,
    pub tag: String,
    pub timestamps: bool,
}
