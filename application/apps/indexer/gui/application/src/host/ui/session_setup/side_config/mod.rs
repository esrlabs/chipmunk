use egui::Ui;

use crate::host::ui::{UiActions, session_setup::state::parsers::ParserConfig};

use super::SessionSetupState;

mod dlt;
mod plugins;
mod shared;
mod someip;
mod text;

pub fn render_content(state: &mut SessionSetupState, actions: &mut UiActions, ui: &mut Ui) {
    match &mut state.parser {
        ParserConfig::Dlt(dlt_parser_config) => dlt::render_content(dlt_parser_config, actions, ui),
        ParserConfig::SomeIP(config) => someip::render_content(config, actions, ui),
        ParserConfig::Text => text::render_content(ui),
        ParserConfig::Plugins => plugins::render_content(ui),
    }
}
