use egui::{CentralPanel, Context, Frame, TopBottomPanel};

use crate::{core::communication::UiSenders, ui::menu_bar::AppMenuBar};

mod menu_bar;

#[derive(Debug)]
pub struct UiComponents {
    senders: UiSenders,
    menu: AppMenuBar,
}

impl UiComponents {
    pub fn new(senders: UiSenders) -> Self {
        let menu = AppMenuBar::new();

        Self { menu, senders }
    }

    pub fn update(&mut self, ctx: &Context, _frame: &mut eframe::Frame) {
        self.render_menu(ctx);

        CentralPanel::default()
            .frame(Frame::central_panel(&ctx.style()))
            .show(ctx, |ui| {
                ui.centered_and_justified(|ui| {
                    ui.heading("Welcome to Chipmunk");
                });
            });
    }

    fn render_menu(&mut self, ctx: &Context) {
        let Self { senders, menu } = self;
        TopBottomPanel::top("menu_bar")
            .frame(Frame::side_top_panel(&ctx.style()))
            .show(ctx, |ui| {
                menu.render(ui, &senders.cmd_tx);
            });
    }
}
