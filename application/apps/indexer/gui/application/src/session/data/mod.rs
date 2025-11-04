use crate::session::data::logs_mapped::LogsMapped;

mod indexed_mapped;
mod logs_mapped;
mod logs_sliding_window;
mod search;

pub use indexed_mapped::SearchTableIndex;
pub use search::{FilterIndex, LogMainIndex, SearchData};

#[derive(Debug, Default)]
pub struct SessionState {
    pub main_table: LogsMapped,
    pub logs_count: u64,
    pub search: SearchData,
}
