use egui::{CentralPanel, Context, Frame, TopBottomPanel};

use crate::host::communication::UiSenders;
use menu::MainMenuBar;
use state::{TabType, UiState};

mod menu;
mod state;

#[derive(Debug)]
pub struct UiComponents {
    senders: UiSenders,
    menu: MainMenuBar,
    state: UiState,
}

#[derive(Debug)]
pub struct SessionInfo {
    pub title: String,
}

impl UiComponents {
    pub fn new(senders: UiSenders) -> Self {
        let menu = MainMenuBar::new();

        Self {
            menu,
            senders,
            state: UiState::default(),
        }
    }

    pub fn add_session(&mut self, session: SessionInfo) {
        self.state.sessions.push(session);
        self.state.active_tab = TabType::Session(self.state.sessions.len() - 1);
    }

    pub fn update(&mut self, ctx: &Context, _frame: &mut eframe::Frame) {
        self.render_menu(ctx);
        self.render_tabs(ctx);

        CentralPanel::default()
            .frame(Frame::central_panel(&ctx.style()))
            .show(ctx, |ui| {
                ui.centered_and_justified(|ui| {
                    ui.heading("Welcome to Chipmunk");
                });
            });
    }

    fn render_menu(&mut self, ctx: &Context) {
        let Self { senders, menu, .. } = self;
        TopBottomPanel::top("menu_bar")
            .frame(Frame::side_top_panel(&ctx.style()))
            .show(ctx, |ui| {
                menu.render(ui, &senders.cmd_tx);
            });
    }

    fn render_tabs(&mut self, ctx: &Context) {
        let Self { state, .. } = self;
        TopBottomPanel::top("tab_bar")
            .frame(Frame::side_top_panel(&ctx.style()))
            .show(ctx, |ui| {
                ui.horizontal_wrapped(|ui| {
                    ui.selectable_value(&mut state.active_tab, TabType::Home, "Home");
                    for (idx, session) in state.sessions.iter().enumerate() {
                        ui.selectable_value(
                            &mut state.active_tab,
                            TabType::Session(idx),
                            format!("Session {}", session.title),
                        );
                    }
                });
            });
    }
}
