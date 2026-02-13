use egui::{
    Button, Frame, Id, Margin, RichText, Sense, Sides, Ui, Widget,
    collapsing_header::CollapsingState, vec2,
};
use stypes::{ObserveOrigin, Transport};
use tokio::sync::mpsc;

use crate::{
    common::phosphor::icons,
    host::{command::HostCommand, ui::UiActions},
    session::{
        command::SessionCommand,
        types::ObserveOperation,
        ui::shared::{ObserveState, SessionShared},
    },
};

use file::FilesObserveUi;
use process::ProcessObserveUi;
use serial::SerialObserveUi;
use tcp::TcpObserveUi;
use udp::UdpObserveUi;

mod file;
mod process;
mod serial;
mod tcp;
mod udp;

const TITLE_SIZE: f32 = 16.0;
const SPACE_BETWEEN_GROUPS: f32 = 5.0;

#[derive(Debug)]
enum ObserveSidePanel {
    Files(FilesObserveUi),
    Process(ProcessObserveUi),
    Tcp(TcpObserveUi),
    Udp(UdpObserveUi),
    Serial(SerialObserveUi),
}

#[allow(unused)]
#[derive(Debug)]
pub struct ObservingUi {
    observe_ui: ObserveSidePanel,
}

impl ObservingUi {
    pub fn new(
        observe_op: &ObserveOperation,
        cmd_tx: mpsc::Sender<SessionCommand>,
        host_cmd_tx: mpsc::Sender<HostCommand>,
    ) -> Self {
        let id_salt = observe_op.id;
        use ObserveSidePanel as OSP;
        let observe_ui = match &observe_op.origin {
            ObserveOrigin::File(..) | ObserveOrigin::Concat(..) => {
                OSP::Files(FilesObserveUi::new(id_salt, cmd_tx, host_cmd_tx))
            }
            ObserveOrigin::Stream(_, transport) => match transport {
                Transport::Process(..) => OSP::Process(ProcessObserveUi::new(id_salt, cmd_tx)),
                Transport::TCP(..) => OSP::Tcp(TcpObserveUi::new(id_salt, cmd_tx)),
                Transport::UDP(..) => OSP::Udp(UdpObserveUi::new(id_salt, cmd_tx)),
                Transport::Serial(..) => OSP::Serial(SerialObserveUi::new(id_salt, cmd_tx)),
            },
        };

        Self { observe_ui }
    }

    pub fn render_content(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        Self::top_title(ui, shared);

        Frame::group(ui.style())
            .fill(ui.style().visuals.faint_bg_color)
            .inner_margin(Margin::symmetric(10, 4))
            .show(ui, |ui| {
                ui.take_available_width();

                match &mut self.observe_ui {
                    ObserveSidePanel::Files(files) => files.render_content(ui, shared, actions),
                    ObserveSidePanel::Process(process) => {
                        process.render_content(ui, shared, actions)
                    }
                    ObserveSidePanel::Tcp(tcp) => tcp.render_content(ui, shared, actions),
                    ObserveSidePanel::Udp(udp) => udp.render_content(ui, shared, actions),
                    ObserveSidePanel::Serial(serial) => serial.render_content(ui, shared, actions),
                }
            });
    }

    pub fn top_title(ui: &mut Ui, shared: &SessionShared) {
        ui.horizontal_wrapped(|ui| {
            ui.label(
                RichText::new("Observing Sources")
                    .heading()
                    .size(TITLE_SIZE),
            );

            let sources_count = shared.observe.sources_count();
            ui.label(
                RichText::new(format!("({sources_count})"))
                    .weak()
                    .size(TITLE_SIZE),
            );
        });
        ui.add_space(5.0);
    }
}

fn render_group_title(ui: &mut Ui, title: &str) {
    ui.label(RichText::new(title).heading().size(TITLE_SIZE));
}

fn render_observe_item(
    ui: &mut Ui,
    color_idx: usize,
    title: &str,
    name_content: impl FnOnce(&mut Ui),
    button_content: impl FnOnce(&mut Ui),
) {
    Sides::new().shrink_left().truncate().height(35.0).show(
        ui,
        |ui| {
            let color = ObserveState::source_color(color_idx);
            let (res, painter) =
                ui.allocate_painter(vec2(10.0, ui.available_height()), Sense::hover());
            painter.rect_filled(res.rect, 0, color);

            ui.label(RichText::new(title).strong());

            name_content(ui);
        },
        |ui| ui.horizontal_centered(|ui| button_content(ui)),
    );
}

fn get_item_button(content: &str) -> Button<'_> {
    Button::new(RichText::new(content).size(18.0))
        .frame(false)
        .frame_when_inactive(false)
}

fn render_attach_source(ui: &mut Ui, id: Id, title: &str, collaps_content: impl FnOnce(&mut Ui)) {
    let mut state = CollapsingState::load_with_default_open(ui.ctx(), id, false);

    Sides::new().shrink_left().truncate().height(25.0).show(
        ui,
        |ui| {
            ui.label(title);
        },
        {
            |ui| {
                use icons::regular as ic;

                let icon = if state.is_open() {
                    ic::CARET_UP
                } else {
                    ic::CARET_DOWN
                };
                let btn_res = Button::new(RichText::new(icon).size(18.0))
                    .frame(false)
                    .frame_when_inactive(false)
                    .ui(ui);
                if btn_res.clicked() {
                    state.toggle(ui);
                }
            }
        },
    );

    state.show_body_unindented(ui, |ui| collaps_content(ui));
}
