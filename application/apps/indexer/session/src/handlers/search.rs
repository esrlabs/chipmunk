use crate::{
    events::{NativeError, NativeErrorKind},
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use indexer_base::progress::Severity;
use log::debug;
use processor::search::{SearchFilter, SearchHolder, SearchResults};
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
    state: SessionStateAPI,
) -> OperationResult<u64> {
    debug!("RUST: Search operation is requested");
    state.drop_search().await?;
    let session_file_len = state.get_stream_len().await? as u64;
    if filters.is_empty() {
        debug!("RUST: Search will be dropped. Filters are empty");
        Ok(Some(0))
    } else {
        let mut search_holder = state.get_search_holder(operation_api.id()).await?;
        search_holder.set_filters(&mut filters.iter());
        let (tx_result, mut rx_result): SearchResultChannel = channel(1);
        let cancel = operation_api.cancellation_token();
        let cancel_search = operation_api.cancellation_token();
        task::spawn(async move {
            let search_results =
                search_holder.execute_search(session_file_len, cancel_search.clone());
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
                        Duration::from_millis(TRACKING_INTERVAL_MS),
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
                                        .map(|(processed, matches, stats)| {
                                            (processed, matches.len(), matches, stats, search_holder)
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
                                state.set_matches(None, None).await?;
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
                Ok((_processed, found, matches, stats, search_holder)) => {
                    state
                        .set_search_holder(Some(search_holder), operation_api.id())
                        .await?;
                    // stats - isn't big object, it's small hashmap and clone operation here will not decrease performance.
                    // even this happens just once per search
                    state.set_matches(Some(matches), Some(stats)).await?;
                    Ok(Some(found as u64))
                }
                Err(err) => Err(err),
            }
        } else {
            // Here should not be uuid at all.
            // We should not recreate holder, but just drop into NotInited
            state.set_search_holder(None, operation_api.id()).await?;
            state.drop_search().await?;
            Ok(Some(0))
        }
    }
}
