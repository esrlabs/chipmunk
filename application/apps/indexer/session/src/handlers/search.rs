use crate::{
    events::{NativeError, NativeErrorKind},
    operations::{OperationAPI, OperationResult},
    progress::Severity,
    state::SessionStateAPI,
};
use log::debug;
use processor::{
    map::{FilterMatch, FiltersStats},
    search::{
        filter::SearchFilter,
        searchers::{self, regular::RegularSearchHolder},
    },
};
use std::ops::Range;
use tokio::{
    select,
    sync::mpsc::{channel, Receiver, Sender},
    task,
    time::{timeout, Duration},
};

const TRACKING_INTERVAL_MS: u64 = 250;

type SearchResultChannel = (
    Sender<(RegularSearchHolder, searchers::regular::SearchResults)>,
    Receiver<(RegularSearchHolder, searchers::regular::SearchResults)>,
);

#[allow(clippy::type_complexity)]
pub async fn execute_search(
    operation_api: &OperationAPI,
    filters: Vec<SearchFilter>,
    state: SessionStateAPI,
) -> OperationResult<u64> {
    debug!("RUST: Search operation is requested");
    state.drop_search().await?;
    let (rows, read_bytes) = state.get_stream_len().await?;
    let mut holder = state.get_search_holder(operation_api.id()).await?;
    if let Err(err) = holder.setup(filters.clone()).map_err(|e| NativeError {
        severity: Severity::ERROR,
        kind: NativeErrorKind::OperationSearch,
        message: Some(format!("Fail to setup search terms: {e}")),
    }) {
        state
            .set_search_holder(Some(holder), operation_api.id())
            .await?;
        return Err(err);
    }
    if filters.is_empty() {
        debug!("RUST: Search are dropped. Filters are empty");
        state
            .set_search_holder(Some(holder), operation_api.id())
            .await?;
        Ok(Some(0))
    } else {
        let (tx_result, mut rx_result): SearchResultChannel = channel(1);
        let cancel = operation_api.cancellation_token();
        let cancel_search = operation_api.cancellation_token();
        task::spawn(async move {
            let search_results =
                searchers::regular::search(&mut holder, rows, read_bytes, cancel_search.clone());

            if !cancel_search.is_cancelled()
                && tx_result.send((holder, search_results)).await.is_ok()
            {}
        });
        let search_results: Option<
            Result<
                (
                    Range<usize>,
                    usize,
                    Vec<FilterMatch>,
                    FiltersStats,
                    RegularSearchHolder,
                ),
                (Option<RegularSearchHolder>, NativeError),
            >,
        > = select! {
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
                                Err((None, NativeError {
                                    severity: Severity::ERROR,
                                    kind: NativeErrorKind::OperationSearch,
                                    message: Some("Fail to receive search results".to_string()),
                                })),
                                |(holder, search_results)| {
                                    match search_results {
                                        Ok((processed, matches, stats)) => Ok((processed, matches.len(), matches, stats, holder)),
                                        Err(err) => Err((Some(holder), NativeError {
                                            severity: Severity::ERROR,
                                            kind: NativeErrorKind::OperationSearch,
                                            message: Some(format!(
                                                "Fail to execute search. Error: {err}"
                                            )),
                                        }))

                                    }
                                },
                            );
                        }
                        Err(_) => {
                            if !cancel.is_cancelled() {
                                state.set_matches(None, None).await.map_err(|err| (None, err))?;
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
                Ok((_processed, found, matches, stats, holder)) => {
                    state
                        .set_search_holder(Some(holder), operation_api.id())
                        .await?;
                    // stats - isn't big object, it's small hashmap and clone operation here will not decrease performance.
                    // even this happens just once per search
                    state.set_matches(Some(matches), Some(stats)).await?;
                    Ok(Some(found as u64))
                }
                Err((holder, err)) => {
                    if let Some(holder) = holder {
                        state
                            .set_search_holder(Some(holder), operation_api.id())
                            .await?;
                    } else {
                        state.set_search_holder(None, operation_api.id()).await?;
                    }
                    state.drop_search().await?;
                    Err(err)
                }
            }
        } else {
            // We should not recreate holder, but just drop into NotInited
            state.set_search_holder(None, operation_api.id()).await?;
            state.drop_search().await?;
            Ok(Some(0))
        }
    }
}
