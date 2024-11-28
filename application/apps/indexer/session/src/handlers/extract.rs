use crate::operations::OperationResult;

use processor::search::{
    extractor::{ExtractedMatchValue, MatchesExtractor},
    filter::SearchFilter,
};
use std::path::Path;

pub fn handle<'a, I>(
    target_file_path: &Path,
    filters: I,
) -> OperationResult<Vec<ExtractedMatchValue>>
where
    I: Iterator<Item = &'a SearchFilter>,
{
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
