use crate::{
    events::{CallbackEvent, NativeError, NativeErrorKind, SearchOperationResult},
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use indexer_base::progress::Severity;
use log::debug;
use processor::search::{FilterStats, SearchFilter, SearchHolder, SearchResults};
use tokio::{
    select,
    sync::mpsc::{channel, Receiver, Sender},
    task,
    time::{timeout, Duration},
};

const TRACKING_INTERVAL_MS: u64 = 250;

type SearchResultChannel = (
    Sender<(SearchHolder, SearchResults)>,
    Receiver<(SearchHolder, SearchResults)>,
);

pub async fn handle(
    operation_api: &OperationAPI,
    filters: Vec<SearchFilter>,
    //mut search_grabber,
    //mut search_holder,
    state: SessionStateAPI,
) -> OperationResult<SearchOperationResult> {
    debug!("RUST: Search operation is requested");
    state.drop_search().await?;
    if filters.is_empty() {
        debug!("RUST: Search will be dropped. Filters are empty");
        operation_api.emit(CallbackEvent::SearchUpdated(0));
        Ok(Some(SearchOperationResult {
            found: 0,
            stats: FilterStats::new(vec![]),
        }))
    } else {
        let mut search_holder = state.get_search_holder(operation_api.id()).await?;
        search_holder.set_filters(&mut filters.iter());
        let search_res_file = search_holder.out_file_path.clone();
        let (tx_result, mut rx_result): SearchResultChannel = channel(1);
        let cancel = operation_api.get_cancellation_token();
        let cancel_search = operation_api.get_cancellation_token();
        task::spawn(async move {
            let search_results = search_holder.execute_search(cancel_search.clone());
            if !cancel_search.is_cancelled()
                && tx_result
                    .send((search_holder, search_results))
                    .await
                    .is_ok()
            {}
        });
        let search_results = select! {
            res = async {
                loop {
                    match timeout(
                        Duration::from_millis(TRACKING_INTERVAL_MS as u64),
                        rx_result.recv(),
                    )
                    .await
                    {
                        Ok(recv_results) => {
                            break recv_results.map_or(
                                Err(NativeError {
                                    severity: Severity::ERROR,
                                    kind: NativeErrorKind::OperationSearch,
                                    message: Some("Fail to receive search results".to_string()),
                                }),
                                |(search_holder, search_results)| {
                                    search_results
                                        .map(|(file_path, matches, stats)| {
                                            (file_path, matches.len(), matches, stats, search_holder)
                                        })
                                        .map_err(|err| NativeError {
                                            severity: Severity::ERROR,
                                            kind: NativeErrorKind::OperationSearch,
                                            message: Some(format!(
                                                "Fail to execute search. Error: {}",
                                                err
                                            )),
                                        })
                                },
                            );
                        }
                        Err(_) => {
                            if !cancel.is_cancelled() {
                                match state.update_search_result(operation_api.id(), &search_res_file).await {
                                    Ok(found) => {
                                        operation_api.emit(CallbackEvent::SearchUpdated(found as u64));
                                    }
                                    Err(err) => {
                                        break Err(err);
                                    }
                                }
                            }
                        },
                    };
                }
            } => Some(res),
            _ = cancel.cancelled() => {
                None
            }
        };
        if let Some(search_results) = search_results {
            match search_results {
                Ok((file_path, found, matches, stats, search_holder)) => {
                    state
                        .set_search_holder(Some(search_holder), operation_api.id())
                        .await?;
                    state.set_matches(Some(matches)).await?;
                    if found == 0 {
                        operation_api.emit(CallbackEvent::SearchUpdated(0));
                        Ok(Some(SearchOperationResult { found, stats }))
                    } else {
                        state
                            .update_search_result(operation_api.id(), &file_path)
                            .await?;
                        operation_api.emit(CallbackEvent::SearchUpdated(found as u64));
                        Ok(Some(SearchOperationResult { found, stats }))
                    }
                }
                Err(err) => Err(err),
            }
        } else {
            // Here should not be uuid at all.
            // We should not recreate holder, but just drop into NotInited
            state.set_search_holder(None, operation_api.id()).await?;
            state.drop_search().await?;
            operation_api.emit(CallbackEvent::SearchUpdated(0));
            Ok(Some(SearchOperationResult {
                found: 0,
                stats: FilterStats::new(vec![]),
            }))
        }
    }
}
