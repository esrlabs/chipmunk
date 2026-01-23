use egui::{Align, Frame, Label, Layout, Margin, RichText, TextEdit, Ui, Widget as _};

use crate::host::ui::{
    UiActions,
    session_setup::{
        RenderOutcome, start_session_on_enter,
        state::{
            SessionSetupState,
            parsers::ParserConfig,
            sources::{ByteSourceConfig, StreamConfig},
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
        ByteSourceConfig::File(_) => render_file(parser, ui),
        ByteSourceConfig::Stream(stream) => render_stream(stream, actions, ui),
    }
}

/// Render main configuration for files sources.
fn render_file(parser: &mut ParserConfig, ui: &mut Ui) -> RenderOutcome {
    match parser {
        ParserConfig::Dlt(dlt) => dlt::render_statistics(dlt, ui),
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
    ui.with_layout(Layout::top_down_justified(Align::Min), |ui| {
        get_frame(ui).show(ui, |ui| {
            ui.heading("Connection");
            ui.add_space(10.);
            output = match stream {
                StreamConfig::Process(config) => process::render_connection(config, actions, ui),
                StreamConfig::Tcp(config) => tcp::render_connection(config, ui),
                StreamConfig::Udp(config) => udp::render_connection(config, ui),
                StreamConfig::Serial(config) => serial::render_connection(config, ui),
            };
        });

        get_frame(ui).show(ui, |ui| {
            ui.heading("Recent");
            ui.add_space(10.);
        });
    });

    output
}

/// Specifies the needed functionality to be used with the function [`render_socket_address`].
trait ConfigBindAddress {
    fn bind_addr(&mut self) -> &mut String;
    fn validate(&mut self);
    fn is_valid(&self) -> bool;
    fn bind_err_msg(&self) -> Option<&str>;
}

/// General function to render the binding address for TCP & UDP.
fn render_socket_address<C: ConfigBindAddress>(config: &mut C, ui: &mut Ui) -> RenderOutcome {
    let mut outcome = RenderOutcome::None;

    ui.vertical(|ui| {
        Label::new("Socket Address:").selectable(false).ui(ui);

        let ip_txt_res = TextEdit::singleline(config.bind_addr())
            .vertical_align(Align::Center)
            .desired_width(200.)
            .hint_text("127.0.0.1:8080")
            .show(ui)
            .response;

        if ip_txt_res.changed() {
            config.validate();
        }

        start_session_on_enter(&ip_txt_res, || config.is_valid(), &mut outcome);

        ui.vertical(|ui| {
            ui.set_height(20.);
            if let Some(err_msg) = config.bind_err_msg() {
                let err_txt = RichText::new(err_msg)
                    .size(10.5)
                    .small()
                    .color(ui.style().visuals.warn_fg_color);
                Label::new(err_txt).selectable(false).ui(ui);
            }
        });
    });

    outcome
}
