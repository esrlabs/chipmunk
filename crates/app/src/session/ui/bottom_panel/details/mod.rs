use egui::{Frame, Label, Margin, RichText, Ui, Widget};
use memchr::memchr;
use stypes::GrabbedElement;

use crate::session::ui::{
    common::{
        ansi_text::{AnsiText, parse_ansi_text},
        log_table::text::ansi_layout_job,
    },
    shared::SessionShared,
};

#[derive(Debug, Default)]
pub struct DetailsUI {
    loaded_log: Option<LoadedDetailsLog>,
}

#[derive(Debug)]
struct LoadedDetailsLog {
    element: GrabbedElement,
    /// ANSI parse cache for grabbed element content.
    ansi_text: Option<AnsiText>,
}

impl LoadedDetailsLog {
    fn new(element: GrabbedElement) -> Self {
        let ansi_text = memchr(0x1b, element.content.as_bytes())
            .is_some()
            .then(|| parse_ansi_text(&element.content));

        Self { element, ansi_text }
    }
}

impl DetailsUI {
    pub fn handle_selected_log(&mut self, selected_row: Option<u64>, log: GrabbedElement) {
        if selected_row.is_some_and(|row| row == log.pos as u64) {
            self.loaded_log = Some(LoadedDetailsLog::new(log));
        }
    }

    pub fn render_content(&mut self, shared: &SessionShared, ui: &mut Ui) {
        if shared.logs.selected_count() != 1 {
            return;
        }

        let Some(selected_row) = shared.logs.single_selected_row() else {
            return;
        };

        Frame::NONE.inner_margin(Margin::same(4)).show(ui, |ui| {
            let Some(log) = self
                .loaded_log
                .as_ref()
                .filter(|log| log.element.pos == selected_row as usize)
            else {
                ui.add_space(10.);
                Label::new("Loading...").selectable(true).ui(ui);
                return;
            };

            ui.add_space(10.);

            Label::new(format!("Row #: {}", log.element.pos))
                .selectable(true)
                .ui(ui);

            ui.add_space(10.);

            match &log.ansi_text {
                Some(ansi_text) => {
                    let content = ansi_layout_job(ui, ansi_text, ui.visuals().strong_text_color());
                    Label::new(content).selectable(true).ui(ui);
                }
                None => {
                    let content = RichText::new(&log.element.content).monospace().strong();
                    Label::new(content).selectable(true).ui(ui);
                }
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use stypes::GrabbedElement;

    use super::DetailsUI;

    fn log(pos: usize) -> GrabbedElement {
        GrabbedElement {
            source_id: 0,
            content: format!("log {pos}"),
            pos,
            nature: 0,
        }
    }

    #[test]
    fn accepts_only_current_single_selection() {
        let mut details = DetailsUI::default();

        details.handle_selected_log(Some(4), log(4));

        assert_eq!(
            details.loaded_log.as_ref().map(|log| log.element.pos),
            Some(4)
        );
    }

    #[test]
    fn ignores_stale_selected_log_response() {
        let mut details = DetailsUI::default();

        details.handle_selected_log(Some(4), log(4));
        details.handle_selected_log(Some(7), log(4));
        details.handle_selected_log(None, log(9));

        assert_eq!(
            details.loaded_log.as_ref().map(|log| log.element.pos),
            Some(4)
        );
    }
}
