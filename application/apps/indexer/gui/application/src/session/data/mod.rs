mod logs_sliding_window;
mod search;

pub use search::{LogMainIndex, SearchData};
use stypes::GrabbedElement;

#[derive(Debug, Default)]
pub struct SessionDataState {
    pub logs_count: u64,
    pub selected_log: Option<GrabbedElement>,
    pub search: SearchData,
}
