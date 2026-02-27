use crate::{
    host::ui::registry::filters::FilterRegistry,
    session::{command::SessionCommand, types::ObserveOperation},
};
use uuid::Uuid;

use super::{bottom_panel::BottomTabType, side_panel::SideTabType};

mod filters;
mod info;
mod logs;
mod observe;
mod search;
mod signal;

pub use filters::FiltersState;
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

    pub filters: FiltersState,

    pub search: SearchState,

    pub logs: LogsState,

    pub observe: ObserveState,
}

impl SessionShared {
    pub fn new(session_info: SessionInfo, observe_op: ObserveOperation) -> Self {
        let session_id = session_info.id;
        Self {
            session_info,
            signals: Vec::new(),
            bottom_tab: BottomTabType::Search,
            side_tab: SideTabType::Filters,
            filters: FiltersState::new(session_id),
            search: SearchState::new(session_id),
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

    pub fn add_operation(&mut self, observe_op: ObserveOperation) {
        self.observe.add_operation(observe_op);
        self.session_info.update_title(&self.observe);
    }

    /// Synchronizes the current session filters with the backend by generating the appropriate command.
    ///
    /// This function acts as the central coordinator for filter updates. It:
    /// 1. Resolves the effective list of filters by combining pinned session filters
    ///    (from the registry) and the current temporary search from the search bar.
    /// 2. If filters are present, it initializes a new search operation, updates the local
    ///    [`SearchState`], and returns an `ApplySearchFilter` command.
    /// 3. If no filters are active, it drops the current search state, pushes a [`SessionSignal::SearchDropped`]
    ///    to notify the UI, and returns a `DropSearch` command for the backend.
    pub fn apply_search_filters(&mut self, registry: &FilterRegistry) -> SessionCommand {
        let filters = self.search.get_active_filters(&self.filters, registry);
        if filters.is_empty() {
            let operation_id = self.search.processing_search_operation();
            self.drop_search();
            SessionCommand::DropSearch { operation_id }
        } else {
            let operation_id = Uuid::new_v4();
            self.search.set_search_operation(operation_id);
            SessionCommand::ApplySearchFilter {
                operation_id,
                filters,
            }
        }
    }
}
