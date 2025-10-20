use egui::{CentralPanel, Context, Frame, TopBottomPanel, Ui};

use crate::{
    host::{communication::UiSenders, ui::home::HomeView},
    session::{InitSessionParams, ui::SessionUI},
};
use menu::MainMenuBar;
use state::{TabType, UiState};

mod home;
mod menu;
mod state;

#[derive(Debug)]
pub struct UiComponents {
    pub sessions: Vec<SessionUI>,
    senders: UiSenders,
    menu: MainMenuBar,
    state: UiState,
}

impl UiComponents {
    pub fn new(senders: UiSenders) -> Self {
        let menu = MainMenuBar::new();

        Self {
            sessions: Vec::new(),
            menu,
            senders,
            state: UiState::default(),
        }
    }

    pub fn add_session(&mut self, session: InitSessionParams) {
        let session = SessionUI::new(session);
        self.sessions.push(session);
        self.state.active_tab = TabType::Session(self.sessions.len() - 1);
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
            state, sessions, ..
        } = self;
        ui.horizontal_wrapped(|ui| {
            ui.selectable_value(&mut state.active_tab, TabType::Home, "Home");
            for (idx, session) in sessions.iter().enumerate() {
                ui.selectable_value(
                    &mut state.active_tab,
                    TabType::Session(idx),
                    format!("Session {}", session.get_info().title),
                );
            }
        });
    }

    fn render_main(&mut self, ui: &mut Ui) {
        match self.state.active_tab {
            TabType::Home => HomeView::render_content(ui),
            TabType::Session(idx) => self.sessions[idx].render_content(ui),
        }
    }
}
