use crate::js::events::{NativeError, NativeErrorKind};
use indexer_base::progress::Severity;

use processor::search::{ExtractedMatchValue, MatchesExtractor, SearchFilter};
use std::path::Path;

pub fn handle<'a, I>(
    target_file_path: &Path,
    filters: I,
) -> Result<Vec<ExtractedMatchValue>, NativeError>
where
    I: Iterator<Item = &'a SearchFilter>,
{
    let extractor = MatchesExtractor::new(target_file_path, filters);
    extractor.extract_matches().map_err(|e| NativeError {
        severity: Severity::ERROR,
        kind: NativeErrorKind::OperationSearch,
        message: Some(format!(
            "Fail to execute extract search result operation. Error: {}",
            e
        )),
    })
}
