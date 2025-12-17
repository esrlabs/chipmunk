use egui::{Frame, Margin, Ui};

use crate::host::ui::{
    UiActions,
    session_setup::{
        RenderOutcome,
        state::{
            SessionSetupState,
            parsers::ParserConfig,
            sources::{ByteSourceConfig, SourceFileInfo, StreamConfig},
        },
    },
};

mod dlt;
mod process;
mod serial;
mod tcp;
mod udp;

pub fn render_content(
    state: &mut SessionSetupState,
    actions: &mut UiActions,
    ui: &mut Ui,
) -> RenderOutcome {
    let SessionSetupState { source, parser, .. } = state;

    match source {
        ByteSourceConfig::File(file) => render_file(file, parser, ui),
        ByteSourceConfig::Stream(stream) => render_stream(stream, actions, ui),
    }
}

/// Render main configuration for files sources.
fn render_file(file: &mut SourceFileInfo, parser: &ParserConfig, ui: &mut Ui) -> RenderOutcome {
    match parser {
        ParserConfig::Dlt(dlt) => dlt::render_statistics(file, dlt, ui),
        ParserConfig::SomeIP(..) | ParserConfig::Text | ParserConfig::Plugins => {
            RenderOutcome::None
        }
    }
}

/// Render main configuration for streams sources.
fn render_stream(stream: &mut StreamConfig, actions: &mut UiActions, ui: &mut Ui) -> RenderOutcome {
    let get_frame = |ui: &mut Ui| {
        Frame::group(ui.style())
            .fill(ui.style().visuals.faint_bg_color)
            .inner_margin(Margin::symmetric(10, 4))
            .outer_margin(Margin::symmetric(10, 4))
    };
    let mut output = RenderOutcome::None;
    ui.vertical(|ui| {
        get_frame(ui).show(ui, |ui| {
            ui.set_min_width(ui.available_width());
            ui.heading("Connection");
            ui.add_space(10.);
            output = match stream {
                StreamConfig::Process(config) => process::render_connection(config, actions, ui),
                StreamConfig::Tcp => tcp::render_connection(ui),
                StreamConfig::Udp => udp::render_connection(ui),
                StreamConfig::Serial => serial::render_connection(ui),
            };
        });

        get_frame(ui).show(ui, |ui| {
            ui.set_min_width(ui.available_width());
            ui.heading("Recent");
            ui.add_space(10.);
        });
    });

    output
}
