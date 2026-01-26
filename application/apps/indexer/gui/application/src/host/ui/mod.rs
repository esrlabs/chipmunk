use anyhow::ensure;
use eframe::NativeOptions;
use egui::{Align, CentralPanel, Context, Frame, Layout, TopBottomPanel, Ui, Widget, vec2};
use itertools::Itertools;

use crate::{
    cli::CliCommand,
    common::{modal::show_modal, phosphor},
    host::{
        command::{HostCommand, StartSessionParam},
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
            tabs::TabType,
        },
    },
};
use menu::MainMenuBar;
use state::HostState;

pub use actions::{HostAction, UiActions};

mod actions;
mod home;
mod menu;
pub mod multi_setup;
mod notification;
pub mod session_setup;
mod state;
mod tabs;

const APP_TITLE: &str = "Chipmunk";

#[derive(Debug)]
pub struct Host {
    receivers: UiReceivers,
    senders: UiSenders,
    menu: MainMenuBar,
    notifications: NotificationUi,
    state: HostState,
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

                phosphor::init(&ctx.egui_ctx);

                let menu = MainMenuBar::new(ui_comm.senders.cmd_tx.clone());
                let mut host = Self {
                    menu,
                    receivers: ui_comm.receivers,
                    senders: ui_comm.senders,
                    notifications: NotificationUi::default(),
                    state: HostState::default(),
                    ui_actions: UiActions::new(tokio_handle),
                };

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

    fn handle_message(&mut self, message: HostMessage, ctx: &Context) {
        match message {
            HostMessage::SessionSetupOpened(setup_state) => self
                .state
                .add_session_setup(setup_state, self.senders.cmd_tx.clone()),
            HostMessage::SessionCreated {
                session_params,
                session_setup_id,
            } => self.state.add_session(session_params, session_setup_id),
            HostMessage::MultiFilesSetup(state) => self
                .state
                .add_multi_files(state, self.senders.cmd_tx.clone()),
            HostMessage::SessionSetupClosed { id } => self.state.close_session_setup(id),
            HostMessage::MultiSetupClose { id } => self.state.close_multi_setup(id),
            HostMessage::Shutdown => ctx.send_viewport_cmd(egui::ViewportCommand::Close),
        }
    }

    fn render_ui(&mut self, ctx: &Context, _frame: &mut eframe::Frame) {
        if self.ui_actions.file_dialog.poll_dialog_task() {
            self.file_dialog_overlay(ctx);
        }

        TopBottomPanel::top("menu_bar")
            .frame(Frame::side_top_panel(&ctx.style()))
            .show(ctx, |ui| {
                self.render_menu(ui);
            });

        TopBottomPanel::top("tab_bar")
            .frame(Frame::side_top_panel(&ctx.style()))
            .show(ctx, |ui| {
                self.render_tabs(ui);
            });

        CentralPanel::default()
            .frame(Frame::central_panel(&ctx.style()).inner_margin(0))
            .show(ctx, |ui| {
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

            // Notifications
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                ui.add_space(3.);
                notifications.render_content(ui);
            });
        });
    }

    fn render_main(&mut self, ui: &mut Ui) {
        let Self { ui_actions, .. } = self;
        match *self.state.active_tab() {
            TabType::Home => HomeView::render_content(ui),
            TabType::Session(id) => self
                .state
                .sessions
                .get_mut(&id)
                .expect("Session with provieded ID from active tab must exist")
                .render_content(ui_actions, ui),
            TabType::SessionSetup(id) => self
                .state
                .session_setups
                .get_mut(&id)
                .expect("Session Setup with provided ID form active tab must exist")
                .render_content(ui_actions, ui),
            TabType::MultiFileSetup(id) => self
                .state
                .multi_setups
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
                    self.state.sessions[&session_id].on_close_session(&mut self.ui_actions);
                    self.state.close_session(session_id);
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

                egui::Label::new(
                    "A file picker is currently open.\
                    If you don't see it, please check your taskbar or move this window",
                )
                .selectable(false)
                .ui(ui);
            })
        });
    }
}

impl eframe::App for Host {
    fn update(&mut self, ctx: &Context, frame: &mut eframe::Frame) {
        // Handle incoming messages & notifications
        while let Ok(msg) = self.receivers.message_rx.try_recv() {
            self.handle_message(msg, ctx);
        }

        while let Ok(notification) = self.receivers.notification_rx.try_recv() {
            self.notifications.add(notification);
        }

        self.state
            .sessions
            .iter_mut()
            .for_each(|(_id, session)| session.handle_messages(&mut self.ui_actions));

        // Render all UI components
        self.render_ui(ctx, frame);

        // Handle actions sent from UI components after rendering.
        self.handle_ui_actions(ctx);
    }
}
