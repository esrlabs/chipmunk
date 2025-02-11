//! Provides function to create and configure DLT parser.

use std::path::PathBuf;

use parsers::dlt::{FibexConfig, FibexDltMetadata};

/// Creates [`FibexDltMetadata`] instance from the provided paths for fibex files if any and if
/// they are valid.
// TODO: Change function signature to return error once `gather_fibex_data()` is `dlt-core` is
// changed to return Result instead of Option.
pub fn create_fibex_metadata(fibex_files: Vec<PathBuf>) -> Option<FibexDltMetadata> {
    let fibex_file_paths = fibex_files
        .into_iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect();

    parsers::dlt::gather_fibex_data(FibexConfig { fibex_file_paths })
}
