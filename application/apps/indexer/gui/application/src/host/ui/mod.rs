use std::time::Duration;

use anyhow::ensure;
use eframe::NativeOptions;
use egui::{
    Align, Button, CentralPanel, Context, Frame, Layout, Panel, RichText, Ui, Widget, vec2,
};
use itertools::Itertools;
use log::{info, trace, warn};

use crate::{
    cli::CliCommand,
    common::{
        modal::show_modal,
        phosphor::{self, icons},
    },
    host::{
        command::{HostCommand, StartSessionParam},
        common::app_style,
        communication::{UiReceivers, UiSenders},
        message::HostMessage,
        service::HostService,
        ui::{
            home::HomeView,
            notification::NotificationUi,
            session_setup::state::{
                parsers::ParserConfig,
                sources::{ByteSourceConfig, ProcessConfig, StreamConfig},
            },
            storage::HostStorage,
            tabs::TabType,
        },
    },
};
use menu::MainMenuBar;
use state::HostState;

pub use actions::{HostAction, UiActions};

pub mod actions;
pub mod home;
mod menu;
pub mod multi_setup;
mod notification;
pub mod registry;
pub mod session_setup;
pub mod state;
pub mod storage;
mod tabs;

const APP_TITLE: &str = "Chipmunk";

#[derive(Debug)]
pub struct Host {
    receivers: UiReceivers,
    senders: UiSenders,
    menu: MainMenuBar,
    notifications: NotificationUi,
    state: HostState,
    storage: HostStorage,
    ui_actions: UiActions,
}

impl Host {
    pub fn run(cli_cmds: Vec<CliCommand>) -> eframe::Result<()> {
        let native_options = NativeOptions {
            viewport: egui::ViewportBuilder::default()
                .with_title(APP_TITLE)
                .with_inner_size(vec2(1200., 900.)),
            ..Default::default()
        };

        eframe::run_native(
            APP_TITLE,
            native_options,
            Box::new(|ctx| {
                let (ui_comm, service_comm) = super::communication::init(ctx.egui_ctx.clone());

                let tokio_handle = HostService::spawn(service_comm);
                let cmd_tx = ui_comm.senders.cmd_tx.clone();

                phosphor::init(&ctx.egui_ctx);

                let menu = MainMenuBar::new(cmd_tx.clone());
                let state = HostState::new(cmd_tx.clone());
                let mut host = Self {
                    menu,
                    receivers: ui_comm.receivers,
                    senders: ui_comm.senders,
                    notifications: NotificationUi::default(),
                    state,
                    storage: HostStorage::new(cmd_tx),
                    ui_actions: UiActions::new(tokio_handle),
                };

                ctx.egui_ctx.all_styles_mut(app_style::global_styles);

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
            HostMessage::SessionSetupOpened(setup_state) => self
                .state
                .add_session_setup(*setup_state, self.senders.cmd_tx.clone()),
            HostMessage::DltStatistics {
                setup_session_id,
                statistics,
            } => {
                if let Some(setup) = self.state.session_setups.get_mut(&setup_session_id)
                    && let ParserConfig::Dlt(config) = &mut setup.state.parser
                {
                    config.dlt_statistics = Some(Box::new(*statistics.unwrap_or_default()));
                    config.update_summary();
                }
            }
            HostMessage::SessionCreated {
                mut session_params,
                session_setup_id,
            } => {
                if let Some(config) = session_params.session_config.take() {
                    self.storage
                        .recent_sessions
                        .register_session(session_params.session_info.title.clone(), config);
                }

                self.state.add_session(
                    *session_params,
                    session_setup_id,
                    self.senders.cmd_tx.clone(),
                )
            }
            HostMessage::MultiFilesSetup(state) => self
                .state
                .add_multi_files(*state, self.senders.cmd_tx.clone()),
            HostMessage::SessionSetupClosed { id } => self.state.close_session_setup(id),
            HostMessage::MultiSetupClose { id } => self.state.close_multi_setup(id),
            HostMessage::PresetsImported(imported) => self
                .state
                .handle_presets_imported(*imported, &mut self.ui_actions),
            HostMessage::PresetsExported { path, count } => {
                self.state
                    .handle_presets_exported(path, count, &mut self.ui_actions)
            }
            HostMessage::Storage(event) => self.storage.handle_event(event, &mut self.ui_actions),
        }
    }

    fn render_ui(&mut self, ui: &mut Ui, _frame: &mut eframe::Frame) {
        if self.ui_actions.file_dialog.poll_dialog_task().is_pending() {
            self.file_dialog_overlay(ui.ctx());
        }

        Panel::top("menu_bar")
            .frame(Frame::side_top_panel(ui.style()))
            .show_inside(ui, |ui| {
                self.render_menu(ui);
            });

        Panel::top("tab_bar")
            .frame(Frame::side_top_panel(ui.style()))
            .show_inside(ui, |ui| {
                self.render_tabs(ui);
            });

        CentralPanel::default()
            .frame(Frame::central_panel(ui.style()).inner_margin(0))
            .show_inside(ui, |ui| {
                self.render_main(ui);
            });
    }

    fn render_menu(&mut self, ui: &mut Ui) {
        let Self {
            menu, ui_actions, ..
        } = self;
        menu.render(ui, ui_actions);
    }

    fn render_tabs(&mut self, ui: &mut Ui) {
        let Self {
            state,
            notifications,
            ui_actions,
            ..
        } = self;
        ui.horizontal_wrapped(|ui| {
            // Tabs
            tabs::render_all_tabs(state, ui_actions, ui);

            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                ui.add_space(3.);
                // Notifications
                notifications.render_content(ui);

                // Session panels visibility
                if state.show_session_panel_toggles() {
                    render_session_panel_toggle(
                        ui,
                        &mut state.session_panels_visibility.right,
                        icons::fill::SQUARE_HALF,
                        "Right panel",
                    );
                    render_session_panel_toggle(
                        ui,
                        &mut state.session_panels_visibility.bottom,
                        icons::fill::SQUARE_HALF_BOTTOM,
                        "Bottom panel",
                    );
                }
            });
        });
    }

    fn render_main(&mut self, ui: &mut Ui) {
        let Self {
            ui_actions,
            state,
            storage,
            ..
        } = self;

        let active_tab = state.active_tab();

        let HostState {
            sessions,
            session_setups,
            multi_setups,
            session_panels_visibility,
            registry,
            ..
        } = state;

        match active_tab {
            TabType::Home => self.state.home_view.render_content(storage, ui_actions, ui),
            TabType::Session(id) => sessions
                .get_mut(&id)
                .expect("Session with provieded ID from active tab must exist")
                .render_content(ui_actions, registry, session_panels_visibility, ui),
            TabType::SessionSetup(id) => session_setups
                .get_mut(&id)
                .expect("Session Setup with provided ID form active tab must exist")
                .render_content(ui_actions, ui),
            TabType::MultiFileSetup(id) => multi_setups
                .get_mut(&id)
                .expect("Multiple files setups with provided ID from active tab must exist")
                .render_content(ui_actions, ui),
        }
    }

    fn handle_ui_actions(&mut self, ctx: &Context) {
        let mut changed = false;
        for notifi in self.ui_actions.drain_notifications() {
            changed = true;
            self.notifications.add(notifi);
        }

        for action in self.ui_actions.drain_host_actions().collect_vec() {
            changed = true;
            match action {
                HostAction::CloseSession(session_id) => {
                    self.state.close_session(session_id, &mut self.ui_actions);
                }
            }
        }

        if changed {
            ctx.request_repaint();
        }
    }

    /// Renders a blocking modal to inform the user that a system file dialog
    /// is currently active.
    ///
    /// This overlay prevents interaction with the main app and provides hints to
    /// locate the external dialog window.
    fn file_dialog_overlay(&mut self, ctx: &Context) {
        show_modal(ctx, "file dialog overlay", 350.0, |ui| {
            ui.vertical_centered(|ui| {
                ui.heading("File Dialog Open");

                ui.add_space(6.);

                ui.label(
                    "A file picker is currently open.\
                    If you don't see it, please check your taskbar or move this window",
                );
            })
        });
    }
}

fn render_session_panel_toggle(ui: &mut Ui, visible: &mut bool, icon: &str, panel_name: &str) {
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

        self.state
            .sessions
            .iter_mut()
            .for_each(|(_id, session)| session.handle_messages(&mut self.ui_actions));
    }

    fn ui(&mut self, ui: &mut Ui, frame: &mut eframe::Frame) {
        self.render_ui(ui, frame);
        self.handle_ui_actions(ui.ctx());
    }

    fn save(&mut self, _storage: &mut dyn eframe::Storage) {
        self.storage.schedule_save(&mut self.ui_actions);
    }

    fn on_exit(&mut self) {
        trace!("App Shutdown requested.");
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
