use std::{ops::RangeInclusive, time::Duration};

use egui::{Direction, Label, Layout, Spinner, Ui, Vec2, Widget};
use egui_plot::{Bar, BarChart, Legend, Line, Plot};
use tokio::sync::mpsc::Sender;

use crate::{
    common::action_throttle::ActionThrottle,
    host::ui::{UiActions, registry::filters::FilterRegistry},
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
    /// Re-centers the chart on the full log range on the next frame.
    reset_full_range: bool,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ChartRenderState {
    Placeholder,
    Spinner,
    Chart,
}

impl ChartUI {
    pub fn new(cmd_tx: Sender<SessionCommand>) -> Self {
        Self {
            cmd_tx,
            data: Default::default(),
            last_zoom_factor: None,
            requested_logs_rng: None,
            reset_full_range: false,
            throttle: ActionThrottle::new(Duration::from_millis(100)),
        }
    }

    pub fn on_search_count_changes(&mut self, shared: &SessionShared) {
        // Requesting full logs ranges means that users haven't interacted with
        // the charts (No zoom)
        if self.is_requsting_full_range(shared) {
            self.last_zoom_factor = None;
            self.requested_logs_rng = None;
            self.reset_full_range = true;
        }
    }

    pub fn on_search_values_changes(&mut self, shared: &SessionShared) {
        if self.is_requsting_full_range(shared) {
            self.last_zoom_factor = None;
            self.requested_logs_rng = None;
            self.reset_full_range = true;
        }
    }

    fn is_requsting_full_range(&self, shared: &SessionShared) -> bool {
        self.requested_logs_rng
            .as_ref()
            .is_some_and(|rng| *rng == (0u64..=shared.logs.logs_count.saturating_sub(1)))
    }

    /// Selects chart rendering state based on running operations phases.
    fn render_state(shared: &SessionShared) -> ChartRenderState {
        let filter_phase = shared.search.search_operation_phase();
        let search_values_phase = shared.search_values.operation_phase();

        match (filter_phase, search_values_phase) {
            // Any have values
            (Some(OperationPhase::Processing | OperationPhase::Done), _)
            | (_, Some(OperationPhase::Processing | OperationPhase::Done)) => {
                ChartRenderState::Chart
            }
            // Else if any is still Initializing
            (Some(OperationPhase::Initializing), _) | (_, Some(OperationPhase::Initializing)) => {
                ChartRenderState::Spinner
            }
            (None, None) => ChartRenderState::Placeholder,
        }
    }

    /// Returns whether the chart has enough active search state to request data.
    fn has_chart_request_context(shared: &SessionShared) -> bool {
        shared.search.total_count() > 0
            || shared.search_values.current_values_map().is_some()
            || shared.search_values.operation_phase().is_some()
    }

    pub fn update_histogram(&mut self, map: Vec<Vec<ChartBar>>) {
        self.data.set_histogram(map);
    }

    pub fn update_line_plots(&mut self, values: Vec<(u8, Vec<stypes::Point>)>) {
        self.data.line_plots.clear();
        self.data.line_plots.extend(values);
    }

    pub fn render_content(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &FilterRegistry,
        ui: &mut Ui,
    ) {
        match Self::render_state(shared) {
            ChartRenderState::Spinner => {
                ui.centered_and_justified(|ui| {
                    Spinner::new().size(20.0).ui(ui);
                });
            }
            ChartRenderState::Chart => {
                self.chart(shared, actions, registry, ui);
            }
            ChartRenderState::Placeholder => {
                Self::place_holder(ui);
            }
        }
    }

    fn chart(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &FilterRegistry,
        ui: &mut Ui,
    ) {
        // Rebuild series metadata from current session state every frame.
        // Histogram buckets are cached separately and only updated on messages.
        self.data.resolve_histogram_series(shared, registry);
        self.data.resolve_search_value_series(shared, registry);

        let has_bars = !self.data.bars.is_empty();

        // Ratio describes how many logs will be represented in one unit of
        // axe x on charts.
        let (ratio, offset) = if !has_bars {
            (1.0, 0.0)
        } else if let Some(logs_rng) = &self.requested_logs_rng {
            let ratio = ((logs_rng.end() - logs_rng.start()) as f64) / self.data.bars.len() as f64;
            let offset = *logs_rng.start() as f64;
            (ratio, offset)
        } else {
            let ratio = shared.logs.logs_count as f64 / self.data.bars.len() as f64;
            (ratio, 0.)
        };

        // Function to convert value from x axis while ensuring it's in logs valid bound.
        let convert_bounded = |x: f64| (x as u64).min(shared.logs.logs_count.saturating_sub(1));

        let plot = Plot::new(shared.get_id())
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

        let plot_res = plot.show(ui, |plot_ui| {
            if self.reset_full_range {
                self.reset_full_range = false;

                // We need to reset X axis manually to show all logs span.
                // Y axis can be reset manually since we are not modifying it manually.

                let logs_count = shared.logs.logs_count as f64;
                let offset = logs_count * CHART_OFFSET;
                plot_ui.set_plot_bounds_x(-offset..=logs_count + offset);
                plot_ui.set_auto_bounds([false, true]);
            }

            if has_bars {
                // `PlotUi::bar_chart` consumes `BarChart` by value.
                // Keep only one pending chart so we can stack current chart on previous
                // while avoiding allocating a temporary `Vec<BarChart>`.
                let mut pending_chart: Option<BarChart> = None;

                for ser in self.data.series.drain(..) {
                    let bars = self
                        .data
                        .bars
                        .iter()
                        .enumerate()
                        .map(|(idx, bucket)| {
                            // Missing index means this filter has no matches in this bucket.
                            let count = bucket
                                .counts
                                .get(&ser.filter_idx)
                                .copied()
                                .unwrap_or_default();

                            Bar::new((idx + 1) as f64 * ratio + offset, count as f64)
                        })
                        .collect();

                    let mut current_chart = BarChart::new(ser.name, bars)
                        .allow_hover(false)
                        .width(ratio)
                        .color(ser.color);

                    // Stack using the previous series as base.
                    if let Some(prev_chart) = pending_chart.as_ref() {
                        current_chart = current_chart.stack_on(&[prev_chart]);
                    }

                    // Previous chart is fully configured now; submit it.
                    if let Some(chart_to_draw) = pending_chart.take() {
                        plot_ui.bar_chart(chart_to_draw);
                    }

                    pending_chart = Some(current_chart);
                }

                // Submit the last pending chart.
                if let Some(chart_to_draw) = pending_chart {
                    plot_ui.bar_chart(chart_to_draw);
                }
            }

            for ser in self.data.search_value_series.drain(..) {
                let Some(points) = self.data.line_plots.get(&ser.value_idx) else {
                    continue;
                };
                if points.is_empty() {
                    continue;
                }

                let plot_points: Vec<[f64; 2]> = points
                    .iter()
                    .map(|point| [point.row as f64, point.y_value])
                    .collect();

                plot_ui.line(Line::new(ser.name, plot_points).color(ser.color));
            }

            // Reset chart on secondary double click.
            if plot_ui
                .response()
                .double_clicked_by(egui::PointerButton::Secondary)
            {
                self.reset_full_range = true;
            }

            if !Self::has_chart_request_context(shared) {
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
                None if Self::has_chart_request_context(shared) => {
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
                    self.reset_full_range = true;
                    return;
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
            reset_full_range: reset_viewport_to_full_range,
            data,
        } = self;

        *last_zoom_factor = None;
        *requested_logs_rng = None;
        *reset_viewport_to_full_range = false;
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
                .ui(ui);
            },
        );
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use tokio::sync::mpsc;
    use uuid::Uuid;

    use crate::{
        host::common::parsers::ParserNames,
        session::{
            types::{ObserveOperation, OperationPhase},
            ui::shared::{SessionInfo, SessionShared},
        },
    };

    use super::{ChartBar, ChartUI};

    fn new_shared(logs_count: u64) -> SessionShared {
        let session_id = Uuid::new_v4();
        let observe_op = ObserveOperation::new(
            Uuid::new_v4(),
            stypes::ObserveOrigin::File(
                "source".to_owned(),
                stypes::FileFormat::Text,
                PathBuf::from("source.log"),
            ),
        );

        let session_info = SessionInfo {
            id: session_id,
            title: "test".to_owned(),
            parser: ParserNames::Text,
        };

        let mut shared = SessionShared::new(session_info, observe_op);
        shared.logs.logs_count = logs_count;
        shared
    }

    fn new_chart() -> ChartUI {
        let (tx, _rx) = mpsc::channel(4);
        ChartUI::new(tx)
    }

    fn point(row: u64, y_value: f64) -> stypes::Point {
        stypes::Point {
            row,
            min: y_value - 1.0,
            max: y_value + 1.0,
            y_value,
        }
    }

    #[test]
    fn render_state_with_values() {
        let mut shared = new_shared(10);
        let operation_id = Uuid::new_v4();
        shared.search_values.set_operation(operation_id);

        assert_eq!(
            ChartUI::render_state(&shared),
            super::ChartRenderState::Spinner
        );

        shared
            .search_values
            .update_operation(operation_id, OperationPhase::Processing);

        assert_eq!(
            ChartUI::render_state(&shared),
            super::ChartRenderState::Chart
        );
    }

    #[test]
    fn search_count_resets() {
        let shared = new_shared(10);
        let mut chart = new_chart();
        chart.last_zoom_factor = Some(42);
        chart.requested_logs_rng = Some(0..=9);

        chart.on_search_count_changes(&shared);

        assert!(chart.last_zoom_factor.is_none());
        assert!(chart.requested_logs_rng.is_none());
        assert!(chart.reset_full_range);
    }

    #[test]
    fn search_count_keeps_range() {
        let shared = new_shared(10);
        let mut chart = new_chart();
        chart.last_zoom_factor = Some(42);
        chart.requested_logs_rng = Some(2..=7);

        chart.on_search_count_changes(&shared);

        assert_eq!(chart.last_zoom_factor, Some(42));
        assert_eq!(chart.requested_logs_rng, Some(2..=7));
    }

    #[test]
    fn line_plots_replace() {
        let mut chart = new_chart();
        chart
            .data
            .line_plots
            .insert(0, vec![point(1, 10.0), point(2, 12.0)]);
        chart.data.line_plots.insert(1, vec![point(3, 14.0)]);

        chart.update_line_plots(vec![(2, vec![point(4, 20.0)])]);

        assert_eq!(chart.data.line_plots.len(), 1);
        assert!(!chart.data.line_plots.contains_key(&0));
        assert!(!chart.data.line_plots.contains_key(&1));
        assert_eq!(chart.data.line_plots.get(&2).map(Vec::len), Some(1));
    }

    #[test]
    fn reset_clears_state() {
        let mut chart = new_chart();
        chart.last_zoom_factor = Some(7);
        chart.requested_logs_rng = Some(1..=4);
        chart.reset_full_range = true;
        chart.data.set_histogram(vec![vec![ChartBar::new(0, 3)]]);
        chart.data.line_plots.insert(0, vec![point(1, 5.0)]);

        assert!(chart.throttle.ready(None));
        assert!(!chart.throttle.ready(None));

        chart.reset();

        assert!(chart.last_zoom_factor.is_none());
        assert!(chart.requested_logs_rng.is_none());
        assert!(!chart.reset_full_range);
        assert!(chart.data.bars.is_empty());
        assert!(chart.data.line_plots.is_empty());
        assert!(chart.throttle.ready(None));
    }

    #[test]
    fn search_values_reset_range() {
        let mut shared = new_shared(10);
        shared
            .search_values
            .set_values_map(Some(std::collections::HashMap::from([(0, (1.0, 2.0))])));

        let mut chart = new_chart();
        chart.last_zoom_factor = Some(42);
        chart.requested_logs_rng = Some(0..=9);

        chart.on_search_values_changes(&shared);

        assert!(chart.last_zoom_factor.is_none());
        assert!(chart.requested_logs_rng.is_none());
        assert!(chart.reset_full_range);
    }

    #[test]
    fn search_count_keeps_flag() {
        let shared = new_shared(10);
        let mut chart = new_chart();
        chart.last_zoom_factor = Some(42);
        chart.requested_logs_rng = Some(2..=7);

        chart.on_search_count_changes(&shared);

        assert!(!chart.reset_full_range);
    }
}
