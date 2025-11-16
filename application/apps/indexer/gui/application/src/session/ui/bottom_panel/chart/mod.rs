use egui::{Color32, Direction, Label, Layout, Ui, Widget};
use egui_plot::{Bar, BarChart, Legend, Plot};

use crate::{
    host::ui::UiActions,
    session::{command::SessionCommand, communication::UiSenders, data::SessionDataState},
};

#[derive(Debug, Default)]
pub struct ChartUI {
    requested_data: bool,
}

impl ChartUI {
    pub fn render_content(
        &mut self,
        data: &SessionDataState,
        senders: &UiSenders,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        if data.search.is_search_active() {
            self.chart(data, senders, actions, ui);
        } else {
            self.clear();
            Self::place_holder(ui);
        }
    }

    fn chart(
        &mut self,
        data: &SessionDataState,
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
                    .width(ratio)
                })
                .collect(),
        )
        .color(Color32::LIGHT_BLUE);

        Plot::new(data.session_id)
            .legend(Legend::default())
            .clamp_grid(false)
            .show(ui, |plot_ui| plot_ui.bar_chart(chart));
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
