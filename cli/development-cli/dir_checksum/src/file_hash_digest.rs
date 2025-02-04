use std::path::PathBuf;

use crate::hash_digest::HashDigest;

/// Holds the checksum for a file with its path
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct FileHashDigest {
    pub path: PathBuf,
    /// The calculated checksum value
    pub hash_digest: HashDigest,
}

impl FileHashDigest {
    pub fn new(path: PathBuf, hash_digest: HashDigest) -> Self {
        Self { path, hash_digest }
    }
}
