use crate::host::ui::SessionInfo;

#[derive(Debug)]
pub struct UiState {
    pub active_tab: TabType,
    pub sessions: Vec<SessionInfo>,
}

impl Default for UiState {
    fn default() -> Self {
        Self {
            active_tab: TabType::Home,
            sessions: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TabType {
    Home,
    Session(usize),
}
