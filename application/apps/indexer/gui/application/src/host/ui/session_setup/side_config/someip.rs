use egui::Ui;

use crate::host::ui::{UiActions, session_setup::state::parsers::someip::SomeIpParserConfig};

use super::shared::fibex_file_selector;

pub fn render_content(config: &mut SomeIpParserConfig, actions: &mut UiActions, ui: &mut Ui) {
    fibex_file_selector("someip_fibex_dialog", &mut config.fibex_files, actions, ui);
}
