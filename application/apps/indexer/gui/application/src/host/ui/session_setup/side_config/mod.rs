use egui::Ui;

use crate::host::{common::parsers::ParserConfig, ui::UiActions};

use super::SessionSetupState;

mod dlt;
mod plugins;
mod someip;
mod text;

pub fn render_content(state: &mut SessionSetupState, actions: &mut UiActions, ui: &mut Ui) {
    match &mut state.parser {
        ParserConfig::Dlt(dlt_parser_config) => dlt::render_content(dlt_parser_config, actions, ui),
        ParserConfig::SomeIP => someip::render_content(ui),
        ParserConfig::Text => text::render_content(ui),
        ParserConfig::Plugins => plugins::render_content(ui),
    }
}
