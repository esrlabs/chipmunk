use super::bottom_panel::BottomTabType;

#[derive(Debug, Default)]
pub struct SessionUiState {
    pub bottom_panel: BottomPanelState,
    /// The stream position of the log which the main logs table
    /// should scroll into.
    pub scroll_main_row: Option<u64>,
    /// The index of the log in search table to make the table scroll
    /// toward this index.
    pub scroll_search_idx: Option<u64>,
}

#[derive(Debug)]
pub struct BottomPanelState {
    pub active_tab: BottomTabType,
}

impl Default for BottomPanelState {
    fn default() -> Self {
        Self {
            active_tab: BottomTabType::Search,
        }
    }
}
