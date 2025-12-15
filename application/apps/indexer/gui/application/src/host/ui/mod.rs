use eframe::NativeOptions;
use egui::{
    Align, CentralPanel, Context, Frame, Id, Layout, NumExt as _, TopBottomPanel, Ui, Widget, vec2,
};

use crate::{
    cli::CliCommand,
    host::{
        command::HostCommand,
        communication::{UiReceivers, UiSenders},
        message::HostMessage,
        service::HostService,
        ui::{home::HomeView, notification::NotificationUi, tabs::TabType},
    },
};
use menu::MainMenuBar;
use state::HostState;

pub use actions::UiActions;

mod actions;
mod home;
mod menu;
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

                let menu = MainMenuBar::new(ui_comm.senders.cmd_tx.clone());
                let mut host = Self {
                    menu,
                    receivers: ui_comm.receivers,
                    senders: ui_comm.senders,
                    notifications: NotificationUi::default(),
                    state: HostState::default(),
                    ui_actions: UiActions::new(tokio_handle),
                };

                host.handle_cli(cli_cmds);

                Ok(Box::new(host))
            }),
        )
    }

    pub fn handle_cli(&mut self, cli_cmds: Vec<CliCommand>) {
        let Self {
            ui_actions,
            senders,
            ..
        } = self;

        for cli_cmd in cli_cmds {
            match cli_cmd {
                CliCommand::OpenFile { path } => {
                    let host_cmd = HostCommand::OpenFiles(vec![path]);
                    ui_actions.try_send_command(&senders.cmd_tx, host_cmd);
                }
            }
        }
    }

    fn handle_message(&mut self, message: HostMessage, ctx: &Context) {
        match message {
            HostMessage::SessionSetupOpened(setup_state) => self
                .state
                .add_session_setup(setup_state, self.senders.cmd_tx.clone()),
            HostMessage::SessionCreated {
                session_info,
                session_setup_id,
            } => self.state.add_session(session_info, session_setup_id),
            HostMessage::SessionClosed { session_id } => self.state.close_session(session_id),
            HostMessage::SessionSetupClosed { id } => self.state.close_session_setup(id),
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
        }
    }

    fn handle_ui_actions(&mut self, ctx: &Context) {
        let mut changed = false;
        for notifi in self.ui_actions.drain_notifications() {
            changed = true;
            self.notifications.add(notifi);
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
        egui::Modal::new(Id::new("file dialog overlay"))
            .frame(Frame::window(&ctx.style()).inner_margin(egui::Margin::same(8)))
            .show(ctx, |ui| {
                ui.vertical_centered(|ui| {
                    let modal_width = (ctx.content_rect().width() - 20.)
                        .at_least(20.)
                        .at_most(350.);

                    ui.set_width(modal_width);
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
