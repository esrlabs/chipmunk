use egui::{Label, RichText, Ui, Widget};

use crate::session::ui::shared::SessionShared;

#[derive(Debug, Default)]
pub struct DetailsUI {}

impl DetailsUI {
    pub fn render_content(&mut self, shared: &SessionShared, ui: &mut Ui) {
        let Some(log) = &shared.logs.selected_log else {
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
