use uuid::Uuid;

use super::bottom_panel::BottomTabType;

mod info;
mod logs;
mod search;
mod signal;

pub use info::SessionInfo;
pub use logs::LogsState;
#[allow(unused)]
pub use search::{FilterIndex, LogMainIndex, SearchState};
pub use signal::SessionSignal;

#[derive(Debug)]
pub struct SessionShared {
    session_info: SessionInfo,

    pub signals: Vec<SessionSignal>,

    /// Active tab in bottom panel
    pub active_bottom_tab: BottomTabType,

    pub search: SearchState,

    pub logs: LogsState,
}

impl SessionShared {
    pub fn new(session_info: SessionInfo) -> Self {
        Self {
            session_info,
            signals: Vec::new(),
            active_bottom_tab: BottomTabType::Search,
            search: SearchState::default(),
            logs: LogsState::default(),
        }
    }

    #[inline]
    pub fn get_id(&self) -> Uuid {
        self.session_info.id
    }

    #[inline]
    pub fn get_info(&self) -> &SessionInfo {
        &self.session_info
    }

    pub fn drop_search(&mut self) {
        self.search.drop_search();
        self.signals.push(SessionSignal::SearchDropped);
    }
}
