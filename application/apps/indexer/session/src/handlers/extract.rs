//! Includes Extractor functions which are used in charts.

use crate::operations::OperationResult;

use processor::search::{extractor::MatchesExtractor, filter::SearchFilter};
use std::path::PathBuf;

pub fn handle(
    target_file_path: PathBuf,
    filters: Vec<SearchFilter>,
) -> OperationResult<Vec<stypes::ExtractedMatchValue>> {
    let extractor = MatchesExtractor::new(target_file_path, filters);
    extractor
        .extract_matches()
        .map(Some)
        .map_err(|e| stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::OperationSearch,
            message: Some(format!(
                "Fail to execute extract search result operation. Error: {e}"
            )),
        })
}
