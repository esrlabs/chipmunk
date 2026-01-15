use egui::{
    Align, Button, Color32, Frame, Id, Label, Layout, Margin, Popup, RichText, Sense, Ui, Vec2,
    Widget as _,
};
use stypes::{ObserveOrigin, Transport};

use crate::{common::phosphor::icons, session::ui::shared::SessionShared};

pub fn render_content(shared: &SessionShared, ui: &mut Ui) {
    ui.horizontal_centered(|ui| {
        ui.label(format!(
            "{} / {}",
            shared.search.total_count, shared.logs.logs_count
        ));

        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
            observe_states(shared, ui);
        });
    });
}

fn observe_states(shared: &SessionShared, ui: &mut Ui) {
    let observe = &shared.observe;
    let mut finished = observe
        .operations()
        .iter()
        .filter(|op| op.done())
        .peekable();

    if finished.peek().is_some() {
        let finished_txt = RichText::new(icons::regular::LIST).size(15.);
        let finished_res = Button::new(finished_txt)
            .frame(true)
            .frame_when_inactive(false)
            .ui(ui)
            .on_hover_text("Finished Jobs");

        Popup::menu(&finished_res)
            .frame(Frame::menu(ui.style()).inner_margin(Margin::same(8)))
            .id(Id::new("finished menu"))
            .show(|ui| {
                ui.set_min_width(100.);
                for (idx, operation) in finished.enumerate() {
                    if idx != 0 {
                        ui.separator();
                    }

                    let (title, desc) = match &operation.origin {
                        ObserveOrigin::File(name, _, _) => (String::from("tail"), name.to_owned()),
                        ObserveOrigin::Concat(files) => (
                            String::from("concatenating"),
                            format!("{} files", files.len()),
                        ),
                        ObserveOrigin::Stream(_, transport) => match transport {
                            Transport::Process(config) => {
                                (String::from("Command"), config.command.to_owned())
                            }
                            Transport::TCP(config) => (
                                format!("TCP: {}", config.bind_addr),
                                format!("Connected to {} via TCP", config.bind_addr),
                            ),
                            Transport::UDP(config) => (
                                format!("UDP: {}", config.bind_addr),
                                format!("Connected to {} via UDP", config.bind_addr),
                            ),
                            Transport::Serial(config) => (
                                String::from("Serial Port"),
                                format!("Connected to {}", config.path),
                            ),
                        },
                    };

                    let title = RichText::new(title).heading().size(15.0);
                    Label::new(title).selectable(false).ui(ui);

                    ui.horizontal_centered(|ui| {
                        if let Some(duratio) = operation.total_run_duration() {
                            let duration_txt = format!("[{:.2}s]", duratio.as_secs_f32());
                            Label::new(duration_txt).selectable(false).ui(ui);
                        }
                        Label::new(desc).selectable(false).ui(ui);
                    });
                }
            });
    }

    let running = observe
        .operations()
        .iter()
        .rev()
        .filter(|op| op.processing());

    for operation in running {
        ui.add_space(5.0);

        let name = match &operation.origin {
            ObserveOrigin::File(..) => "tail",
            ObserveOrigin::Concat(..) => "concat",
            ObserveOrigin::Stream(_, transport) => match transport {
                Transport::Process(config) => config.command.as_str(),
                Transport::TCP(config) => config.bind_addr.as_str(),
                Transport::UDP(config) => config.bind_addr.as_str(),
                Transport::Serial(config) => config.path.as_str(),
            },
        };

        Label::new(name).selectable(false).truncate().ui(ui);

        let (res, painter) = ui.allocate_painter(Vec2::splat(9.0), Sense::empty());

        let center = res.rect.center();
        let radius = res.rect.width() / 2.0;
        painter.circle_filled(center, radius, Color32::LIGHT_BLUE);
    }

    ui.separator();
}
