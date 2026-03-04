//! Includes the implementation of spawning search task, handling getting the results and
//! cancelling the task when requested.

use crate::{
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use log::debug;
use processor::{
    map::FiltersStats,
    search::{
        filter::SearchFilter,
        searchers::{self, regular::RegularSearchHolder},
    },
};
use tokio::{
    select,
    sync::mpsc::{Receiver, Sender, channel},
    task,
    time::{Duration, sleep, timeout},
};

const TRACKING_INTERVAL_MS: u64 = 250;

type SearchResultChannel = (
    Sender<(RegularSearchHolder, searchers::regular::SearchResults)>,
    Receiver<(RegularSearchHolder, searchers::regular::SearchResults)>,
);

type SearchOutputResult =
    Result<SearchOutput, (Option<Box<RegularSearchHolder>>, stypes::NativeError)>;

#[derive(Debug)]
struct SearchOutput {
    matches: Vec<stypes::FilterMatch>,
    stats: FiltersStats,
    holder: RegularSearchHolder,
}

/// Waits until the previous search holder is dropped before starting a
/// replacement search.
///
/// Search cancellation and holder release happen on separate async paths.
/// During rapid re-apply, `drop_search` can temporarily report `false` even
/// though release is still progressing. We bound retries to keep this handover
/// window tolerant without risking an unbounded wait.
async fn wait_until_search_dropped(state: &SessionStateAPI) -> Result<(), stypes::NativeError> {
    const RETRY_ATTEMPTS: u8 = 10;
    const RETRY_DELAY_MS: u64 = 15;

    for attempt in 0..RETRY_ATTEMPTS {
        if state.drop_search().await? {
            return Ok(());
        }
        if attempt + 1 < RETRY_ATTEMPTS {
            sleep(Duration::from_millis(RETRY_DELAY_MS)).await;
        }
    }

    Err(stypes::NativeError {
        severity: stypes::Severity::ERROR,
        kind: stypes::NativeErrorKind::OperationSearch,
        message: Some(format!(
            "Previous search holder is still in use after {RETRY_ATTEMPTS} drop attempts.",
        )),
    })
}

pub async fn execute_search(
    operation_api: &OperationAPI,
    filters: Vec<SearchFilter>,
    state: SessionStateAPI,
) -> OperationResult<u64> {
    debug!("RUST: Search operation is requested");
    wait_until_search_dropped(&state).await?;
    let (rows, read_bytes) = state.get_stream_len().await?;
    let mut holder = state.get_search_holder(operation_api.id()).await?;
    if let Err(err) = holder
        .setup(filters.clone())
        .map_err(|e| stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::OperationSearch,
            message: Some(format!("Fail to setup search terms: {e}")),
        })
    {
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
        let search_results: Option<SearchOutputResult> = select! {
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
                                Err((None, stypes::NativeError {
                                    severity: stypes::Severity::ERROR,
                                    kind: stypes::NativeErrorKind::OperationSearch,
                                    message: Some("Fail to receive search results".to_string()),
                                })),
                                |(holder, search_results)| {
                                    match search_results {
                                        Ok((_processed, matches, stats)) => Ok(SearchOutput {matches, stats, holder}),
                                        Err(err) => Err((Some(Box::new(holder)), stypes::NativeError {
                                            severity: stypes::Severity::ERROR,
                                            kind: stypes::NativeErrorKind::OperationSearch,
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
                Ok(res) => {
                    let SearchOutput {
                        matches,
                        stats,
                        holder,
                    } = res;
                    let found = matches.len();
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
                            .set_search_holder(Some(*holder), operation_api.id())
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
