use egui::{CentralPanel, Context, Frame, Layout, TopBottomPanel, Ui};

use crate::{
    host::{
        communication::UiSenders,
        notification::AppNotification,
        ui::{home::HomeView, notification_ui::NotificationUi},
    },
    session::{InitSessionParams, ui::SessionUI},
};
use menu::MainMenuBar;
use state::{TabType, UiState};

mod home;
mod menu;
mod notification_ui;
mod state;

#[derive(Debug)]
pub struct UiComponents {
    pub sessions: Vec<SessionUI>,
    senders: UiSenders,
    menu: MainMenuBar,
    notifications: NotificationUi,
    state: UiState,
}

impl UiComponents {
    pub fn new(senders: UiSenders) -> Self {
        let menu = MainMenuBar::new();

        Self {
            sessions: Vec::new(),
            menu,
            senders,
            notifications: NotificationUi::default(),
            state: UiState::default(),
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

    pub fn update(&mut self, ctx: &Context, _frame: &mut eframe::Frame) {
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
        let Self { senders, menu, .. } = self;
        menu.render(ui, &senders.cmd_tx);
    }

    fn render_tabs(&mut self, ui: &mut Ui) {
        let Self {
            state,
            sessions,
            notifications,
            ..
        } = self;
        ui.horizontal_wrapped(|ui| {
            // Home
            ui.selectable_value(&mut state.active_tab, TabType::Home, "Home");

            // Sessions
            for (idx, session) in sessions.iter().enumerate() {
                ui.selectable_value(
                    &mut state.active_tab,
                    TabType::Session(idx),
                    format!("Session {}", session.get_info().title),
                );
            }

            // Notifications
            ui.with_layout(Layout::right_to_left(egui::Align::Center), |ui| {
                ui.add_space(3.);
                notifications.render_content(ui);
            });
        });
    }

    fn render_main(&mut self, ui: &mut Ui) {
        match self.state.active_tab {
            TabType::Home => HomeView::render_content(ui),
            TabType::Session(idx) => self.sessions[idx].render_content(ui),
        }
    }
}
