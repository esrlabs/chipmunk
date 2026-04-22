use core::slice;

use egui::{Align, Layout, Margin, ScrollArea, TextEdit, Ui};
use tokio::sync::mpsc::Sender;

use crate::{
    common::ui::visibility_tracker::VisibilityTracker,
    host::{
        command::HostCommand,
        common::{
            parsers::ParserNames,
            sources::StreamNames,
            ui_utls::{general_group_frame, show_validation_message},
        },
        ui::{
            UiActions,
            session_setup::{
                RenderOutcome, start_session_on_enter,
                state::{
                    SessionSetupState,
                    parsers::ParserConfig,
                    sources::{ByteSourceConfig, SourceFileInfo, StreamConfig},
                },
            },
            storage::RecentSessionsStorage,
        },
    },
};

mod dlt;
pub mod process;
mod recent;
mod serial;
mod tcp;
pub mod udp;

pub fn render_content(
    state: &mut SessionSetupState,
    input_visibility: &mut VisibilityTracker,
    recent_sessions: &mut RecentSessionsStorage,
    cmd_tx: &Sender<HostCommand>,
    actions: &mut UiActions,
    ui: &mut Ui,
) -> RenderOutcome {
    let SessionSetupState { id, source, parser } = state;

    match source {
        ByteSourceConfig::File(file) => render_files(slice::from_ref(file), parser, ui),
        ByteSourceConfig::Concat(files) => render_files(files, parser, ui),
        ByteSourceConfig::Stream(stream) => {
            let session_setup_id = *id;
            let current_stream = StreamNames::from(&*stream);
            let current_parser = ParserNames::from(&*parser);
            let get_frame = |ui: &mut Ui| {
                general_group_frame(ui)
                    .inner_margin(Margin::symmetric(10, 4))
                    .outer_margin(Margin::symmetric(10, 4))
            };
            let mut output = RenderOutcome::None;

            ui.with_layout(Layout::top_down_justified(Align::Min), |ui| {
                get_frame(ui).show(ui, |ui| {
                    ui.heading("Connection");
                    ui.add_space(10.);
                    output = render_stream_connection(stream, input_visibility, actions, ui);
                });

                get_frame(ui).show(ui, |ui| {
                    ui.heading("Recent");
                    ui.add_space(10.);

                    ScrollArea::vertical()
                        .id_salt(("stream_setup_recent", session_setup_id))
                        .show(ui, |ui| {
                            recent::render_matching_recent_sessions(
                                session_setup_id,
                                current_stream,
                                current_parser,
                                recent_sessions,
                                cmd_tx,
                                actions,
                                ui,
                            )
                        });
                });
            });

            output
        }
    }
}

/// Render main configuration for files sources.
fn render_files(
    _files: &[SourceFileInfo],
    parser: &mut ParserConfig,
    ui: &mut Ui,
) -> RenderOutcome {
    match parser {
        ParserConfig::Dlt(dlt) => dlt::render_statistics(dlt, ui),
        ParserConfig::SomeIP(..) | ParserConfig::Text | ParserConfig::Plugins => {
            RenderOutcome::None
        }
    }
}

fn render_stream_connection(
    stream: &mut StreamConfig,
    input_visibility: &mut VisibilityTracker,
    actions: &mut UiActions,
    ui: &mut Ui,
) -> RenderOutcome {
    match stream {
        StreamConfig::Process(config) => {
            process::render_connection(config, input_visibility, actions, ui)
        }
        StreamConfig::Tcp(config) => tcp::render_connection(config, input_visibility, ui),
        StreamConfig::Udp(config) => udp::render_connection(config, input_visibility, ui),
        StreamConfig::Serial(config) => serial::render_connection(config, input_visibility, ui),
    }
}

/// Specifies the needed functionality to be used with the function [`render_socket_address`].
pub trait ConfigBindAddress {
    fn bind_addr(&mut self) -> &mut String;
    fn validate(&mut self);
    fn is_valid(&self) -> bool;
    fn bind_err_msg(&self) -> Option<&str>;
}

/// Renders the primary socket-address input shared by TCP and UDP setup forms.
///
/// - `config` provides the editable address string plus validation hooks.
/// - `input_visibility` tracks when this form becomes visible so the address field can be focused.
/// - `ui` is the current egui scope used to render the controls.
pub fn render_socket_address<C: ConfigBindAddress>(
    config: &mut C,
    input_visibility: &mut VisibilityTracker,
    ui: &mut Ui,
) -> RenderOutcome {
    let mut outcome = RenderOutcome::None;

    ui.vertical(|ui| {
        ui.label("Socket Address:");

        let ip_txt_res = TextEdit::singleline(config.bind_addr())
            .vertical_align(Align::Center)
            .desired_width(200.)
            .hint_text("127.0.0.1:8080")
            .show(ui)
            .response;

        if input_visibility.is_newly_visible(ui) {
            ip_txt_res.request_focus();
        }

        if ip_txt_res.changed() {
            config.validate();
        }

        start_session_on_enter(&ip_txt_res, || config.is_valid(), &mut outcome);

        show_validation_message(ui, config.bind_err_msg());
    });

    outcome
}
