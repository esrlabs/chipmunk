use egui::Ui;

#[derive(Debug, Default)]
pub struct PresetsUI;

impl PresetsUI {
    pub fn render_content(&mut self, ui: &mut Ui) {
        ui.centered_and_justified(|ui| {
            ui.heading("Presets UI");
        });
    }
}
