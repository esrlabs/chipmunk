use egui::Ui;

pub fn render_content(ui: &mut Ui) {
    ui.vertical(|ui| {
        ui.label("This parser doesn't require any kind of of configuration");
    });
}
