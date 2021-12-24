use crate::{
    events::{CallbackEvent, NativeError, NativeErrorKind, SearchOperationResult},
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use crossbeam_channel as cc;
use indexer_base::progress::{ComputationResult, Progress, Severity};
use log::debug;
use processor::{
    grabber::GrabMetadata,
    search::{FilterStats, SearchFilter, SearchHolder},
    text_source::TextFileSource,
};
use std::path::{Path, PathBuf};

pub async fn handle(
    operation_api: &OperationAPI,
    target_file: PathBuf,
    filters: Vec<SearchFilter>,
    search_metadata_tx: &cc::Sender<Option<(PathBuf, GrabMetadata)>>,
    state: SessionStateAPI,
) -> OperationResult<SearchOperationResult> {
    debug!("RUST: Search operation is requested");
    if filters.is_empty() {
        debug!("RUST: Search will be dropped. Filters are empty");
        // This is dropping of search
        search_metadata_tx.send(None).expect("UpdateChannel closed");
        operation_api.emit(CallbackEvent::SearchUpdated(0));
        Ok(Some(SearchOperationResult {
            found: 0,
            stats: FilterStats::new(vec![]),
        }))
    } else {
        let search_results = run_search(&target_file, filters.iter(), state).await;
        match search_results {
            Ok((file_path, found, stats)) => {
                if found == 0 {
                    search_metadata_tx.send(None).expect("UpdateChannel closed");
                    operation_api.emit(CallbackEvent::SearchUpdated(0));
                    Ok(Some(SearchOperationResult { found, stats }))
                } else {
                    let mut source = TextFileSource::new(&file_path, "search_results");
                    let metadata_res = source.from_file(None);
                    match metadata_res {
                        Ok(ComputationResult::Item(metadata)) => {
                            debug!("RUST: received search metadata");
                            let line_count = metadata.line_count as u64;
                            search_metadata_tx
                                .send(Some((file_path, metadata)))
                                .expect("UpdateChannel closed");
                            operation_api.emit(CallbackEvent::SearchUpdated(line_count));
                            Ok(Some(SearchOperationResult { found, stats }))
                        }
                        Ok(ComputationResult::Stopped) => {
                            debug!("RUST: search metadata calculation aborted");
                            operation_api.emit(CallbackEvent::Progress {
                                uuid: operation_api.id(),
                                progress: Progress::Stopped,
                            });
                            Ok(None)
                        }
                        Err(e) => {
                            let err_msg = format!("RUST error computing search metadata: {:?}", e);
                            Err(NativeError {
                                severity: Severity::WARNING,
                                kind: NativeErrorKind::ComputationFailed,
                                message: Some(err_msg),
                            })
                        }
                    }
                }
            }
            Err(err) => Err(err),
        }
    }
}

async fn run_search<'a, I>(
    target_file_path: &Path,
    filters: I,
    state: SessionStateAPI,
) -> Result<(PathBuf, usize, FilterStats), NativeError>
where
    I: Iterator<Item = &'a SearchFilter>,
{
    let search_holder = SearchHolder::new(target_file_path, filters);
    match search_holder.execute_search() {
        Ok((file_path, matches, stats)) => {
            let found = matches.len();
            state.set_matches(Some(matches)).await?;
            Ok((file_path, found, stats))
        }
        Err(err) => Err(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::OperationSearch,
            message: Some(format!("Fail to execute search. Error: {}", err)),
        }),
    }
}
