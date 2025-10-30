use crate::session::data::logs_sliding_window::LogsSlidingWindow;

mod logs_sliding_window;

#[derive(Debug, Default)]
pub struct SessionState {
    pub main_table: LogsSlidingWindow,
    pub logs_count: u64,
}
