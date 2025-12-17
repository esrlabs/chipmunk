use egui::{Label, Ui, Widget};

pub fn render_content(ui: &mut Ui) {
    ui.vertical(|ui| {
        ui.heading("Plain Text Parser");
        ui.add_space(4.);
        Label::new("This parser doesn't require any kind of of configuration")
            .selectable(false)
            .ui(ui);
    });
}
