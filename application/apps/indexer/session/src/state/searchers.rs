//! Includes Definitions for searchers in sessions with their current state.

use processor::search::searchers::{
    self, BaseSearcher, SearchState,
    regular::{self, RegularSearchState},
    values::{OperationResults, ValueSearchState},
};
use tokio_util::sync::CancellationToken;

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
