use egui::{Frame, Margin, Ui};
use state::{BottomTabType, BottomUiState};

use crate::session::{communication::UiSenders, data::SessionState};
use chart::ChartUI;
use details::DetailsUI;
use presets::PresetsUI;
use search::SearchUI;

pub mod state;

mod chart;
mod details;
mod presets;
mod search;

#[derive(Debug, Default)]
pub struct BottomPanelUI {
    state: BottomUiState,
    search: SearchUI,
    details: DetailsUI,
    presets: PresetsUI,
    chart: ChartUI,
}

impl BottomPanelUI {
    pub fn render_content(&mut self, data: &SessionState, senders: &UiSenders, ui: &mut Ui) {
        self.render_tabs(ui);

        match self.state.active_tab {
            BottomTabType::Search => self.search.render_content(data, senders, ui),
            BottomTabType::Details => self.details.render_content(data, senders, ui),
            BottomTabType::Presets => self.presets.render_content(data, senders, ui),
            BottomTabType::Chart => self.chart.render_content(data, senders, ui),
        }
    }

    fn render_tabs(&mut self, ui: &mut Ui) {
        Frame::NONE
            .inner_margin(Margin::symmetric(0, 2))
            .show(ui, |ui| {
                ui.horizontal_wrapped(|ui| {
                    for tab in BottomTabType::all() {
                        ui.selectable_value(&mut self.state.active_tab, *tab, tab.to_string());
                    }
                });
            });
    }
}
