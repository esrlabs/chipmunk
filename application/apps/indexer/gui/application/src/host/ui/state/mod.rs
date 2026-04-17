use rustc_hash::FxHashMap;

use tokio::sync::mpsc::Sender;
use uuid::Uuid;

mod presets;

use crate::{
    host::{
        command::HostCommand,
        ui::{
            HomeView, UiActions,
            multi_setup::{MultiFileSetup, state::MultiFileState},
            registry::HostRegistry,
            session_setup::{SessionSetup, state::SessionSetupState},
            tabs::TabType,
        },
    },
    session::{SessionUiInit, ui::Session},
};

pub const HOME_TAB_IDX: usize = 0;

#[derive(Debug)]
pub struct HostState {
    pub home_view: HomeView,
    pub active_tab_idx: usize,
    pub tabs: Vec<TabType>,
    pub sessions: FxHashMap<Uuid, Session>,
    pub session_setups: FxHashMap<Uuid, SessionSetup>,
    pub multi_setups: FxHashMap<Uuid, MultiFileSetup>,
    /// Shared visibility for the host right panel and session auxiliary panels.
    pub panels_visibility: PanelsVisibility,
    pub registry: HostRegistry,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
/// Shared visibility state for the host right panel and session auxiliary panels.
pub struct PanelsVisibility {
    /// Controls the right-side panel visibility in home and session views.
    pub right: bool,
    /// Controls the session bottom panel visibility.
    pub bottom: bool,
}

impl HostState {
    pub fn new(cmd_tx: Sender<HostCommand>) -> Self {
        Self {
            home_view: HomeView::new(cmd_tx),
            active_tab_idx: 0,
            tabs: vec![TabType::Home],
            sessions: FxHashMap::default(),
            session_setups: FxHashMap::default(),
            multi_setups: FxHashMap::default(),
            panels_visibility: PanelsVisibility::default(),
            registry: HostRegistry::default(),
        }
    }

    pub fn active_tab(&self) -> &TabType {
        &self.tabs[self.active_tab_idx]
    }

    /// Whether the tab bar should render a right-side panel visibility toggle.
    pub fn show_right_panel_toggle(&self) -> bool {
        matches!(self.active_tab(), TabType::Home | TabType::Session(_))
    }

    /// Whether the tab bar should render the bottom panel visibility toggle.
    pub fn show_bottom_panel_toggle(&self) -> bool {
        matches!(self.active_tab(), TabType::Session(_))
    }

    /// Add session to state returning it's ID.
    pub fn add_session(
        &mut self,
        session: SessionUiInit,
        session_setup_id: Option<Uuid>,
        host_cmd_tx: Sender<HostCommand>,
    ) -> Uuid {
        let session = Session::new(session, host_cmd_tx);
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

        id
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

    pub fn add_multi_files(&mut self, state: MultiFileState, cmd_tx: Sender<HostCommand>) {
        let id = state.id();
        let setup = MultiFileSetup::new(state, cmd_tx);
        self.tabs.push(TabType::MultiFileSetup(id));
        self.multi_setups.insert(id, setup);
        self.active_tab_idx = self.tabs.len() - 1;
    }

    pub fn close_session(&mut self, session_id: Uuid, actions: &mut UiActions) {
        let session_tab_idx = self
            .tabs
            .iter()
            .position(|tab| matches!(tab, TabType::Session(id) if  *id == session_id));

        let session_tab_idx = match session_tab_idx {
            Some(idx) => idx,
            None => {
                log::error!(
                    "Close Session Message: Session with ID {session_id} \
                    doesn't exist in host UI struct"
                );

                if cfg!(debug_assertions) {
                    panic!("Received close session for unknown session ID");
                } else {
                    return;
                }
            }
        };

        self.registry.cleanup_session(&session_id);

        self.update_current_tab_on_close(session_tab_idx);

        self.tabs.remove(session_tab_idx);
        if let Some(session) = self.sessions.remove(&session_id) {
            session.on_close_session(actions);
        }
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
                    "Close Session Setup Message: Session Setup with ID {setup_id} \
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

    pub fn close_multi_setup(&mut self, setup_id: Uuid) {
        let tab_idx = self
            .tabs
            .iter()
            .position(|tab| matches!(tab, TabType::MultiFileSetup(id) if  *id == setup_id));

        let tab_idx = match tab_idx {
            Some(idx) => idx,
            None => {
                log::error!(
                    "Close multiple files setup message: Multi files Setup with ID {setup_id} \
                    doesn't exist in host UI struct"
                );

                if cfg!(debug_assertions) {
                    panic!("Received close command for unknown multiple files setup ID");
                } else {
                    return;
                }
            }
        };

        self.update_current_tab_on_close(tab_idx);

        self.tabs.remove(tab_idx);
        self.multi_setups.remove(&setup_id);
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

impl Default for PanelsVisibility {
    fn default() -> Self {
        Self {
            right: true,
            bottom: true,
        }
    }
}
