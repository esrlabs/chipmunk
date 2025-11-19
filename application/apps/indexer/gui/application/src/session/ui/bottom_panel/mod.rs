use tokio::sync::mpsc::Sender;

use egui::{Frame, Margin, Ui};

use crate::{
    host::ui::UiActions,
    session::{
        command::{SessionBlockingCommand, SessionCommand},
        data::SessionDataState,
        ui::state::SessionUiState,
    },
};
use chart::ChartUI;
use details::DetailsUI;
use presets::PresetsUI;
use search::SearchUI;

mod tab_types;

pub use tab_types::BottomTabType;

mod chart;
mod details;
mod presets;
mod search;

#[derive(Debug)]
pub struct BottomPanelUI {
    search: SearchUI,
    details: DetailsUI,
    presets: PresetsUI,
    chart: ChartUI,
}

impl BottomPanelUI {
    pub fn new(
        cmd_tx: Sender<SessionCommand>,
        block_cmd_tx: Sender<SessionBlockingCommand>,
    ) -> Self {
        Self {
            search: SearchUI::new(cmd_tx.clone(), block_cmd_tx),
            details: DetailsUI::default(),
            presets: PresetsUI::default(),
            chart: ChartUI::new(cmd_tx),
        }
    }

    pub fn render_content(
        &mut self,
        data: &SessionDataState,
        ui_state: &mut SessionUiState,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        self.render_tabs(ui_state, ui);

        match ui_state.bottom_panel.active_tab {
            BottomTabType::Search => self.search.render_content(data, ui_state, actions, ui),
            BottomTabType::Details => self.details.render_content(data, ui),
            BottomTabType::Presets => self.presets.render_content(ui),
            BottomTabType::Chart => self.chart.render_content(data, ui_state, actions, ui),
        }
    }

    fn render_tabs(&mut self, ui_state: &mut SessionUiState, ui: &mut Ui) {
        Frame::NONE
            .inner_margin(Margin::symmetric(0, 2))
            .show(ui, |ui| {
                ui.horizontal_wrapped(|ui| {
                    for tab in BottomTabType::all() {
                        ui.selectable_value(
                            &mut ui_state.bottom_panel.active_tab,
                            *tab,
                            tab.to_string(),
                        );
                    }
                });
            });
    }
}
