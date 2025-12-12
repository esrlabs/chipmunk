//! Includes Definitions for searchers in sessions with their current state.
use std::fmt::Debug;

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
                let Some(res) =
                    tokio::task::block_in_place(|| searchers.regular.search(rows, bytes, cancel))
                else {
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
                let Some(res) =
                    tokio::task::block_in_place(|| searchers.values.search(rows, bytes, cancel))
                else {
                    continue;
                };
                let res = response_tx
                    .send(SearchResponse::SearchValueResult(res))
                    .await;

                log_if_err(res);
            }
            SearchRequest::GetSearchHolder { filename, sender } => {
                let holder = {
                    match searchers.regular {
                        SearcherState::Available(_) => {
                            use std::mem;
                            if let SearcherState::Available(holder) =
                                mem::replace(&mut searchers.regular, SearcherState::InUse)
                            {
                                Ok(holder)
                            } else {
                                Err(stypes::NativeError {
                                    severity: stypes::Severity::ERROR,
                                    kind: stypes::NativeErrorKind::Configuration,
                                    message: Some(String::from(
                                        "Could not replace search holder in state",
                                    )),
                                })
                            }
                        }
                        SearcherState::InUse => {
                            Err(stypes::NativeError::channel("Search holder is in use"))
                        }
                        SearcherState::NotInited => {
                            searchers.regular.set_in_use();
                            Ok(RegularSearchHolder::new(&filename, 0, 0))
                        }
                    }
                };
                let res = sender.send(holder);
                log_if_err(res);
            }
            SearchRequest::GetSearchValueHolder { filename, sender } => {
                let holder = {
                    match searchers.values {
                        SearcherState::Available(_) => {
                            use std::mem;
                            if let SearcherState::Available(holder) =
                                mem::replace(&mut searchers.values, SearcherState::InUse)
                            {
                                Ok(holder)
                            } else {
                                Err(stypes::NativeError {
                                    severity: stypes::Severity::ERROR,
                                    kind: stypes::NativeErrorKind::Configuration,
                                    message: Some(String::from(
                                        "Could not replace search values holder in state",
                                    )),
                                })
                            }
                        }
                        SearcherState::InUse => Err(stypes::NativeError::channel(
                            "Search values holder is in use",
                        )),
                        SearcherState::NotInited => {
                            searchers.values.set_in_use();
                            Ok(ValueSearchHolder::new(&filename, 0, 0))
                        }
                    }
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
    pub fn set_in_use(&mut self) {
        *self = SearcherState::<_>::InUse;
    }
    pub fn set_not_inited(&mut self) {
        *self = SearcherState::<_>::NotInited;
    }

    pub fn set_searcher(&mut self, seacher: BaseSearcher<State>) {
        *self = SearcherState::<_>::Available(seacher);
    }
}

impl SearcherState<ValueSearchState> {
    pub fn search(
        &mut self,
        rows_count: u64,
        read_bytes: u64,
        cancel_token: CancellationToken,
    ) -> Option<OperationResults> {
        match self {
            Self::Available(h) => Some(searchers::values::search(
                h,
                rows_count,
                read_bytes,
                cancel_token,
            )),
            _ => None,
        }
    }
}
impl SearcherState<RegularSearchState> {
    pub fn search(
        &mut self,
        rows_count: u64,
        read_bytes: u64,
        cancel_token: CancellationToken,
    ) -> Option<regular::SearchResults> {
        match self {
            Self::Available(h) => Some(searchers::regular::search(
                h,
                rows_count,
                read_bytes,
                cancel_token,
            )),
            _ => None,
        }
    }
}

#[derive(Debug)]
pub struct Searchers {
    pub regular: SearcherState<RegularSearchState>,
    pub values: SearcherState<ValueSearchState>,
}
