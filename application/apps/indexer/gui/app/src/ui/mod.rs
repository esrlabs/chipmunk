use egui::{CentralPanel, Context, Frame};

#[derive(Debug)]
pub struct UiComponenets {}

impl UiComponenets {
    pub fn new() -> Self {
        Self {}
    }

    pub fn update(&mut self, ctx: &Context, _frame: &mut eframe::Frame) {
        CentralPanel::default()
            .frame(Frame::central_panel(&ctx.style()))
            .show(ctx, |ui| {
                ui.centered_and_justified(|ui| {
                    ui.heading("Welcome to Chipmunk");
                });
            });
    }
}
