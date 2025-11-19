use egui::{Label, RichText, Ui, Widget};

use crate::session::data::SessionDataState;

#[derive(Debug, Default)]
pub struct DetailsUI {}

impl DetailsUI {
    pub fn render_content(&mut self, data: &SessionDataState, ui: &mut Ui) {
        let Some(log) = &data.selected_log else {
            return;
        };

        ui.add_space(10.);

        Label::new(format!("Row #: {}", log.pos))
            .selectable(false)
            .ui(ui);

        ui.add_space(10.);

        let content = RichText::new(&log.content).strong();
        Label::new(content).ui(ui);
    }
}
