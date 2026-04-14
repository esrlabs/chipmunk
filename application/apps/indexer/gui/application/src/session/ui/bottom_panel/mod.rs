use std::rc::Rc;

use tokio::sync::mpsc::Sender;

use egui::{Align, Label, RichText, Sense, TextStyle, Ui, vec2};

use crate::{
    common::ui::tab_strip::{TabEvent, TabSpec, TabStrip, TabWidth},
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

const BOTTOM_TAB_TOP_GAP: f32 = 4.0;
const BOTTOM_TAB_WIDTH: f32 = 80.0;

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
        let selected_tab = shared.bottom_tab;
        let selected_tab_index = match selected_tab {
            BottomTabType::Search => 0,
            BottomTabType::Details => 1,
            BottomTabType::Library => 2,
            BottomTabType::Presets => 3,
            BottomTabType::Chart => 4,
        };
        let strip_id = ui.id().with("session_bottom_tab_strip");
        let strip = TabStrip::new(strip_id, selected_tab_index)
            .top_gap(BOTTOM_TAB_TOP_GAP)
            .rail_side_padding(4.0);
        let (control_rect, _) = ui.allocate_exact_size(
            vec2(ui.available_width(), strip.total_height()),
            Sense::hover(),
        );
        let tabs = [
            BottomTabType::Search,
            BottomTabType::Details,
            BottomTabType::Library,
            BottomTabType::Presets,
            BottomTabType::Chart,
        ]
        .map(|tab| {
            TabSpec::new(
                strip_id.with(("session_bottom_tab", tab)),
                TabWidth::Exact(BOTTOM_TAB_WIDTH),
            )
            .tooltip(tab.label())
        });

        match strip.show(ui, control_rect, &tabs, |ui, idx| {
            let label = bottom_tab_from_index(idx).label();
            ui.add(
                Label::new(RichText::new(label).text_style(TextStyle::Button))
                    .truncate()
                    .show_tooltip_when_elided(false)
                    .halign(Align::Center),
            );
        }) {
            Some(TabEvent::Select(idx)) => shared.bottom_tab = bottom_tab_from_index(idx),
            Some(TabEvent::Close(_)) | None => {}
        }
    }
}

fn bottom_tab_from_index(idx: usize) -> BottomTabType {
    match idx {
        0 => BottomTabType::Search,
        1 => BottomTabType::Details,
        2 => BottomTabType::Library,
        3 => BottomTabType::Presets,
        4 => BottomTabType::Chart,
        _ => panic!("Bottom tab index out of range: {idx}"),
    }
}
