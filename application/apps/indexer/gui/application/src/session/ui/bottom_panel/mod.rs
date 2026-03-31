use std::rc::Rc;

use enum_iterator::all;
use tokio::sync::mpsc::Sender;

use egui::{Frame, Margin, Ui};

use crate::{
    host::{
        command::HostCommand,
        ui::{UiActions, registry::HostRegistry},
    },
    session::{
        command::SessionCommand,
        ui::{definitions::schema::LogSchema, shared::SessionShared},
    },
};
use chart::ChartUI;
use details::DetailsUI;
use library::LibraryUI;
use presets::PresetsUI;
use search::SearchUI;

mod library;
mod presets;
mod tab_types;

pub use tab_types::BottomTabType;

pub mod chart;
mod details;
mod search;

#[derive(Debug)]
pub struct BottomPanelUI {
    pub search: SearchUI,
    pub details: DetailsUI,
    pub library: LibraryUI,
    pub presets: PresetsUI,
    pub chart: ChartUI,
}

impl BottomPanelUI {
    pub fn new(
        cmd_tx: Sender<SessionCommand>,
        host_cmd_tx: Sender<HostCommand>,
        schema: Rc<dyn LogSchema>,
    ) -> Self {
        Self {
            search: SearchUI::new(cmd_tx.clone(), schema),
            details: DetailsUI::default(),
            library: LibraryUI::new(cmd_tx.clone()),
            presets: PresetsUI::new(cmd_tx.clone(), host_cmd_tx),
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
            BottomTabType::Library => {
                self.library
                    .render_content(shared, actions, &mut registry.filters, ui)
            }
            BottomTabType::Presets => self.presets.render_content(shared, actions, registry, ui),
            BottomTabType::Chart => {
                self.chart
                    .render_content(shared, actions, &registry.filters, ui)
            }
        }
    }

    fn render_tabs(&mut self, shared: &mut SessionShared, ui: &mut Ui) {
        Frame::NONE
            .inner_margin(Margin::symmetric(0, 4))
            .show(ui, |ui| {
                ui.horizontal_wrapped(|ui| {
                    for tab in all::<BottomTabType>() {
                        ui.selectable_value(&mut shared.bottom_tab, tab, tab.to_string());
                    }
                });
            });
    }
}
