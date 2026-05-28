use std::time::Duration;

use anyhow::ensure;
use eframe::NativeOptions;
use egui::{
    Align, Button, CentralPanel, Context, Frame, Layout, Panel, RichText, Ui, Widget, vec2,
};
use log::{info, trace, warn};

use crate::{
    cli::CliCommand,
    common::{
        app_info, fonts,
        phosphor::{self, icons},
        ui::modal::{ModalSize, show_modal},
    },
    host::{
        command::{HostCommand, StartSessionParam},
        common::{app_style, colors},
        communication::{UiReceivers, UiSenders},
        message::HostMessage,
        service::HostService,
        ui::{
            command_palette::CommandPalette,
            notification::NotificationUi,
            quick_open::QuickOpen,
            session_setup::state::{
                parsers::ParserConfig,
                sources::{ByteSourceConfig, ProcessConfig, StreamConfig},
            },
            state::modal::HostModal,
            storage::HostStorage,
            tabs::{HOST_TAB_CONTROL_HEIGHT, HostTab, HostTabs, host_tab_bar_height},
        },
    },
    session::{SpawnedRecentSession, SpawnedSession, ui::Session},
};
use menu::MainMenuBar;
use state::HostState;

pub use actions::{HostAction, UiActions};

pub mod actions;
mod app_settings;
mod banners;
mod command_palette;
mod dnd_paths;
mod file_dialog_commands;
pub mod home;
mod menu;
mod modals;
pub mod multi_setup;
mod notification;
mod persist;
mod plugin_manager;
mod quick_open;
mod recent_session;
pub mod registry;
pub mod session_setup;
pub mod shortcuts;
pub mod state;
pub mod storage;
mod tabs;

#[derive(Debug)]
pub struct Host {
    receivers: UiReceivers,
    senders: UiSenders,
    menu: MainMenuBar,
    tabs: HostTabs,
    notifications: NotificationUi,
    quick_open: QuickOpen,
    command_palette: CommandPalette,
    state: HostState,
    storage: HostStorage,
    ui_actions: UiActions,
}

impl Host {
    pub fn run(cli_cmds: Vec<CliCommand>) -> eframe::Result<()> {
        let native_options = NativeOptions {
            viewport: egui::ViewportBuilder::default()
                .with_title(app_info::TITLE)
                .with_icon(app_info::icon())
                .with_inner_size(vec2(1200., 900.))
                .with_min_inner_size(vec2(700.0, 550.0)),
            ..Default::default()
        };

        eframe::run_native(
            app_info::TITLE,
            native_options,
            Box::new(|ctx| {
                let (ui_comm, service_comm) = super::communication::init(ctx.egui_ctx.clone());

                let service_init = HostService::spawn(service_comm);
                let cmd_tx = ui_comm.senders.cmd_tx.clone();

                fonts::setup(&ctx.egui_ctx);

                let menu = MainMenuBar::new(cmd_tx.clone());
                let state = HostState::default();
                let mut host = Self {
                    menu,
                    receivers: ui_comm.receivers,
                    senders: ui_comm.senders,
                    notifications: NotificationUi::default(),
                    quick_open: QuickOpen::new(cmd_tx.clone()),
                    command_palette: CommandPalette::new(cmd_tx.clone()),
                    tabs: HostTabs::new(cmd_tx.clone()),
                    state,
                    storage: HostStorage::new(
                        cmd_tx,
                        service_init.recent_sessions,
                        service_init.app_settings,
                    ),
                    ui_actions: UiActions::new(service_init.tokio_handle),
                };

                ctx.egui_ctx.all_styles_mut(app_style::global_styles);

                persist::load(ctx.storage, &mut host);

                host.handle_cli(cli_cmds)?;

                Ok(Box::new(host))
            }),
        )
    }

    pub fn handle_cli(&mut self, cli_cmds: Vec<CliCommand>) -> anyhow::Result<()> {
        let Self {
            ui_actions,
            senders,
            ..
        } = self;

        for cli_cmd in cli_cmds {
            let host_cmd = match cli_cmd {
                CliCommand::OpenFiles { paths } => HostCommand::OpenFiles(paths),
                CliCommand::ProcessCommand { command, cwd } => {
                    let mut config = ProcessConfig::new();
                    config.command = command;
                    if let Some(cwd) = cwd {
                        config.cwd = cwd;
                    }
                    config.validate();

                    let valid_errs = config.validation_errors();
                    ensure!(
                        valid_errs.is_empty(),
                        "Process configurations are invalid. Errors: {}",
                        valid_errs.join(", ")
                    );

                    HostCommand::StartSession(Box::new(StartSessionParam {
                        parser: ParserConfig::Text,
                        source: ByteSourceConfig::Stream(StreamConfig::Process(config)),
                        session_setup_id: None,
                    }))
                }
            };
            ui_actions.try_send_command(&senders.cmd_tx, host_cmd);
        }

        Ok(())
    }

    fn handle_message(&mut self, message: HostMessage) {
        match message {
            HostMessage::SessionSetupOpened(setup_state) => {
                self.tabs.add_session_setup(*setup_state);
            }
            HostMessage::DltStatistics {
                setup_session_id,
                statistics,
            } => {
                if let Some(setup) = self
                    .tabs
                    .tabs_mut()
                    .iter_mut()
                    .filter_map(|tab| match tab {
                        HostTab::SessionSetup(setup) => Some(setup),
                        _ => None,
                    })
                    .find(|setup| setup.id() == setup_session_id)
                    && let ParserConfig::Dlt(config) = &mut setup.state.parser
                {
                    config.dlt_statistics = Some(Box::new(*statistics.unwrap_or_default()));
                    config.update_summary();
                }
            }
            HostMessage::SessionCreated {
                session,
                session_setup_id,
            } => {
                let SpawnedSession { ui_init, recent } = *session;
                let SpawnedRecentSession {
                    registration: recent_registration,
                    restore_state,
                } = recent;

                let mut session = Session::new(ui_init, self.senders.cmd_tx.clone());

                if let Some(restore_state) = restore_state {
                    session.apply_recent_restore(restore_state, &mut self.state.registry);
                }

                if let Some(recent_registration) = recent_registration {
                    let state = session.capture_opened_recent_state(&self.state.registry.filters);
                    let snapshot = recent_registration.into_snapshot(state);
                    self.storage.recent_sessions.register_session(snapshot);
                }

                self.tabs.add_session(session, session_setup_id);
            }
            HostMessage::MultiFilesSetup(state) => self.tabs.add_multi_files(*state),
            HostMessage::SessionSetupClosed { id } => self.tabs.close_session_setup(id),
            HostMessage::MultiSetupClose { id } => self.tabs.close_multi_setup(id),
            HostMessage::PresetsImported(imported) => self
                .state
                .handle_presets_imported(*imported, &mut self.ui_actions),
            HostMessage::PresetsExported { path, count } => {
                self.state
                    .handle_presets_exported(path, count, &mut self.ui_actions)
            }
            HostMessage::AppVersionUpdate(update) => {
                self.state.app_info.set_update_info(*update);
            }
            HostMessage::AppChangelog(changelog) => {
                if self.state.modals.open(HostModal::Changelog) {
                    self.state.app_info.set_changelog(*changelog);
                }
            }
            HostMessage::Storage(event) => self.storage.handle_event(event, &mut self.ui_actions),
            HostMessage::PluginsStateChanged(plugins) => {
                self.state.plugins.set(*plugins);
                self.tabs.handle_plugins_changed(&self.state.plugins);
            }
            HostMessage::PluginReadmeLoaded(response) => {
                self.tabs.handle_plugin_readme_loaded(*response);
            }
        }
    }

    fn render_ui(&mut self, ui: &mut Ui, _frame: &mut eframe::Frame) {
        if self.ui_actions.file_dialog.poll_dialog_task().is_pending() {
            self.file_dialog_overlay(ui);
        }

        Panel::top("menu_bar")
            .frame(Frame::side_top_panel(ui.style()))
            .show_inside(ui, |ui| {
                self.render_menu(ui);
            });

        Panel::top("tab_bar")
            .frame(
                Frame::new()
                    .inner_margin(0)
                    .fill(colors::main_accent_background(ui.visuals().dark_mode)),
            )
            .show_separator_line(false)
            .show_inside(ui, |ui| {
                self.render_tabs(ui);
            });

        let Self {
            storage,
            ui_actions,
            state,
            tabs,
            ..
        } = self;

        self.quick_open.render(ui, storage, ui_actions);
        self.command_palette
            .render(ui, state, tabs, storage, ui_actions);

        CentralPanel::default()
            .frame(Frame::central_panel(ui.style()).inner_margin(0))
            .show_inside(ui, |ui| {
                self.render_main(ui);

                if self.state.app_info.show_update_banner {
                    banners::update::render(&mut self.state.app_info, ui);
                }
            });

        self.render_active_modal(ui);
    }

    fn render_active_modal(&mut self, ui: &Ui) {
        let Some(active_modal) = self.state.modals.active().cloned() else {
            return;
        };

        match active_modal {
            HostModal::About => {
                if modals::about::render_modal(&mut self.state.app_info, ui) {
                    self.state.modals.close();
                }
            }
            HostModal::Shortcuts => {
                if shortcuts::modal::render_modal(ui) {
                    self.state.modals.close();
                }
            }
            HostModal::Changelog => {
                if modals::changelog::render_modal(&mut self.state.app_info, ui) {
                    self.state.modals.close();
                    self.state.app_info.clear_changelog();
                }
            }
            HostModal::Confirmation(dialog) => {
                if let Some(answer) = modals::confirmation::render_modal(&dialog, ui) {
                    self.state.modals.resolve_confirmation(answer);
                }
            }
        }
    }

    fn render_menu(&mut self, ui: &mut Ui) {
        let Self {
            menu,
            ui_actions,
            state,
            tabs,
            storage,
            ..
        } = self;
        menu.render(ui, ui_actions, state, tabs, storage);
    }

    fn render_tabs(&mut self, ui: &mut Ui) {
        let Self {
            state,
            notifications,
            ui_actions,
            tabs,
            ..
        } = self;

        ui.allocate_ui_with_layout(
            vec2(ui.available_width(), host_tab_bar_height()),
            Layout::right_to_left(Align::Center),
            |ui| {
                // Keep the tab strip gap explicit. The default item spacing would otherwise add a
                // second horizontal gap next to the utilities.
                ui.spacing_mut().item_spacing.x = 0.0;

                ui.add_space(4.0);
                render_tab_bar_utilities(state, tabs, notifications, ui);
                ui.add_space(8.0);

                ui.allocate_ui_with_layout(
                    vec2(ui.available_width(), host_tab_bar_height()),
                    Layout::left_to_right(Align::Max),
                    |ui| {
                        tabs.render_tab_bar(state, ui_actions, ui);
                    },
                );
            },
        );
    }

    fn render_main(&mut self, ui: &mut Ui) {
        let Self {
            ui_actions,
            state,
            storage,
            tabs,
            ..
        } = self;

        tabs.render_active_content(state, storage, ui_actions, ui);
    }

    fn handle_confirmation_results(&mut self) {
        if !self.state.modals.has_confirmation_results() {
            return;
        }

        self.tabs
            .handle_confirmation_results(&mut self.state.modals, &mut self.ui_actions);
    }

    fn handle_ui_actions(&mut self, ctx: &Context) {
        let mut changed = false;
        for notifi in self.ui_actions.drain_notifications() {
            changed = true;
            self.notifications.add(notifi);
        }

        let host_actions: Vec<_> = self.ui_actions.drain_host_actions().collect();
        for action in host_actions {
            changed = true;
            match action {
                HostAction::CloseSession(session_id) => {
                    self.tabs.close_session(
                        session_id,
                        &mut self.state.registry,
                        &mut self.ui_actions,
                    );
                }
            }
        }

        if changed {
            ctx.request_repaint();
        }
    }

    /// Check for changes in session and update recent session storage.
    fn handle_recent_sessions(&mut self) {
        let filters = &self.state.registry.filters;
        for tab in self.tabs.tabs_mut() {
            let HostTab::Session(session) = tab else {
                continue;
            };

            let Some(state) = session.take_recent_state_update(filters) else {
                continue;
            };
            let Some(source_key) = session.recent_session.source_key() else {
                continue;
            };

            self.storage
                .recent_sessions
                .update_session_state(source_key, state);
        }
    }

    fn file_dialog_overlay(&mut self, parent_ui: &Ui) {
        show_modal(
            parent_ui,
            "file dialog overlay",
            ModalSize::MaxWidth(350.0),
            |ui, _size| {
                ui.vertical_centered(|ui| {
                    ui.heading("File Dialog Open");

                    ui.add_space(6.);

                    ui.label(
                        "A file picker is currently open.\
                    If you don't see it, please check your taskbar or move this window",
                    );
                })
            },
        );
    }
}

fn render_tab_bar_utilities(
    state: &mut HostState,
    tabs: &HostTabs,
    notifications: &mut NotificationUi,
    ui: &mut Ui,
) {
    ui.scope(|ui| {
        ui.spacing_mut().interact_size.y = HOST_TAB_CONTROL_HEIGHT;
        ui.spacing_mut().button_padding.y = 0.0;

        notifications.render_content(ui);

        if tabs.show_right_panel_toggle(&state.plugins) {
            ui.add_space(6.0);

            render_panel_toggle(
                ui,
                &mut state.preferences.panels_visibility.right,
                icons::fill::SQUARE_HALF,
                "Right panel",
            );
        }

        if tabs.show_bottom_panel_toggle() {
            render_panel_toggle(
                ui,
                &mut state.preferences.panels_visibility.bottom,
                icons::fill::SQUARE_HALF_BOTTOM,
                "Bottom panel",
            );
        }
    });
}

fn render_panel_toggle(ui: &mut Ui, visible: &mut bool, icon: &str, panel_name: &str) {
    let button = Button::selectable(
        *visible,
        RichText::new(icon)
            .family(phosphor::fill_font_family())
            .size(16.0),
    )
    .frame(true)
    .frame_when_inactive(false)
    .ui(ui)
    .on_hover_ui(|ui| {
        ui.set_max_width(ui.spacing().tooltip_width);

        let hover_text = if *visible {
            format!("Hide {panel_name}")
        } else {
            format!("Show {panel_name}")
        };

        ui.label(hover_text);
    });

    if button.clicked() {
        *visible = !*visible;
    }
}

impl eframe::App for Host {
    fn logic(&mut self, _ctx: &Context, _frame: &mut eframe::Frame) {
        while let Ok(msg) = self.receivers.message_rx.try_recv() {
            self.handle_message(msg);
        }

        while let Ok(notification) = self.receivers.notification_rx.try_recv() {
            self.notifications.add(notification);
        }

        self.storage.poll_pending_save(&mut self.ui_actions);

        let registry = &self.state.registry;
        for tab in self.tabs.tabs_mut() {
            let HostTab::Session(session) = tab else {
                continue;
            };

            session.handle_messages(&mut self.ui_actions, &mut self.storage, registry);
        }

        self.handle_recent_sessions();
    }

    fn ui(&mut self, ui: &mut Ui, frame: &mut eframe::Frame) {
        let Self {
            quick_open,
            command_palette,
            storage,
            state,
            tabs,
            ui_actions,
            ..
        } = self;

        let overlay_was_open = quick_open.is_open() || command_palette.is_open();
        quick_open.handle_input(ui, storage, ui_actions);
        command_palette.handle_input(ui, state, tabs, storage, ui_actions);
        if !overlay_was_open && !quick_open.is_open() && !command_palette.is_open() {
            shortcuts::handler::handle(self, ui.ctx());
        }

        self.render_ui(ui, frame);
        self.handle_confirmation_results();

        dnd_paths::handle_path_drops(ui, &mut self.ui_actions, &self.senders.cmd_tx);

        self.handle_ui_actions(ui.ctx());
    }

    fn save(&mut self, storage: &mut dyn eframe::Storage) {
        persist::save(storage, self);
        self.storage.schedule_save(&mut self.ui_actions);
    }

    fn on_exit(&mut self) {
        trace!("App Shutdown requested.");

        const SESSION_SHUTDOWN_GRACE: Duration =
            Duration::from_millis(session_core::session::SHUTDOWN_TIMEOUT_IN_MS + 500);
        self.tabs
            .close_sessions_for_shutdown(SESSION_SHUTDOWN_GRACE);
        self.storage.wait_until_save(&mut self.ui_actions);

        let (confirm_tx, confirm_rx) = std::sync::mpsc::channel();
        let cmd = HostCommand::OnShutdown { confirm_tx };

        if self.senders.cmd_tx.try_send(cmd).is_err() {
            warn!("Sending shutdown confirmation failed. Shutting down without cleanup");
            return;
        }

        match confirm_rx.recv_timeout(Duration::from_millis(1000)) {
            Ok(()) => info!("Shutting down gracefully"),
            Err(_) => warn!("Graceful shutdown failed"),
        }
    }
}
