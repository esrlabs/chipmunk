use crate::{
    events::{CallbackEvent, NativeError, NativeErrorKind, SearchOperationResult},
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use indexer_base::progress::Severity;
use log::debug;
use processor::search::{FilterStats, SearchFilter, SearchHolder};
use std::path::PathBuf;

pub async fn handle(
    operation_api: &OperationAPI,
    target_file: PathBuf,
    filters: Vec<SearchFilter>,
    state: SessionStateAPI,
) -> OperationResult<SearchOperationResult> {
    debug!("RUST: Search operation is requested");
    if filters.is_empty() {
        debug!("RUST: Search will be dropped. Filters are empty");
        state.drop_search().await?;
        operation_api.emit(CallbackEvent::SearchUpdated(0));
        Ok(Some(SearchOperationResult {
            found: 0,
            stats: FilterStats::new(vec![]),
        }))
    } else {
        let search_holder = SearchHolder::new(&target_file, filters.iter());
        let search_results = match search_holder.execute_search() {
            Ok((file_path, matches, stats)) => Ok((file_path, matches.len(), matches, stats)),
            Err(err) => {
                return Err(NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::OperationSearch,
                    message: Some(format!("Fail to execute search. Error: {}", err)),
                });
            }
        };
        match search_results {
            Ok((file_path, found, matches, stats)) => {
                state.set_matches(Some(matches)).await?;
                if found == 0 {
                    state.drop_search().await?;
                    operation_api.emit(CallbackEvent::SearchUpdated(0));
                    Ok(Some(SearchOperationResult { found, stats }))
                } else {
                    state.set_search_result_file(file_path.clone()).await?;
                    state.update_search_result().await?;
                    operation_api.emit(CallbackEvent::SearchUpdated(found as u64));
                    Ok(Some(SearchOperationResult { found, stats }))
                }
            }
            Err(err) => Err(err),
        }
    }
}
