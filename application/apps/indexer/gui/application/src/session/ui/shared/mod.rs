use uuid::Uuid;

use crate::session::types::ObserveOperation;

use super::{bottom_panel::BottomTabType, side_panel::SideTabType};

mod info;
mod logs;
mod observe;
mod search;
mod signal;

pub use info::SessionInfo;
pub use logs::LogsState;
pub use observe::ObserveState;
#[allow(unused)]
pub use search::{FilterIndex, LogMainIndex, SearchState};
pub use signal::SessionSignal;

#[derive(Debug)]
pub struct SessionShared {
    session_info: SessionInfo,

    pub signals: Vec<SessionSignal>,

    /// Active tab in bottom panel
    pub bottom_tab: BottomTabType,

    pub side_tab: SideTabType,

    pub search: SearchState,

    pub logs: LogsState,

    pub observe: ObserveState,
}

impl SessionShared {
    pub fn new(session_info: SessionInfo, observe_op: ObserveOperation) -> Self {
        Self {
            session_info,
            signals: Vec::new(),
            bottom_tab: BottomTabType::Search,
            side_tab: SideTabType::Filters,
            search: SearchState::default(),
            logs: LogsState::default(),
            observe: ObserveState::new(observe_op),
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
