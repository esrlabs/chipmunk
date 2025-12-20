use egui::{Label, Ui, Widget};

pub fn render_content(ui: &mut Ui) {
    ui.vertical(|ui| {
        Label::new("This parser doesn't require any kind of of configuration")
            .selectable(false)
            .ui(ui);
    });
}
