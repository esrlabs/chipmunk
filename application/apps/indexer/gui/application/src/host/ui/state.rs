#[derive(Debug)]
pub struct UiState {
    pub active_tab: TabType,
}

impl Default for UiState {
    fn default() -> Self {
        Self {
            active_tab: TabType::Home,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TabType {
    Home,
    Session(usize),
}
