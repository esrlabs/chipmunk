//! Includes Definitions for searchers in sessions with their current state.
use std::{fmt::Debug, mem};

use tokio::sync::mpsc::{self};
use tokio_util::sync::CancellationToken;

use processor::search::searchers::{
    self, BaseSearcher, SearchState,
    regular::{self, RegularSearchHolder, RegularSearchState},
    values::{OperationResults, ValueSearchHolder, ValueSearchState},
};

mod definitions;

pub use definitions::*;

pub fn spawn() -> (mpsc::Sender<SearchRequest>, mpsc::Receiver<SearchResponse>) {
    let (request_tx, request_rx) = mpsc::channel(32);
    let (response_tx, response_rx) = mpsc::channel(32);

    tokio::spawn(async move {
        run(request_rx, response_tx).await;
    });

    (request_tx, response_rx)
}

async fn run(
    mut request_rx: mpsc::Receiver<SearchRequest>,
    response_tx: mpsc::Sender<SearchResponse>,
) {
    fn log_if_err<T, E: Debug>(res: Result<T, E>) {
        if let Err(err) = res {
            log::error!("Fail to send search response. Channel is closed, Error: {err:?} ");
        }
    }

    let mut searchers = Searchers {
        regular: SearcherState::NotInited,
        values: SearcherState::NotInited,
    };
    while let Some(request) = request_rx.recv().await {
        match request {
            SearchRequest::SearchRegular {
                rows,
                bytes,
                cancel,
            } => {
                let Some(res) = searchers.regular.search(rows, bytes, cancel).await else {
                    continue;
                };
                let res = response_tx
                    .send(SearchResponse::SearchRegularResult(res))
                    .await;
                log_if_err(res);
            }
            SearchRequest::SearchValue {
                rows,
                bytes,
                cancel,
            } => {
                let Some(res) = searchers.values.search(rows, bytes, cancel).await else {
                    continue;
                };
                let res = response_tx
                    .send(SearchResponse::SearchValueResult(res))
                    .await;

                log_if_err(res);
            }
            SearchRequest::GetSearchHolder { filename, sender } => {
                let holder = match mem::replace(&mut searchers.regular, SearcherState::InUse) {
                    SearcherState::Available(holder) => Ok(holder),
                    SearcherState::InUse => {
                        Err(stypes::NativeError::channel("Search holder is in use"))
                    }
                    SearcherState::NotInited => Ok(RegularSearchHolder::new(&filename, 0, 0)),
                };
                let res = sender.send(holder);
                log_if_err(res);
            }
            SearchRequest::GetSearchValueHolder { filename, sender } => {
                let holder = match mem::replace(&mut searchers.values, SearcherState::InUse) {
                    SearcherState::Available(holder) => Ok(holder),
                    SearcherState::InUse => Err(stypes::NativeError::channel(
                        "Search values holder is in use",
                    )),
                    SearcherState::NotInited => Ok(ValueSearchHolder::new(&filename, 0, 0)),
                };
                let res = sender.send(holder);
                log_if_err(res);
            }
            SearchRequest::SetSearchHolder {
                holder,
                tx_response,
            } => {
                let result = if searchers.regular.is_in_use() {
                    if let Some(holder) = holder {
                        searchers.regular.set_searcher(holder);
                    } else {
                        searchers.regular.set_not_inited();
                    }
                    Ok(())
                } else {
                    Err(stypes::NativeError::channel(
                        "Cannot set search holder - it wasn't in use",
                    ))
                };
                let res = tx_response.send(result);
                log_if_err(res);
            }
            SearchRequest::SetValueHolder {
                holder,
                tx_response,
            } => {
                let result = if searchers.values.is_in_use() {
                    if let Some(holder) = holder {
                        searchers.values.set_searcher(holder);
                    } else {
                        searchers.values.set_not_inited();
                    }
                    Ok(())
                } else {
                    Err(stypes::NativeError::channel(
                        "Cannot set search values holder - it wasn't in use",
                    ))
                };
                let res = tx_response.send(result);
                log_if_err(res);
            }
            SearchRequest::DropSearch { tx_result } => {
                let result = if searchers.regular.is_in_use() {
                    false
                } else {
                    searchers.regular.set_not_inited();
                    true
                };
                let res = tx_result.send(result);
                log_if_err(res);
            }
            SearchRequest::DropSearchValue { tx_result } => {
                let result = if searchers.values.is_in_use() {
                    false
                } else {
                    searchers.values.set_not_inited();
                    true
                };
                let res = tx_result.send(result);
                log_if_err(res);
            }
        }
    }
}

#[derive(Debug)]
pub enum SearcherState<State: SearchState> {
    Available(BaseSearcher<State>),
    InUse,
    NotInited,
}

impl<State: SearchState> SearcherState<State> {
    pub fn is_in_use(&self) -> bool {
        matches!(self, SearcherState::<_>::InUse)
    }
    pub fn set_not_inited(&mut self) {
        *self = SearcherState::<_>::NotInited;
    }

    pub fn set_searcher(&mut self, seacher: BaseSearcher<State>) {
        *self = SearcherState::<_>::Available(seacher);
    }

    /// Runs `search` on the blocking pool with the holder taken out of this state for the
    /// duration of the call, and puts it back afterwards.
    ///
    /// Returns `None` when there is no holder to search with, or when the blocking task didn't
    /// run to completion. In the latter case the searcher is reset to [`SearcherState::NotInited`].
    async fn spawn_search_blocking<R: Send + 'static>(
        &mut self,
        search: impl FnOnce(&mut BaseSearcher<State>) -> R + Send + 'static,
    ) -> Option<R>
    where
        State: Send + 'static,
    {
        // The holder owns only pointers, so handing it to the blocking task is a small memcpy
        // and not a copy of the search state.
        let mut holder = match mem::replace(self, SearcherState::InUse) {
            SearcherState::Available(holder) => holder,
            // Nothing to search with: restore the state taken above.
            other => {
                *self = other;
                return None;
            }
        };
        match tokio::task::spawn_blocking(move || {
            let results = search(&mut holder);
            (holder, results)
        })
        .await
        {
            Ok((holder, results)) => {
                self.set_searcher(holder);
                Some(results)
            }
            // The task took the holder with it, whether it panicked or was cancelled on runtime
            // shutdown. Reset this searcher instead of letting the searchers task die with it.
            Err(err) => {
                log::error!("Search task failed. Error: {err}");
                self.set_not_inited();
                None
            }
        }
    }
}

impl SearcherState<ValueSearchState> {
    pub async fn search(
        &mut self,
        rows_count: u64,
        read_bytes: u64,
        cancel_token: CancellationToken,
    ) -> Option<OperationResults> {
        self.spawn_search_blocking(move |holder| {
            searchers::values::search(holder, rows_count, read_bytes, cancel_token)
        })
        .await
    }
}
impl SearcherState<RegularSearchState> {
    pub async fn search(
        &mut self,
        rows_count: u64,
        read_bytes: u64,
        cancel_token: CancellationToken,
    ) -> Option<regular::SearchResults> {
        self.spawn_search_blocking(move |holder| {
            searchers::regular::search(holder, rows_count, read_bytes, cancel_token)
        })
        .await
    }
}

#[derive(Debug)]
pub struct Searchers {
    pub regular: SearcherState<RegularSearchState>,
    pub values: SearcherState<ValueSearchState>,
}
