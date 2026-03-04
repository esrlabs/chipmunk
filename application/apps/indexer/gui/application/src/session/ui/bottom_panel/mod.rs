use std::rc::Rc;

use tokio::sync::mpsc::Sender;

use egui::{Frame, Margin, Ui};

use crate::{
    host::ui::{UiActions, registry::HostRegistry},
    session::{
        command::SessionCommand,
        ui::{definitions::schema::LogSchema, shared::SessionShared},
    },
};
use chart::ChartUI;
use details::DetailsUI;
use presets::PresetsUI;
use search::SearchUI;

mod tab_types;

pub use tab_types::BottomTabType;

pub mod chart;
mod details;
mod presets;
mod search;

#[derive(Debug)]
pub struct BottomPanelUI {
    pub search: SearchUI,
    pub details: DetailsUI,
    pub presets: PresetsUI,
    pub chart: ChartUI,
}

impl BottomPanelUI {
    pub fn new(cmd_tx: Sender<SessionCommand>, schema: Rc<dyn LogSchema>) -> Self {
        Self {
            search: SearchUI::new(cmd_tx.clone(), schema),
            details: DetailsUI::default(),
            presets: PresetsUI::new(cmd_tx.clone()),
            chart: ChartUI::new(cmd_tx),
        }
    }

    pub fn render_content(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut HostRegistry,
        ui: &mut Ui,
    ) {
        self.render_tabs(shared, ui);

        match shared.bottom_tab {
            BottomTabType::Search => {
                self.search
                    .render_content(shared, actions, &mut registry.filters, ui)
            }
            BottomTabType::Details => self.details.render_content(shared, ui),
            BottomTabType::Presets => {
                self.presets
                    .render_content(shared, actions, &mut registry.filters, ui)
            }
            BottomTabType::Chart => {
                self.chart
                    .render_content(shared, actions, &registry.filters, ui)
            }
        }
    }

    fn render_tabs(&mut self, shared: &mut SessionShared, ui: &mut Ui) {
        Frame::NONE
            .inner_margin(Margin::symmetric(0, 2))
            .show(ui, |ui| {
                ui.horizontal_wrapped(|ui| {
                    for tab in BottomTabType::all() {
                        ui.selectable_value(&mut shared.bottom_tab, *tab, tab.to_string());
                    }
                });
            });
    }
}
