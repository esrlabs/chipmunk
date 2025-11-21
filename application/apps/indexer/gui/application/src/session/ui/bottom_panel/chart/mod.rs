use std::ops::RangeInclusive;

use egui::{Color32, Direction, Label, Layout, Ui, Vec2, Widget};
use egui_plot::{Bar, BarChart, Legend, Plot};
use tokio::sync::mpsc::Sender;

use crate::{
    host::ui::UiActions,
    session::{command::SessionCommand, ui::shared::SessionShared},
};

pub use data::{ChartBar, ChartsData};

mod data;

const CHART_OFFSET: f64 = 0.05;

#[derive(Debug)]
pub struct ChartUI {
    cmd_tx: Sender<SessionCommand>,
    data: ChartsData,
    /// Zoom factor (In X axis) from last frame.
    last_zoom_factor: Option<u64>,
    /// Last requested logs range.
    requested_logs_rng: Option<RangeInclusive<u64>>,
}

#[derive(Debug)]
struct InnerResponse {
    jump_log: Option<u64>,
    bound_x: Option<RangeInclusive<u64>>,
}

impl ChartUI {
    pub fn new(cmd_tx: Sender<SessionCommand>) -> Self {
        Self {
            cmd_tx,
            data: Default::default(),
            last_zoom_factor: None,
            requested_logs_rng: None,
        }
    }

    pub fn update_histogram(&mut self, map: Vec<Vec<ChartBar>>) {
        //NOTE: Current implementation for temporal filter case.
        self.data.bars.clear();
        self.data.bars.extend(map);
    }

    pub fn update_line_plots(&mut self, values: Vec<(u8, Vec<stypes::Point>)>) {
        self.data.line_plots.clear();
        self.data.line_plots.extend(values);
    }

    pub fn render_content(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        if shared.search.is_search_active() {
            self.chart(shared, actions, ui);
        } else {
            Self::place_holder(ui);
        }
    }

    fn chart(&mut self, shared: &mut SessionShared, actions: &mut UiActions, ui: &mut Ui) {
        //TODO AAZ: This should be handled in better way. Charts infos should be triggered
        //directly after finishing the search.
        if self.last_zoom_factor.is_none() {
            // Taken from current Chipmunk: Matches are divided by 2
            let dataset_len = (ui.available_width() / 2.0) as u16;
            let rng = None;
            let chart_cmd = SessionCommand::GetChartHistogram {
                dataset_len,
                range: rng.clone(),
            };

            actions.try_send_command(&self.cmd_tx, chart_cmd);

            let values_cmd = SessionCommand::GetChartLinePlots {
                dataset_len,
                range: rng,
            };
            actions.try_send_command(&self.cmd_tx, values_cmd);
        }

        // Ratio describes how many logs will be represented in one unit of
        // axe x on charts.
        let (ratio, offset) = if let Some(logs_rng) = &self.requested_logs_rng {
            let ratio = ((logs_rng.end() - logs_rng.start()) as f64) / self.data.bars.len() as f64;
            let offset = *logs_rng.start() as f64;
            (ratio, offset)
        } else {
            let ratio = shared.logs.logs_count as f64 / self.data.bars.len() as f64;
            (ratio, 0.)
        };

        let chart = BarChart::new(
            "TODO: Search Name",
            self.data
                .bars
                .iter()
                .enumerate()
                .map(|(idx, bar)| {
                    Bar::new(
                        idx as f64 * ratio + offset,
                        bar.first().map(|a| a.matches_count).unwrap_or_default() as f64,
                    )
                })
                .collect(),
        )
        .allow_hover(false)
        .width(ratio)
        .color(Color32::LIGHT_BLUE);

        // Function to convert value from x axis while ensuring it's in logs valid bound.
        let convert_bounded = |x: f64| (x as u64).min(shared.logs.logs_count.saturating_sub(1));

        let plot_res = Plot::new(shared.get_id())
            .legend(Legend::default())
            .clamp_grid(false)
            .allow_double_click_reset(false) // We are handling reset manually.
            .show_y(false)
            .set_margin_fraction(Vec2::splat(CHART_OFFSET as f32))
            .label_formatter(|name, point| {
                // Show log number on hover only unless user hovers over
                // a line chart then show the name of it too.
                let log_nr = convert_bounded(point.x);
                if name.is_empty() {
                    log_nr.to_string()
                } else {
                    format!("{name}\n{log_nr}")
                }
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

                // Reset chart on secondary double click.
                if plot_ui
                    .response()
                    .double_clicked_by(egui::PointerButton::Secondary)
                {
                    // We need to reset X axis manually to show all logs span.
                    // Y axis can be reset manually since we are not modifying it manually.
                    let logs_count = shared.logs.logs_count as f64;
                    let offset = logs_count * CHART_OFFSET;
                    plot_ui.set_plot_bounds_x(-offset..=logs_count + offset);

                    plot_ui.set_auto_bounds([false, true]);
                }

                let jump_log = plot_ui
                    .response()
                    .clicked()
                    .then(|| plot_ui.pointer_coordinate())
                    .flatten()
                    .map(|point| convert_bounded(point.x));

                let bounds = plot_ui.plot_bounds();
                // We consider the diff on x axis as the zoom factor
                let zoom_factor = (bounds.max()[0] - bounds.min()[0]) as u64;

                let bound_x = match self.last_zoom_factor {
                    Some(last_diff) => {
                        // Don't change logs for zoom change which is less than 2000 logs.
                        // TODO AAZ: Test this with multiple file sizes, and different machines.
                        if last_diff.abs_diff(zoom_factor) > 2000 {
                            self.last_zoom_factor = Some(zoom_factor);
                            let min_x = bounds.min()[0] as u64;
                            let max_x = convert_bounded(bounds.max()[0]);
                            Some(min_x..=max_x)
                        } else {
                            None
                        }
                    }
                    None => {
                        // We are calling for load when we don't have last diff at the beginning
                        // of the method. We need here to just assign it to the latest diff.
                        // TODO AAZ: Change this to handle loading in place. Also keep in mind
                        // filling out chart bars once a search is done automatically.
                        if !self.data.bars.is_empty() {
                            self.last_zoom_factor = Some(zoom_factor);
                        }
                        None
                    }
                };

                InnerResponse { jump_log, bound_x }
            });

        if let Some(log_nr) = plot_res.inner.jump_log {
            shared.logs.scroll_main_row = Some(log_nr);
            actions.try_send_command(&self.cmd_tx, SessionCommand::GetSelectedLog(log_nr));
        }

        if let Some(bound_x) = plot_res.inner.bound_x
            && self
                .requested_logs_rng
                .as_ref()
                .is_none_or(|b| &bound_x != b)
        {
            self.requested_logs_rng = Some(bound_x.clone());

            // Taken from current Chipmunk: Matches are divided by 2
            let dataset_len = (ui.available_width() / 2.0) as u16;
            let chart_cmd = SessionCommand::GetChartHistogram {
                dataset_len,
                range: Some(bound_x.clone()),
            };

            actions.try_send_command(&self.cmd_tx, chart_cmd);

            let values_cmd = SessionCommand::GetChartLinePlots {
                dataset_len,
                range: Some(bound_x),
            };

            actions.try_send_command(&self.cmd_tx, values_cmd);
        }
    }

    pub fn clear(&mut self) {
        let Self {
            cmd_tx: _,
            last_zoom_factor,
            requested_logs_rng,
            data,
        } = self;

        *last_zoom_factor = None;
        *requested_logs_rng = None;
        data.clear();
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
}
