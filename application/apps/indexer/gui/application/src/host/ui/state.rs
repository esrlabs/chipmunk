use uuid::Uuid;

use crate::session::{InitSessionParams, ui::SessionUI};

#[derive(Debug)]
pub struct HostState {
    pub active_tab: TabType,
    pub sessions: Vec<SessionUI>,
}

impl HostState {
    pub fn add_session(&mut self, session: InitSessionParams) {
        let session = SessionUI::new(session);
        self.sessions.push(session);
        self.active_tab = TabType::Session(self.sessions.len() - 1);
    }

    pub fn close_session(&mut self, session_id: Uuid) {
        let session_idx = self
            .sessions
            .iter()
            .position(|s| s.get_info().id == session_id);

        let session_idx = match session_idx {
            Some(idx) => idx,
            None => {
                log::error!(
                    "Close Session Message: Session with ID {session_id}\
                    doesn't exist in host UI struct"
                );
                panic!("Recieved close session for unknown session ID");
            }
        };

        // Handle current tab
        if let TabType::Session(current_idx) = self.active_tab {
            if current_idx == session_idx {
                self.active_tab = TabType::Home;
            }
            // Tabs after the deleted one will be shifted one place to the left.
            if current_idx > session_idx {
                self.active_tab = TabType::Session(current_idx.saturating_sub(1));
            }
        }

        self.sessions.remove(session_idx);
    }
}

impl Default for HostState {
    fn default() -> Self {
        Self {
            sessions: Vec::new(),
            active_tab: TabType::Home,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TabType {
    Home,
    Session(usize),
}
