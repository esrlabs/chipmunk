use egui::{Color32, Frame, Label, Margin, RichText, Ui, Widget};

use crate::host::{
    common::parsers::ParserNames,
    ui::{UiActions, session_setup::state::parsers::ParserConfig},
};

use super::SessionSetupState;

mod dlt;
mod plugins;
mod shared;
mod someip;
mod text;

pub fn render_content(state: &mut SessionSetupState, actions: &mut UiActions, ui: &mut Ui) {
    if !state.is_valid() {
        validation_errors(state, ui);
    }

    group_frame(ui).show(ui, |ui| {
        ui.set_min_width(ui.available_width());
        let title = format!("{} Parser", ParserNames::from(&state.parser));
        ui.heading(title);
        ui.add_space(6.);

        match &mut state.parser {
            ParserConfig::Dlt(dlt_parser_config) => {
                dlt::render_content(dlt_parser_config, actions, ui)
            }
            ParserConfig::SomeIP(config) => someip::render_content(config, actions, ui),
            ParserConfig::Text => text::render_content(ui),
            ParserConfig::Plugins => plugins::render_content(ui),
        }
    });
}

fn validation_errors(state: &SessionSetupState, ui: &mut Ui) {
    let errors = state.validatio_errors();
    if errors.is_empty() {
        return;
    }

    group_frame(ui).show(ui, |ui| {
        ui.set_min_width(ui.available_width());

        ui.heading("Error(s)");

        for err in errors {
            ui.add_space(5.);
            let txt = RichText::new(err).color(if ui.style().visuals.dark_mode {
                Color32::LIGHT_RED
            } else {
                Color32::DARK_RED
            });
            Label::new(txt).selectable(false).ui(ui);
        }
    });
}

fn group_frame(ui: &mut Ui) -> Frame {
    Frame::group(ui.style())
        .fill(ui.style().visuals.faint_bg_color)
        .inner_margin(Margin::symmetric(10, 8))
        .outer_margin(Margin::symmetric(0, 4))
}
