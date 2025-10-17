use egui::Ui;

#[derive(Debug)]
pub struct HomeView {}

impl HomeView {
    pub fn render_content(ui: &mut Ui) {
        ui.centered_and_justified(|ui| {
            ui.heading("Welcome to Chipmunk");
        });
    }
}
