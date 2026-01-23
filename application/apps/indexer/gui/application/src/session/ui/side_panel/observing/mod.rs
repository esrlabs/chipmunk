use egui::{Color32, Frame, Margin, RichText, Sense, Sides, Ui, vec2};
use stypes::{ObserveOrigin, Transport};
use tokio::sync::mpsc;

use crate::{
    host::{command::HostCommand, ui::UiActions},
    session::{command::SessionCommand, ui::shared::SessionShared},
};

mod file;
mod process;
mod serial;
mod tcp;
mod udp;

const TITLE_SIZE: f32 = 16.0;

#[allow(unused)]
#[derive(Debug)]
pub struct ObservingUi {
    cmd_tx: mpsc::Sender<SessionCommand>,
    host_cmd_tx: mpsc::Sender<HostCommand>,
}

impl ObservingUi {
    pub fn new(
        cmd_tx: mpsc::Sender<SessionCommand>,

        host_cmd_tx: mpsc::Sender<HostCommand>,
    ) -> Self {
        Self {
            cmd_tx,
            host_cmd_tx,
        }
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
                // We don't mix different types for sources in the same session.
                let Some(first_operation) = shared.observe.operations().first() else {
                    return;
                };

                match &first_operation.origin {
                    ObserveOrigin::File(..) | ObserveOrigin::Concat(..) => file::render_content(
                        ui,
                        first_operation,
                        actions,
                        &self.cmd_tx,
                        &self.host_cmd_tx,
                    ),
                    ObserveOrigin::Stream(_, transport) => match transport {
                        Transport::Process(..) => process::render_content(shared, ui),
                        Transport::TCP(..) => tcp::render_content(shared, ui),
                        Transport::UDP(..) => udp::render_content(shared, ui),
                        Transport::Serial(..) => serial::render_content(shared, ui),
                    },
                };
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
    color: Color32,
    title: &str,
    name_content: impl FnOnce(&mut Ui),
    button_content: impl FnOnce(&mut Ui),
) {
    Sides::new().shrink_left().truncate().height(35.0).show(
        ui,
        |ui| {
            let (res, painter) =
                ui.allocate_painter(vec2(10.0, ui.available_height()), Sense::hover());
            painter.rect_filled(res.rect, 0, color);

            ui.label(RichText::new(title).strong());

            name_content(ui);
        },
        |ui| {
            button_content(ui);
        },
    );
}
