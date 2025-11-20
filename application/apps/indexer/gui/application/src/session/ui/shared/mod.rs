use uuid::Uuid;

use super::bottom_panel::BottomTabType;

mod info;
mod logs;
mod search;

pub use info::SessionInfo;
pub use logs::LogsState;
pub use search::{FilterIndex, LogMainIndex, SearchState};

#[derive(Debug)]
pub struct SessionShared {
    session_info: SessionInfo,
    /// Active tab in bottom panel
    pub active_bottom_tab: BottomTabType,

    pub search: SearchState,

    pub logs: LogsState,
}

impl SessionShared {
    pub fn new(session_info: SessionInfo) -> Self {
        Self {
            session_info,
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
}
