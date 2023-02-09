use processor::search::searchers;
use tokio_util::sync::CancellationToken;

#[derive(Debug)]
pub enum SearcherState<T: searchers::Base> {
    Available(T),
    InUse,
    NotInited,
}

impl<T: searchers::Base> SearcherState<T> {
    pub fn in_use(&mut self) {
        *self = SearcherState::<_>::InUse;
    }
    pub fn not_inited(&mut self) {
        *self = SearcherState::<_>::NotInited;
    }

    pub fn set(&mut self, seacher: T) {
        *self = SearcherState::<_>::Available(seacher);
    }
}

impl SearcherState<searchers::regular::Searcher> {
    pub fn search(
        &mut self,
        rows_count: u64,
        read_bytes: u64,
        cancel_token: CancellationToken,
    ) -> Option<searchers::regular::SearchResults> {
        match self {
            Self::Available(h) => Some(h.execute(rows_count, read_bytes, cancel_token)),
            _ => None,
        }
    }
}

impl SearcherState<searchers::values::Searcher> {
    pub fn search(
        &mut self,
        rows_count: u64,
        read_bytes: u64,
        cancel_token: CancellationToken,
    ) -> Option<searchers::values::OperationResults> {
        match self {
            Self::Available(h) => Some(h.execute(rows_count, read_bytes, cancel_token)),
            _ => None,
        }
    }
}

#[derive(Debug)]
pub struct Searchers {
    pub regular: SearcherState<searchers::regular::Searcher>,
    pub values: SearcherState<searchers::values::Searcher>,
}
