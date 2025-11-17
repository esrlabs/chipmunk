use egui::{Color32, Direction, Label, Layout, Ui, Vec2, Widget};
use egui_plot::{Bar, BarChart, Legend, Plot};

use crate::{
    host::ui::UiActions,
    session::{
        command::SessionCommand, communication::UiSenders, data::SessionDataState,
        ui::state::SessionUiState,
    },
};

#[derive(Debug, Default)]
pub struct ChartUI {
    requested_data: bool,
}

impl ChartUI {
    pub fn render_content(
        &mut self,
        data: &SessionDataState,
        ui_state: &mut SessionUiState,
        senders: &UiSenders,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        if data.search.is_search_active() {
            self.chart(data, ui_state, senders, actions, ui);
        } else {
            self.clear();
            Self::place_holder(ui);
        }
    }

    fn chart(
        &mut self,
        data: &SessionDataState,
        ui_state: &mut SessionUiState,
        senders: &UiSenders,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        if !self.requested_data {
            // Taken from current Chipmunk: Matches are divided by 2
            let dataset_len = (ui.available_width() / 2.0) as u16;
            //TODO AAZ: Check if range is needed.
            // let rng = Some(0..=data.logs_count);
            let rng = None;
            let chart_cmd = SessionCommand::GetChartMap {
                dataset_len,
                range: rng.clone(),
            };

            let chart_sent = actions.try_send_command(&senders.cmd_tx, chart_cmd);

            let values_cmd = SessionCommand::GetChartValues {
                dataset_len,
                range: rng,
            };
            let values_sent = actions.try_send_command(&senders.cmd_tx, values_cmd);

            self.requested_data = chart_sent && values_sent;
        }

        // Ratio describes how many logs will be represented in one unit of
        // axe x on charts.
        let ratio = data.logs_count as f64 / data.charts.bars.len() as f64;

        let chart = BarChart::new(
            "TODO: Search Name",
            data.charts
                .bars
                .iter()
                .enumerate()
                .map(|(idx, bar)| {
                    Bar::new(
                        idx as f64 * ratio,
                        bar.first().map(|a| a.matches_count).unwrap_or_default() as f64,
                    )
                })
                .collect(),
        )
        .highlight(true)
        .allow_hover(false)
        .width(ratio)
        .color(Color32::LIGHT_BLUE);

        let safe_x = |x: f64| (x as u64).min(data.logs_count.saturating_sub(1));

        let plot_res = Plot::new(data.session_id)
            .legend(Legend::default())
            .clamp_grid(false)
            .show_y(false)
            .set_margin_fraction(Vec2::ZERO)
            .label_formatter(|_name, point| {
                // Show log number on hover only.
                safe_x(point.x).to_string()
            })
            .y_axis_formatter(|mark, _rng| {
                // Show positive numbers only and don't break alignment when when
                // scrolling from 99 to 100
                if mark.value.is_sign_positive() {
                    format!("{:03}", mark.value as u64)
                } else {
                    String::new()
                }
            })
            .x_axis_formatter(|mark, _rng| {
                // Show positive log numbers only.
                if mark.value.is_sign_positive() {
                    format!("{}", mark.value as u64)
                } else {
                    String::new()
                }
            })
            .show(ui, |plot_ui| {
                plot_ui.bar_chart(chart);

                plot_ui
                    .response()
                    .clicked()
                    .then(|| plot_ui.pointer_coordinate())
                    .flatten()
            });

        if let Some(pos) = plot_res.inner {
            let log_pos = safe_x(pos.x);

            ui_state.scroll_main_row = Some(log_pos);
            actions.try_send_command(
                &senders.cmd_tx,
                SessionCommand::SetSelectedLog(Some(log_pos)),
            );
        }
    }

    fn place_holder(ui: &mut Ui) {
        ui.with_layout(
            Layout::centered_and_justified(Direction::TopDown).with_cross_justify(false),
            |ui| {
                ui.set_max_width(290.);

                Label::new(
                    "As soon as some filter will be created, \
                the frequency of matching will be shown. \
                Also as soon as some chart term will be created, \
                the chart will be rendered.",
                )
                .halign(egui::Align::Min)
                .selectable(false)
                .ui(ui);
            },
        );
    }

    fn clear(&mut self) {
        self.requested_data = false;
    }
}
