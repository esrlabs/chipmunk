#[derive(Debug, Default)]
pub struct SessionState {
    pub main_table: MainTable,
    pub logs_count: u64,
}

#[derive(Debug, Default)]
pub struct MainTable {
    /// The index of first line in logs window
    pub idx_offset: usize,
    pub logs_window: Vec<String>,
}
