use crate::js::{
    events::{CallbackEvent, NativeError, NativeErrorKind, SearchOperationResult},
    session::SessionState,
    session_operations as sop,
};
use crossbeam_channel as cc;
use indexer_base::progress::{ComputationResult, Progress, Severity};
use log::debug;
use processor::{
    grabber::{GrabMetadata, MetadataSource},
    search::{FilterStats, SearchFilter, SearchHolder},
    text_source::TextFileSource,
};
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub fn handle(
    target_file: PathBuf,
    filters: Vec<SearchFilter>,
    operation_id: Uuid,
    search_metadata_tx: &cc::Sender<Option<(PathBuf, GrabMetadata)>>,
    state: &mut SessionState,
) -> Vec<CallbackEvent> {
    debug!("RUST: Search operation is requested");
    if filters.is_empty() {
        debug!("RUST: Search will be dropped. Filters are empty");
        // This is dropping of search
        let _ = search_metadata_tx.send(None);
        vec![
            CallbackEvent::SearchUpdated(0),
            sop::map_to_event(
                &SearchOperationResult {
                    found: 0,
                    stats: FilterStats::new(vec![]),
                },
                operation_id,
            ),
        ]
    } else {
        let search_results = run_search(&target_file, filters.iter(), state);
        match search_results {
            Ok((file_path, found, stats)) => {
                if found == 0 {
                    let _ = search_metadata_tx.send(None);
                    vec![
                        CallbackEvent::SearchUpdated(0),
                        sop::map_to_event(&SearchOperationResult { found, stats }, operation_id),
                    ]
                } else {
                    let source = TextFileSource::new(&file_path, "search_results");
                    let metadata_res = source.from_file(None);
                    match metadata_res {
                        Ok(ComputationResult::Item(metadata)) => {
                            debug!("RUST: received search metadata");
                            let line_count = metadata.line_count as u64;
                            let _ = search_metadata_tx.send(Some((file_path, metadata)));
                            vec![
                                CallbackEvent::SearchUpdated(line_count),
                                sop::map_to_event(
                                    &SearchOperationResult { found, stats },
                                    operation_id,
                                ),
                            ]
                        }
                        Ok(ComputationResult::Stopped) => {
                            debug!("RUST: search metadata calculation aborted");
                            vec![CallbackEvent::Progress {
                                uuid: operation_id,
                                progress: Progress::Stopped,
                            }]
                        }
                        Err(e) => {
                            let err_msg = format!("RUST error computing search metadata: {:?}", e);
                            vec![CallbackEvent::OperationError {
                                uuid: operation_id,
                                error: NativeError {
                                    severity: Severity::WARNING,
                                    kind: NativeErrorKind::ComputationFailed,
                                    message: Some(err_msg),
                                },
                            }]
                        }
                    }
                }
            }
            Err(e) => vec![CallbackEvent::OperationError {
                uuid: operation_id,
                error: e,
            }],
        }
    }
}

fn run_search<'a, I>(
    target_file_path: &Path,
    filters: I,
    state: &mut SessionState,
) -> Result<(PathBuf, usize, FilterStats), NativeError>
where
    I: Iterator<Item = &'a SearchFilter>,
{
    let search_holder = SearchHolder::new(target_file_path, filters);
    match search_holder.execute_search() {
        Ok((file_path, matches, stats)) => {
            let found = matches.len();
            state.search_map.set(Some(matches));
            Ok((file_path, found, stats))
        }
        Err(err) => Err(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::OperationSearch,
            message: Some(format!("Fail to execute search. Error: {}", err)),
        }),
    }
}
