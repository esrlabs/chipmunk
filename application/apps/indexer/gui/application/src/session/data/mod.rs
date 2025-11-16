use stypes::GrabbedElement;

mod charts;
mod logs_sliding_window;
mod search;

pub use charts::{ChartBar, ChartsData};
pub use search::{LogMainIndex, SearchData};
use uuid::Uuid;

#[derive(Debug)]
pub struct SessionDataState {
    pub session_id: Uuid,
    pub logs_count: u64,
    pub selected_log: Option<GrabbedElement>,
    pub search: SearchData,
    pub charts: ChartsData,
}

impl SessionDataState {
    pub fn new(session_id: Uuid) -> Self {
        Self {
            session_id,
            logs_count: Default::default(),
            selected_log: Default::default(),
            search: Default::default(),
            charts: Default::default(),
        }
    }
}
