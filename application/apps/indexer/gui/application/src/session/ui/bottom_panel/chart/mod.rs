use std::{ops::RangeInclusive, time::Duration};

use egui::{Color32, Direction, Label, Layout, Spinner, Ui, Vec2, Widget};
use egui_plot::{Bar, BarChart, Legend, Plot};
use tokio::sync::mpsc::Sender;

use crate::{
    common::action_throttle::ActionThrottle,
    host::ui::UiActions,
    session::{command::SessionCommand, types::OperationPhase, ui::shared::SessionShared},
};

pub use data::{ChartBar, ChartsData};

mod data;

const CHART_OFFSET: f64 = 0.05;

const SEND_INTERVAL: Duration = Duration::from_millis(5);
const SEND_RETRY_MAX_COUNT: u8 = 20;

#[derive(Debug)]
pub struct ChartUI {
    cmd_tx: Sender<SessionCommand>,
    data: ChartsData,
    /// Zoom factor (In X axis) from last frame.
    last_zoom_factor: Option<u64>,
    /// Last requested logs range.
    requested_logs_rng: Option<RangeInclusive<u64>>,
    /// Throttle chart data requests to avoid overwhelming the backend
    /// with too many request while zooming, scrolling or panning.
    throttle: ActionThrottle,
}

#[derive(Debug, Clone)]
enum PlotResponse {
    JumpToLog(u64),
    RequestForRange(RangeInclusive<u64>),
    None,
}

impl ChartUI {
    pub fn new(cmd_tx: Sender<SessionCommand>) -> Self {
        Self {
            cmd_tx,
            data: Default::default(),
            last_zoom_factor: None,
            requested_logs_rng: None,
            throttle: ActionThrottle::new(Duration::from_millis(100)),
        }
    }

    pub fn on_search_count_changes(&mut self, shared: &SessionShared) {
        // Requesting full logs ranges means that users haven't interacted with
        // the charts (No zoom)
        if self.is_requsting_full_range(shared) {
            self.last_zoom_factor = None;
            self.requested_logs_rng = None;
        }
    }

    fn is_requsting_full_range(&self, shared: &SessionShared) -> bool {
        self.requested_logs_rng
            .as_ref()
            .is_some_and(|rng| *rng == (0u64..=shared.logs.logs_count.saturating_sub(1)))
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
        match shared.search.search_operation_phase() {
            Some(OperationPhase::Initializing) => {
                ui.centered_and_justified(|ui| {
                    Spinner::new().size(20.0).ui(ui);
                });
            }
            Some(OperationPhase::Processing | OperationPhase::Done) => {
                self.chart(shared, actions, ui);
            }
            None => {
                Self::place_holder(ui);
            }
        }
    }

    fn chart(&mut self, shared: &mut SessionShared, actions: &mut UiActions, ui: &mut Ui) {
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
                        (idx + 1) as f64 * ratio + offset,
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

        let mut plot = Plot::new(shared.get_id())
            .legend(Legend::default())
            .clamp_grid(false)
            .allow_double_click_reset(false) // We are handling reset manually.
            .show_y(false)
            .set_margin_fraction(Vec2::splat(CHART_OFFSET as f32))
            .label_formatter(|name, point| {
                // Show log number on hover only unless user hovers over
                // a line chart then show the name of it too.
                let log_nr = convert_bounded(point.x.round());
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
                    format!("{:03}", mark.value.round() as u64)
                } else {
                    String::new()
                }
            })
            .x_axis_formatter(|mark, _rng| {
                // Show positive log numbers only.
                if mark.value.is_sign_positive() {
                    format!("{}", mark.value.round() as u64)
                } else {
                    String::new()
                }
            });

        if self.requested_logs_rng.is_none() {
            plot = plot.reset();
        }

        let plot_res = plot.show(ui, |plot_ui| {
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

            if shared.search.total_count() == 0 {
                return PlotResponse::None;
            }

            if plot_ui.response().clicked()
                && let Some(point) = plot_ui.pointer_coordinate()
            {
                let log = convert_bounded(point.x.round());
                return PlotResponse::JumpToLog(log);
            }

            let bounds = plot_ui.plot_bounds();

            let bounds_x = {
                let min_x = bounds.min()[0] as u64;
                let max_x = convert_bounded(bounds.max()[0]);
                min_x..=max_x
            };

            match &self.requested_logs_rng {
                Some(r) => {
                    // Check for scroll and drag changes.
                    if r.end() != bounds_x.end() && r.start() != bounds_x.start() {
                        return PlotResponse::RequestForRange(bounds_x);
                    }
                }
                None if shared.search.total_count() > 0 => {
                    // This is the first render frame after having search results.

                    //TODO AAZ: It would make sense to update this on logs_count changed.
                    self.update_throttle_config(shared.logs.logs_count);

                    // Request for all items.
                    let bounds_x = 0..=shared.logs.logs_count.saturating_sub(1);
                    return PlotResponse::RequestForRange(bounds_x);
                }
                None => {}
            };

            // We consider the diff on x axis as the zoom factor
            let zoom_factor = (bounds.max()[0] - bounds.min()[0]) as u64;

            match self.last_zoom_factor {
                Some(last_diff) => {
                    if last_diff != zoom_factor {
                        self.last_zoom_factor = Some(zoom_factor);
                        return PlotResponse::RequestForRange(bounds_x);
                    }
                }
                None => {
                    if !self.data.bars.is_empty() || !self.data.line_plots.is_empty() {
                        // This is the first frame after loading chart data => Assign only
                        self.last_zoom_factor = Some(zoom_factor);
                    }
                }
            };

            PlotResponse::None
        });

        match plot_res.inner {
            PlotResponse::JumpToLog(log_nr) => {
                shared.logs.scroll_main_row = Some(log_nr);
                actions.try_send_command(&self.cmd_tx, SessionCommand::GetSelectedLog(log_nr));
            }
            PlotResponse::RequestForRange(bound_x) => {
                if !self.throttle.ready(Some(ui.ctx())) {
                    return;
                }
                self.requested_logs_rng = Some(bound_x.clone());

                // Taken from current Chipmunk: Matches are divided by 2
                let dataset_len = (ui.available_width() / 2.0) as u16;
                let chart_cmd = SessionCommand::GetChartHistogram {
                    dataset_len,
                    range: Some(bound_x.clone()),
                };

                // In case the UI is sending too many requests (indicating a bug) then
                // we will block the UI up to until 100 milliseconds until the backend
                // is done processing previous requests.
                if !actions.send_command_with_retry(
                    &self.cmd_tx,
                    chart_cmd,
                    SEND_INTERVAL,
                    SEND_RETRY_MAX_COUNT,
                ) {
                    // Soft reset ensuring data will be requested the next frame.
                    self.requested_logs_rng = None;
                    return;
                }

                let dataset_len = ui.available_width() as u16;
                let values_cmd = SessionCommand::GetChartLinePlots {
                    dataset_len,
                    range: Some(bound_x),
                };

                // Same as chart cmd
                if !actions.send_command_with_retry(
                    &self.cmd_tx,
                    values_cmd,
                    SEND_INTERVAL,
                    SEND_RETRY_MAX_COUNT,
                ) {
                    // Soft reset ensuring data will be requested the next frame.

                    self.requested_logs_rng = None;
                }
            }
            PlotResponse::None => {}
        }
    }

    pub fn reset(&mut self) {
        let Self {
            cmd_tx: _,
            throttle,
            last_zoom_factor,
            requested_logs_rng,
            data,
        } = self;

        *last_zoom_factor = None;
        *requested_logs_rng = None;
        data.clear();
        throttle.reset();
    }

    /// Adjusts the throttle interval based on the current dataset size.
    pub fn update_throttle_config(&mut self, logs_count: u64) {
        let new_interval = match logs_count {
            0..=100_000 => Duration::from_millis(50),
            100_001..=500_000 => Duration::from_millis(100),
            500_001..=1_000_000 => Duration::from_millis(150),
            1_000_001..=2_000_000 => Duration::from_millis(175),
            _ => Duration::from_millis(225),
        };

        self.throttle = ActionThrottle::new(new_interval);
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
