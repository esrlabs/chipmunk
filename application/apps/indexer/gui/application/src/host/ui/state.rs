use std::collections::HashMap;

use uuid::Uuid;

use crate::{
    host::ui::tabs::TabType,
    session::{InitSessionParams, ui::Session},
};

pub const HOME_TAB_IDX: usize = 0;

#[derive(Debug)]
pub struct HostState {
    pub active_tab_idx: usize,
    pub tabs: Vec<TabType>,
    pub sessions: HashMap<Uuid, Session>,
}

impl HostState {
    pub fn active_tab(&self) -> &TabType {
        &self.tabs[self.active_tab_idx]
    }
    pub fn add_session(&mut self, session: InitSessionParams) {
        let session = Session::new(session);
        let id = session.get_info().id;
        self.tabs.push(TabType::Session(id));
        self.sessions.insert(id, session);
        self.active_tab_idx = self.tabs.len() - 1;
    }

    pub fn close_session(&mut self, session_id: Uuid) {
        let session_tab_idx = self
            .tabs
            .iter()
            .position(|tab| matches!(tab, TabType::Session(id) if  *id == session_id));

        let session_tab_idx = match session_tab_idx {
            Some(idx) => idx,
            None => {
                log::error!(
                    "Close Session Message: Session with ID {session_id}\
                    doesn't exist in host UI struct"
                );

                if cfg!(debug_assertions) {
                    panic!("Recieved close session for unknown session ID");
                } else {
                    return;
                }
            }
        };

        // Handle current tab
        if self.active_tab_idx == session_tab_idx {
            self.active_tab_idx = HOME_TAB_IDX;
        } else if self.active_tab_idx > session_tab_idx {
            // Tabs after the deleted one will be shifted one place to the left.
            self.active_tab_idx -= 1;
        }

        self.tabs.remove(session_tab_idx);
        self.sessions.remove(&session_id);
    }
}

impl Default for HostState {
    fn default() -> Self {
        Self {
            active_tab_idx: 0,
            tabs: vec![TabType::Home],
            sessions: HashMap::new(),
        }
    }
}
