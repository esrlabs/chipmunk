use crate::session::data::logs_mapped::LogsMapped;

mod logs_mapped;
mod logs_sliding_window;
mod search;

pub use search::{FilterIndex, SearchData};

#[derive(Debug, Default)]
pub struct SessionState {
    pub main_table: LogsMapped,
    pub logs_count: u64,
    pub search: SearchData,
}
