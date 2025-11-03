use egui::{CentralPanel, Context, Frame, Layout, TopBottomPanel, Ui};
use uuid::Uuid;

use crate::{
    host::{
        communication::{UiHandle, UiReceivers, UiSenders},
        event::HostEvent,
        notification::AppNotification,
        ui::{home::HomeView, notification_ui::NotificationUi},
    },
    session::{InitSessionParams, ui::SessionUI},
};
use menu::MainMenuBar;
use state::{TabType, UiState};

pub use ui_actions::UiActions;

mod home;
mod menu;
mod notification_ui;
mod sessions_tabs;
mod state;
mod ui_actions;

#[derive(Debug)]
pub struct HostUI {
    sessions: Vec<SessionUI>,
    receivers: UiReceivers,
    senders: UiSenders,
    menu: MainMenuBar,
    notifications: NotificationUi,
    state: UiState,
    ui_actions: UiActions,
}

impl HostUI {
    pub fn new(ui_comm: UiHandle) -> Self {
        let menu = MainMenuBar::new();

        Self {
            sessions: Vec::new(),
            menu,
            receivers: ui_comm.receivers,
            senders: ui_comm.senders,
            notifications: NotificationUi::default(),
            state: UiState::default(),
            ui_actions: UiActions::default(),
        }
    }

    fn handle_event(&mut self, event: HostEvent, ctx: &Context) {
        match event {
            HostEvent::CreateSession(info) => self.add_session(info),
            HostEvent::CloseSession { session_id } => self.close_session(session_id),
            HostEvent::Close => ctx.send_viewport_cmd(egui::ViewportCommand::Close),
        }
    }

    pub fn add_session(&mut self, session: InitSessionParams) {
        let session = SessionUI::new(session);
        self.sessions.push(session);
        self.state.active_tab = TabType::Session(self.sessions.len() - 1);
    }

    pub fn add_notification(&mut self, notification: AppNotification) {
        self.notifications.add(notification);
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
                    "Close Session Event: Session with ID {session_id}\
                    doesn't exist in host UI struct"
                );
                panic!("Recieved close session for unknown session ID");
            }
        };

        // Handle current tab
        if let TabType::Session(current_idx) = self.state.active_tab {
            if current_idx == session_idx {
                self.state.active_tab = TabType::Home;
            }
            // Tabs after the deleted one will be shifted one place to the left.
            if current_idx > session_idx {
                self.state.active_tab = TabType::Session(current_idx.saturating_sub(1));
            }
        }

        self.sessions.remove(session_idx);
    }

    pub fn update(&mut self, ctx: &Context, frame: &mut eframe::Frame) {
        // Handle events & notifications
        while let Ok(event) = self.receivers.event_rx.try_recv() {
            self.handle_event(event, ctx);
        }

        while let Ok(notification) = self.receivers.notification_rx.try_recv() {
            self.add_notification(notification);
        }

        self.sessions
            .iter_mut()
            .for_each(|session| session.handle_events());

        // Render all UI components
        self.render_ui(ctx, frame);

        // Handle actions sent from UI components after rendering.
        self.handle_ui_actions(ctx);
    }

    fn render_ui(&mut self, ctx: &Context, _frame: &mut eframe::Frame) {
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
            .frame(Frame::central_panel(&ctx.style()))
            .show(ctx, |ui| {
                self.render_main(ui);
            });
    }

    fn render_menu(&mut self, ui: &mut Ui) {
        let Self {
            senders,
            menu,
            ui_actions,
            ..
        } = self;
        menu.render(ui, &senders.cmd_tx, ui_actions);
    }

    fn render_tabs(&mut self, ui: &mut Ui) {
        let Self {
            state,
            sessions,
            notifications,
            ui_actions,
            ..
        } = self;
        ui.horizontal_wrapped(|ui| {
            // Home
            ui.selectable_value(
                &mut state.active_tab,
                TabType::Home,
                egui::RichText::new("🏠").size(17.),
            )
            .on_hover_text("Home");

            sessions_tabs::render(state, &sessions, ui_actions, ui);

            // Notifications
            ui.with_layout(Layout::right_to_left(egui::Align::Center), |ui| {
                ui.add_space(3.);
                notifications.render_content(ui);
            });
        });
    }

    fn render_main(&mut self, ui: &mut Ui) {
        let Self { ui_actions, .. } = self;
        match self.state.active_tab {
            TabType::Home => HomeView::render_content(ui),
            TabType::Session(idx) => self.sessions[idx].render_content(ui_actions, ui),
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
}
