mod logs_sliding_window;
mod search;

pub use search::{LogMainIndex, SearchData};

#[derive(Debug, Default)]
pub struct SessionState {
    pub logs_count: u64,
    pub search: SearchData,
}
