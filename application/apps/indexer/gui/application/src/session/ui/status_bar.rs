use egui::{
    Align, Button, Color32, Frame, Id, Label, Layout, Margin, Popup, RichText, Sense, Ui, Vec2,
    Widget as _,
};
use stypes::{ObserveOrigin, Transport};

use crate::{common::phosphor::icons, session::ui::shared::SessionShared};

pub fn render_content(shared: &SessionShared, ui: &mut Ui) {
    let selected_count = shared.logs.selected_count();
    let single_selected_row = shared.logs.single_selected_row();
    let search_count = shared.search.search_result_count();
    let total_count = shared.logs.logs_count;

    ui.horizontal_centered(|ui| {
        Label::new(status_summary_text(
            single_selected_row,
            selected_count,
            search_count,
            total_count,
        ))
        .selectable(true)
        .ui(ui)
        .on_hover_ui(|ui| {
            ui.set_max_width(ui.spacing().tooltip_width);
            ui.label(format!(
                "Selected Row: {}",
                selected_row_tooltip_text(single_selected_row, selected_count)
            ));
            ui.label(format!("Selected Count: {selected_count}"));
            ui.label(format!("Search Count: {search_count}"));
            ui.label(format!("Total Count: {total_count}"));
        });

        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
            observe_states(shared, ui);
        });
    });
}

fn status_summary_text(
    single_selected_row: Option<u64>,
    selected_count: usize,
    search_count: u64,
    total_count: u64,
) -> String {
    let selected_row = single_selected_row
        .map(|row| row.to_string())
        .unwrap_or_else(|| String::from("-"));
    format!("{selected_row} [{selected_count}] {search_count}/{total_count}")
}

fn selected_row_tooltip_text(single_selected_row: Option<u64>, selected_count: usize) -> String {
    match (single_selected_row, selected_count) {
        (Some(row), 1) => row.to_string(),
        (_, 0) => String::from("None"),
        _ => String::from("Multiple"),
    }
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
                    ui.label(title);

                    ui.horizontal(|ui| {
                        if let Some(duratio) = operation.total_run_duration() {
                            let duration_txt = format!("[{:.2}s]", duratio.as_secs_f32());
                            ui.label(duration_txt);
                        }
                        ui.label(desc);
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

        Label::new(name).truncate().ui(ui);

        let (res, painter) = ui.allocate_painter(Vec2::splat(9.0), Sense::empty());

        let center = res.rect.center();
        let radius = res.rect.width() / 2.0;
        painter.circle_filled(center, radius, Color32::LIGHT_BLUE);
    }

    ui.separator();
}

#[cfg(test)]
mod tests {
    use super::{selected_row_tooltip_text, status_summary_text};

    #[test]
    fn status_summary_uses_dash_without_single_selection() {
        assert_eq!(status_summary_text(None, 3, 23, 343), "- [3] 23/343");
        assert_eq!(status_summary_text(None, 0, 23, 343), "- [0] 23/343");
    }

    #[test]
    fn status_summary_shows_selected_row_for_single_selection() {
        assert_eq!(status_summary_text(Some(3), 1, 23, 343), "3 [1] 23/343");
    }

    #[test]
    fn selected_row_tooltip_text_describes_selection_state() {
        assert_eq!(selected_row_tooltip_text(None, 0), "None");
        assert_eq!(selected_row_tooltip_text(Some(3), 1), "3");
        assert_eq!(selected_row_tooltip_text(None, 3), "Multiple");
    }
}
