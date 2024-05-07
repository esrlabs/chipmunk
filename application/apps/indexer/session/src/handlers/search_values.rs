use crate::{
    events::{NativeError, NativeErrorKind},
    operations::{OperationAPI, OperationResult},
    progress::Severity,
    state::SessionStateAPI,
};
use log::debug;
use processor::search::searchers::{self, values::ValueSearchHolder};
use std::{collections::HashMap, ops::Range};
use tokio::{
    select,
    sync::mpsc::{channel, Receiver, Sender},
    task,
    time::{timeout, Duration},
};

const TRACKING_INTERVAL_MS: u64 = 250;

type SearchResultChannel = (
    Sender<(ValueSearchHolder, searchers::values::OperationResults)>,
    Receiver<(ValueSearchHolder, searchers::values::OperationResults)>,
);

#[allow(clippy::type_complexity)]
pub async fn execute_value_search(
    operation_api: &OperationAPI,
    filters: Vec<String>,
    state: SessionStateAPI,
) -> OperationResult<()> {
    debug!("RUST: Search values operation is requested");
    state.drop_search_values().await?;
    let (rows, read_bytes) = state.get_stream_len().await?;
    let mut holder = state.get_search_values_holder(operation_api.id()).await?;
    if let Err(err) = holder.setup(filters.clone()).map_err(|e| NativeError {
        severity: Severity::ERROR,
        kind: NativeErrorKind::OperationSearch,
        message: Some(format!("Fail to setup filters: {e}")),
    }) {
        state
            .set_search_values_holder(Some(holder), operation_api.id())
            .await?;
        return Err(err);
    }
    if filters.is_empty() {
        debug!("RUST: Search values are dropped. Filters are empty");
        state
            .set_search_values_holder(Some(holder), operation_api.id())
            .await?;
        Ok(Some(()))
    } else {
        let (tx_result, mut rx_result): SearchResultChannel = channel(1);
        let cancel = operation_api.cancellation_token();
        let cancel_search = operation_api.cancellation_token();
        task::spawn(async move {
            let search_results =
                searchers::values::search(&mut holder, rows, read_bytes, cancel_search.clone());
            if !cancel_search.is_cancelled()
                && tx_result.send((holder, search_results)).await.is_ok()
            {}
        });
        let search_results: Option<
            Result<
                (
                    Range<usize>,
                    HashMap<u8, Vec<(u64, f64)>>,
                    ValueSearchHolder,
                ),
                (Option<ValueSearchHolder>, NativeError),
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
                                    message: Some("Fail to receive search values results".to_string()),
                                })),
                                |(holder, search_results)| {
                                    match search_results {
                                        Ok((processed, values)) => Ok((processed, values, holder)),
                                        Err(err) => Err((Some(holder), NativeError {
                                            severity: Severity::ERROR,
                                            kind: NativeErrorKind::OperationSearch,
                                            message: Some(format!(
                                                "Fail to execute search values. Error: {err}"
                                            )),
                                        }))

                                    }
                                },
                            );
                        }
                        Err(_) => {
                            if !cancel.is_cancelled() {
                                state.drop_search_values().await.map_err(|err| (None, err))?;
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
                Ok((_processed, values, holder)) => {
                    state
                        .set_search_values_holder(Some(holder), operation_api.id())
                        .await?;
                    state.set_search_values(values).await?;
                    Ok(Some(()))
                }
                Err((holder, err)) => {
                    if let Some(holder) = holder {
                        state
                            .set_search_values_holder(Some(holder), operation_api.id())
                            .await?;
                    } else {
                        state
                            .set_search_values_holder(None, operation_api.id())
                            .await?;
                    }
                    state.drop_search_values().await?;
                    Err(err)
                }
            }
        } else {
            // We should not recreate holder, but just drop into NotInited
            state
                .set_search_values_holder(None, operation_api.id())
                .await?;
            state.drop_search_values().await?;
            Ok(Some(()))
        }
    }
}
