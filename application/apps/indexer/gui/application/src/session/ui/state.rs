#[derive(Debug, Default)]
pub struct SessionUiState {
    /// The stream position of the selected log.
    pub selected_log_pos: Option<u64>,
    /// The stream position of the log which the main logs table
    /// should scroll into.
    pub scroll_main_row: Option<u64>,
    /// The index of the log in search table to make the table scroll
    /// toward this index.
    pub scroll_search_idx: Option<u64>,
}
