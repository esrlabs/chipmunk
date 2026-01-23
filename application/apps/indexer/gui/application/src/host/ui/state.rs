use std::collections::HashMap;

use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::{
    host::{
        command::HostCommand,
        ui::{
            session_setup::{SessionSetup, state::SessionSetupState},
            tabs::TabType,
        },
    },
    session::{InitSessionParams, ui::Session},
};

pub const HOME_TAB_IDX: usize = 0;

#[derive(Debug)]
pub struct HostState {
    pub active_tab_idx: usize,
    pub tabs: Vec<TabType>,
    pub sessions: HashMap<Uuid, Session>,
    pub session_setups: HashMap<Uuid, SessionSetup>,
}

impl HostState {
    pub fn active_tab(&self) -> &TabType {
        &self.tabs[self.active_tab_idx]
    }

    pub fn add_session(&mut self, session: InitSessionParams, session_setup_id: Option<Uuid>) {
        let session = Session::new(session);
        let id = session.get_info().id;

        self.sessions.insert(id, session);
        if let Some(setup_id) = session_setup_id {
            self.session_setups.remove(&setup_id);

            // Replace Session Setup tab with the session itself.
            let tab = self
                .tabs
                .iter_mut()
                .find(|t| matches!(t, TabType::SessionSetup(uuid) if *uuid == setup_id))
                .expect("Setup session tab should exist");
            *tab = TabType::Session(id);
        } else {
            self.tabs.push(TabType::Session(id));
            self.active_tab_idx = self.tabs.len() - 1;
        }
    }

    pub fn add_session_setup(
        &mut self,
        setup_state: SessionSetupState,
        cmd_tx: Sender<HostCommand>,
    ) {
        let id = setup_state.id;
        let setup = SessionSetup::new(setup_state, cmd_tx);
        self.tabs.push(TabType::SessionSetup(id));
        self.session_setups.insert(id, setup);
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
                    panic!("Received close session for unknown session ID");
                } else {
                    return;
                }
            }
        };

        self.update_current_tab_on_close(session_tab_idx);

        self.tabs.remove(session_tab_idx);
        self.sessions.remove(&session_id);
    }

    pub fn close_session_setup(&mut self, setup_id: Uuid) {
        let tab_idx = self
            .tabs
            .iter()
            .position(|tab| matches!(tab, TabType::SessionSetup(id) if  *id == setup_id));

        let tab_idx = match tab_idx {
            Some(idx) => idx,
            None => {
                log::error!(
                    "Close Session Setup Message: Session Setup with ID {setup_id}\
                    doesn't exist in host UI struct"
                );

                if cfg!(debug_assertions) {
                    panic!("Received close session for unknown session setup ID");
                } else {
                    return;
                }
            }
        };

        self.update_current_tab_on_close(tab_idx);

        self.tabs.remove(tab_idx);
        self.session_setups.remove(&setup_id);
    }

    fn update_current_tab_on_close(&mut self, removed_idx: usize) {
        if self.active_tab_idx == removed_idx {
            self.active_tab_idx = HOME_TAB_IDX;
        } else if self.active_tab_idx > removed_idx {
            // Tabs after the deleted one will be shifted one place to the left.
            self.active_tab_idx -= 1;
        }
    }
}

impl Default for HostState {
    fn default() -> Self {
        Self {
            active_tab_idx: 0,
            tabs: vec![TabType::Home],
            sessions: HashMap::new(),
            session_setups: HashMap::new(),
        }
    }
}
