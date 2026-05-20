//! Host tab ownership and lifecycle management.

mod render;

use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::{
    common::ui::tab_strip::TabSpec,
    host::{
        command::HostCommand,
        message::PluginReadmeLoaded,
        ui::{
            UiActions,
            app_settings::AppSettingsView,
            home::HomeView,
            multi_setup::{MultiFileSetup, state::MultiFileState},
            plugin_manager::PluginManagerView,
            registry::HostRegistry,
            session_setup::{SessionSetup, state::SessionSetupState},
            state::{
                modal::{HostModal, HostModalState},
                plugin::PluginsState,
            },
            storage::settings::AppSettings,
        },
    },
    session::ui::Session,
};

pub use render::{HOST_TAB_CONTROL_HEIGHT, host_tab_bar_height};

const HOME_TAB_IDX: usize = 0;

/// Owns host tabs, active-tab state, and tab lifecycle behavior.
#[derive(Debug)]
pub struct HostTabs {
    cmd_tx: Sender<HostCommand>,
    active_idx: usize,
    tabs: Vec<HostTab>,
    tab_specs: Vec<TabSpec<'static>>,
}

/// A concrete host tab and its persistent view state.
#[derive(Debug)]
pub enum HostTab {
    /// Home screen tab.
    Home(Box<HomeView>),
    /// Active session tab.
    Session(Box<Session>),
    /// Single-session setup tab.
    SessionSetup(Box<SessionSetup>),
    /// Multiple-file setup tab.
    MultiFileSetup(Box<MultiFileSetup>),
    /// Plugin management tab.
    PluginManager(Box<PluginManagerView>),
    /// Application settings tab.
    AppSettings(Box<AppSettingsView>),
}

impl HostTabs {
    /// Creates tab state with the required Home tab active.
    pub fn new(cmd_tx: Sender<HostCommand>) -> Self {
        let home = HostTab::Home(Box::new(HomeView::new(cmd_tx.clone())));

        Self {
            cmd_tx,
            active_idx: HOME_TAB_IDX,
            tabs: vec![home],
            tab_specs: Vec::new(),
        }
    }

    /// Returns all tabs for host-level routing that must inspect every tab.
    pub fn tabs_mut(&mut self) -> &mut [HostTab] {
        &mut self.tabs
    }

    /// Returns the active tab.
    pub fn active(&self) -> &HostTab {
        &self.tabs[self.active_idx]
    }

    /// Returns the active tab mutably.
    pub fn active_mut(&mut self) -> &mut HostTab {
        &mut self.tabs[self.active_idx]
    }

    /// Activates the Home tab.
    pub fn activate_home(&mut self) {
        self.active_idx = HOME_TAB_IDX;
    }

    /// Activates the tab at `index` when it exists.
    pub fn activate_tab(&mut self, index: usize) {
        if index < self.tabs.len() {
            self.active_idx = index;
        }
    }

    /// Activates the next tab, wrapping around at the end.
    pub fn activate_next_tab(&mut self) {
        if self.tabs.len() <= 1 {
            return;
        }

        self.active_idx = (self.active_idx + 1) % self.tabs.len();
    }

    /// Activates the previous tab, wrapping around at the start.
    pub fn activate_previous_tab(&mut self) {
        if self.tabs.len() <= 1 {
            return;
        }

        self.active_idx = if self.active_idx == HOME_TAB_IDX {
            self.tabs.len() - 1
        } else {
            self.active_idx - 1
        };
    }

    /// Opens or focuses the singleton Plugin Manager tab.
    pub fn open_plugin_manager(&mut self) {
        if let Some(tab_idx) = self
            .tabs
            .iter()
            .position(|tab| matches!(tab, HostTab::PluginManager(_)))
        {
            self.active_idx = tab_idx;
            return;
        }

        let plugin_manager = PluginManagerView::new(self.cmd_tx.clone());
        let tab = HostTab::PluginManager(Box::new(plugin_manager));
        self.tabs.push(tab);
        self.active_idx = self.tabs.len() - 1;
    }

    /// Opens or focuses the singleton application settings tab.
    pub fn open_app_settings(&mut self, settings: AppSettings) {
        if let Some(tab_idx) = self
            .tabs
            .iter()
            .position(|tab| matches!(tab, HostTab::AppSettings(_)))
        {
            self.active_idx = tab_idx;
            return;
        }

        let settings = AppSettingsView::new(settings);
        let tab = HostTab::AppSettings(Box::new(settings));
        self.tabs.push(tab);
        self.active_idx = self.tabs.len() - 1;
    }

    /// Adds and activates a single-session setup tab.
    pub fn add_session_setup(&mut self, setup_state: SessionSetupState) {
        let setup = SessionSetup::new(setup_state, self.cmd_tx.clone());
        self.tabs.push(HostTab::SessionSetup(Box::new(setup)));
        self.active_idx = self.tabs.len() - 1;
    }

    /// Adds and activates a multiple-file setup tab.
    pub fn add_multi_files(&mut self, state: MultiFileState) {
        let setup = MultiFileSetup::new(state, self.cmd_tx.clone());
        self.tabs.push(HostTab::MultiFileSetup(Box::new(setup)));
        self.active_idx = self.tabs.len() - 1;
    }

    /// Adds a session tab, replacing a matching setup tab when one is provided.
    pub fn add_session(&mut self, session: Session, session_setup_id: Option<Uuid>) {
        if let Some(setup_id) = session_setup_id
            && let Some(tab) = self
                .tabs
                .iter_mut()
                .find(|tab| matches!(tab, HostTab::SessionSetup(setup) if setup.id() == setup_id))
        {
            *tab = HostTab::Session(Box::new(session));
            return;
        }

        self.tabs.push(HostTab::Session(Box::new(session)));
        self.active_idx = self.tabs.len() - 1;
    }

    /// Requests close behavior for the active tab.
    pub fn close_active_tab(
        &mut self,
        registry: &mut HostRegistry,
        modals: &mut HostModalState,
        actions: &mut UiActions,
    ) {
        if matches!(self.active(), HostTab::Home(_)) {
            return;
        }

        self.close_tab_at(self.active_idx, registry, modals, actions);
    }

    /// Requests close behavior for the tab at `index`.
    pub fn close_tab_at(
        &mut self,
        index: usize,
        registry: &mut HostRegistry,
        modals: &mut HostModalState,
        actions: &mut UiActions,
    ) {
        let Some(tab) = self.tabs.get_mut(index) else {
            return;
        };

        match tab {
            HostTab::Home(_) => {
                debug_assert!(false, "Home tab is not closeable");
            }
            HostTab::Session(session) => {
                let session_id = session.get_info().id;
                self.close_session(session_id, registry, actions);
            }
            HostTab::SessionSetup(setup) => setup.close(actions),
            HostTab::MultiFileSetup(setup) => setup.close(actions),
            HostTab::PluginManager(_) => {
                self.update_active_on_close(index);
                self.tabs.remove(index);
            }
            HostTab::AppSettings(settings) => {
                if let Some(dialog) = settings.on_close_tab() {
                    modals.open(HostModal::Confirmation(dialog));
                    return;
                }

                self.update_active_on_close(index);
                self.tabs.remove(index);
            }
        }
    }

    /// Closes the session tab identified by `session_id`.
    pub fn close_session(
        &mut self,
        session_id: Uuid,
        registry: &mut HostRegistry,
        actions: &mut UiActions,
    ) {
        let Some(session_tab_idx) = self.tabs.iter().position(
            |tab| matches!(tab, HostTab::Session(session) if session.get_info().id == session_id),
        ) else {
            log::error!(
                "Close Session Message: Session with ID {session_id} \
                doesn't exist in host UI struct"
            );
            debug_assert!(false, "Received close session for unknown session ID");
            return;
        };

        registry.cleanup_session(&session_id);
        self.update_active_on_close(session_tab_idx);

        let tab = self.tabs.remove(session_tab_idx);
        let HostTab::Session(session) = tab else {
            return;
        };
        session.on_close_session(actions);
    }

    /// Removes the setup tab identified by `setup_id`.
    pub fn close_session_setup(&mut self, setup_id: Uuid) {
        let Some(tab_idx) = self
            .tabs
            .iter()
            .position(|tab| matches!(tab, HostTab::SessionSetup(setup) if setup.id() == setup_id))
        else {
            log::error!(
                "Close Session Setup Message: Session Setup with ID {setup_id} \
                doesn't exist in host UI struct"
            );
            debug_assert!(false, "Received close session for unknown session setup ID");
            return;
        };

        self.update_active_on_close(tab_idx);
        self.tabs.remove(tab_idx);
    }

    /// Removes the multiple-file setup tab identified by `setup_id`.
    pub fn close_multi_setup(&mut self, setup_id: Uuid) {
        let Some(tab_idx) = self.tabs.iter().position(
            |tab| matches!(tab, HostTab::MultiFileSetup(setup) if setup.id() == setup_id),
        ) else {
            log::error!(
                "Close multiple files setup message: Multi files Setup with ID {setup_id} \
                doesn't exist in host UI struct"
            );
            debug_assert!(
                false,
                "Received close command for unknown multiple files setup ID"
            );
            return;
        };

        self.update_active_on_close(tab_idx);
        self.tabs.remove(tab_idx);
    }

    /// Removes the application settings tab when it is open.
    pub fn remove_app_settings_tab(&mut self) {
        let Some(tab_idx) = self
            .tabs
            .iter()
            .position(|tab| matches!(tab, HostTab::AppSettings(_)))
        else {
            return;
        };

        self.update_active_on_close(tab_idx);
        self.tabs.remove(tab_idx);
    }

    /// Returns whether the active tab supports the right-panel visibility toggle.
    pub fn show_right_panel_toggle(&self, plugins: &PluginsState) -> bool {
        match self.active() {
            HostTab::Home(_) | HostTab::Session(_) | HostTab::MultiFileSetup(_) => true,
            HostTab::SessionSetup(_) | HostTab::AppSettings(_) => false,
            HostTab::PluginManager(_) => matches!(plugins, PluginsState::Available(_)),
        }
    }

    /// Returns whether the active tab supports the bottom-panel visibility toggle.
    pub fn show_bottom_panel_toggle(&self) -> bool {
        matches!(self.active(), HostTab::Session(_))
    }

    /// Applies published plugin-state changes to open tabs that depend on plugin data.
    pub fn handle_plugins_changed(&mut self, plugins: &PluginsState) {
        for tab in self.tabs_mut() {
            match tab {
                HostTab::PluginManager(plugin_manager) => {
                    plugin_manager.handle_plugins_changed(plugins);
                }
                HostTab::SessionSetup(setup) => {
                    setup.state.sync_plugins(plugins);
                }
                HostTab::Home(_)
                | HostTab::Session(_)
                | HostTab::MultiFileSetup(_)
                | HostTab::AppSettings(_) => {}
            }
        }
    }

    /// Routes a loaded plugin README response to the open Plugin Manager tab.
    pub fn handle_plugin_readme_loaded(&mut self, response: PluginReadmeLoaded) {
        let Some(plugin_manager) = self.tabs.iter_mut().find_map(|tab| match tab {
            HostTab::PluginManager(plugin_manager) => Some(plugin_manager),
            _ => None,
        }) else {
            return;
        };

        plugin_manager.handle_readme_loaded(response);
    }

    /// Applies pending confirmation results to tabs that own confirmation workflows.
    pub fn handle_confirmation_results(
        &mut self,
        modals: &mut HostModalState,
        actions: &mut UiActions,
    ) {
        let mut close_app_settings = false;

        for tab in self.tabs_mut() {
            match tab {
                HostTab::AppSettings(settings) => {
                    close_app_settings = settings.should_close_after_confirmation(modals);
                }
                HostTab::PluginManager(plugin_manager) => {
                    plugin_manager.handle_confirmation_result(actions, modals);
                }
                HostTab::Home(_)
                | HostTab::Session(_)
                | HostTab::SessionSetup(_)
                | HostTab::MultiFileSetup(_) => {}
            }

            if close_app_settings || !modals.has_confirmation_results() {
                break;
            }
        }

        if close_app_settings {
            self.remove_app_settings_tab();
        }
    }

    fn update_active_on_close(&mut self, removed_idx: usize) {
        if self.active_idx == removed_idx {
            self.active_idx = HOME_TAB_IDX;
        } else if self.active_idx > removed_idx {
            self.active_idx -= 1;
        }
    }
}
