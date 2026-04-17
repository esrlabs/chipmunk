use std::{ops::RangeInclusive, time::Duration};

use egui::{Direction, Frame, Label, Layout, Margin, Spinner, Ui, Vec2, Widget};
use egui_plot::{Bar, BarChart, Legend, Line, Plot, PlotBounds};
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
    /// Current backend request range used as the chart's active viewport baseline.
    current_request_range: Option<RangeInclusive<u64>>,
    /// Next chart range to request from backend.
    pending_request_range: Option<RangeInclusive<u64>>,
    /// Current viewport behavior mode.
    viewport_mode: ChartViewportMode,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
/// Describes whether the chart follows the live full range or a user-defined viewport.
enum ChartViewportMode {
    FollowFullRange,
    Custom,
}

impl ChartUI {
    pub fn new(cmd_tx: Sender<SessionCommand>) -> Self {
        Self {
            cmd_tx,
            data: Default::default(),
            current_request_range: None,
            pending_request_range: None,
            viewport_mode: ChartViewportMode::FollowFullRange,
            reset_full_range: false,
            throttle: ActionThrottle::new(Duration::from_millis(100)),
        }
    }

    /// Re-queues chart work after search data or search-value metadata changes.
    ///
    /// Follow-full-range mode must stay attached to the live session span as logs grow, while a
    /// custom viewport must keep requesting the user's current range instead of snapping back.
    pub fn on_chart_data_changes(&mut self, shared: &SessionShared) {
        if !Self::has_chart_request_context(shared) {
            return;
        }

        match self.viewport_mode {
            ChartViewportMode::FollowFullRange => self.set_full_range(shared),
            ChartViewportMode::Custom => {
                if let Some(range) = self
                    .pending_request_range
                    .to_owned()
                    .or_else(|| self.current_request_range.to_owned())
                {
                    self.pending_request_range = Some(range);
                    self.reset_full_range = false;
                }
            }
        }
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
        Frame::NONE
            .inner_margin(Margin::symmetric(4, 2))
            .show(ui, |ui| match Self::render_state(shared) {
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
            });
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
        shared.search.search_result_count() > 0
            || shared.search_values.current_values_map().is_some()
            || shared.search_values.operation_phase().is_some()
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
        } else if let Some(logs_rng) = &self.current_request_range {
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
                self.set_full_range(shared);
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

            if let Some(range) = self.pending_request_range.take() {
                return PlotResponse::RequestForRange(range);
            }

            let plot_bounds = plot_ui.plot_bounds();

            let Some(current_request_range) = self.current_request_range.clone() else {
                self.set_full_range(shared);
                return PlotResponse::RequestForRange(Self::get_full_range(shared));
            };

            let request_range = Self::bounds_request_range(&plot_bounds, shared);

            // Derive mode from both the normalized request span and the raw visible bounds.
            // A zoomed-out custom viewport can clamp back to the full request range, so the
            // request span alone is not enough to decide whether we are still following live
            // full-range updates or preserving a user-defined view.
            self.update_viewport_mode(&plot_bounds, &request_range, shared);

            let bounds_changed = current_request_range != request_range;

            if bounds_changed {
                PlotResponse::RequestForRange(request_range)
            } else {
                PlotResponse::None
            }
        });

        match plot_res.inner {
            PlotResponse::JumpToLog(log_nr) => {
                shared.logs.scroll_main_row = Some(log_nr);
                shared.logs.replace_selection_with(log_nr);
                actions.try_send_command(&self.cmd_tx, SessionCommand::GetSelectedLog(log_nr));
            }
            PlotResponse::RequestForRange(bound_x) => {
                self.update_throttle_config(shared.logs.logs_count);
                self.pending_request_range = None;
                let retry_range = bound_x.clone();

                if !self.throttle.ready(Some(ui.ctx())) {
                    self.pending_request_range = Some(bound_x);
                    return;
                }
                self.current_request_range = Some(bound_x.clone());

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
                    self.current_request_range = None;
                    self.pending_request_range = Some(bound_x);
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
                    self.current_request_range = None;
                    self.pending_request_range = Some(retry_range);
                }
            }
            PlotResponse::None => {}
        }
    }

    /// Sets the chart to live full-range mode and queues that range.
    fn set_full_range(&mut self, shared: &SessionShared) {
        self.viewport_mode = ChartViewportMode::FollowFullRange;
        self.pending_request_range = Some(Self::get_full_range(shared));
        self.reset_full_range = true;
    }

    /// Returns the full chartable log span for the current session.
    fn get_full_range(shared: &SessionShared) -> RangeInclusive<u64> {
        0..=shared.logs.logs_count.saturating_sub(1)
    }

    /// Returns the default full-range X bounds applied when the chart follows the live span.
    fn default_bounds(shared: &SessionShared) -> PlotBounds {
        let logs_count = shared.logs.logs_count as f64;
        let offset = logs_count * CHART_OFFSET;
        PlotBounds::from_min_max([-offset, 0.0], [logs_count + offset, 1.0])
    }

    /// Returns whether the visible bounds extend beyond the default full-range viewport.
    ///
    /// This keeps zoomed-out views in `Custom` mode even when the backend request range clamps
    /// back to the full log span.
    fn extends_past_full_bounds(bounds: &PlotBounds, shared: &SessionShared) -> bool {
        let default_bounds = Self::default_bounds(shared);
        let epsilon = 0.01;

        bounds.min()[0] < default_bounds.min()[0] - epsilon
            || bounds.max()[0] > default_bounds.max()[0] + epsilon
    }

    /// Updates viewport mode from the effective backend request span plus the visible plot bounds.
    ///
    /// The request range is the stable source of truth for ordinary in-bounds interaction, but a
    /// zoomed-out viewport can clamp back to the full log span. In that case the raw bounds keep
    /// the chart in `Custom` mode so future data updates do not snap the viewport back.
    fn update_viewport_mode(
        &mut self,
        visible_bounds: &PlotBounds,
        request_range: &RangeInclusive<u64>,
        shared: &SessionShared,
    ) {
        self.viewport_mode = if request_range == &Self::get_full_range(shared)
            && !Self::extends_past_full_bounds(visible_bounds, shared)
        {
            ChartViewportMode::FollowFullRange
        } else {
            ChartViewportMode::Custom
        };
    }

    /// Converts plot bounds into a backend-safe request range.
    fn bounds_request_range(bounds: &PlotBounds, shared: &SessionShared) -> RangeInclusive<u64> {
        let min_x = bounds.min()[0].max(0.0) as u64;
        let max_x = bounds.max()[0].max(0.0) as u64;
        let max_x = max_x.min(shared.logs.logs_count.saturating_sub(1));
        min_x..=max_x
    }

    pub fn reset(&mut self) {
        let Self {
            cmd_tx: _,
            throttle,
            current_request_range,
            pending_request_range,
            viewport_mode,
            reset_full_range: reset_viewport_to_full_range,
            data,
        } = self;

        *current_request_range = None;
        *pending_request_range = None;
        *viewport_mode = ChartViewportMode::FollowFullRange;
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

    use egui_plot::PlotBounds;
    use tokio::sync::mpsc;
    use uuid::Uuid;

    use crate::{
        host::common::parsers::ParserNames,
        session::{
            types::{ObserveOperation, OperationPhase},
            ui::shared::{SessionInfo, SessionShared},
        },
    };

    use super::{ChartBar, ChartUI, ChartViewportMode};

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
    fn chart_updates_follow_full_range() {
        let mut shared = new_shared(10);
        shared.search.set_search_result_count(5);
        let mut chart = new_chart();
        chart.current_request_range = Some(0..=9);

        chart.on_chart_data_changes(&shared);

        assert_eq!(chart.viewport_mode, ChartViewportMode::FollowFullRange);
        assert_eq!(chart.pending_request_range, Some(0..=9));
        assert!(chart.reset_full_range);
    }

    #[test]
    fn chart_updates_without_context_are_noop() {
        let shared = new_shared(10);
        let mut chart = new_chart();
        chart.viewport_mode = ChartViewportMode::Custom;
        chart.current_request_range = Some(2..=7);
        chart.pending_request_range = Some(3..=6);

        chart.on_chart_data_changes(&shared);

        assert_eq!(chart.viewport_mode, ChartViewportMode::Custom);
        assert_eq!(chart.current_request_range, Some(2..=7));
        assert_eq!(chart.pending_request_range, Some(3..=6));
        assert!(!chart.reset_full_range);
    }

    #[test]
    fn chart_updates_expand_full_range() {
        let mut shared = new_shared(10);
        shared.search.set_search_result_count(5);
        let mut chart = new_chart();
        chart.current_request_range = Some(0..=9);

        shared.logs.logs_count = 12;
        chart.on_chart_data_changes(&shared);

        assert_eq!(chart.viewport_mode, ChartViewportMode::FollowFullRange);
        assert_eq!(chart.pending_request_range, Some(0..=11));
        assert!(chart.reset_full_range);
    }

    #[test]
    fn custom_updates_prefer_pending_range() {
        let mut shared = new_shared(10);
        shared.search.set_search_result_count(5);
        let mut chart = new_chart();
        chart.viewport_mode = ChartViewportMode::Custom;
        chart.current_request_range = Some(2..=7);
        chart.pending_request_range = Some(3..=6);

        chart.on_chart_data_changes(&shared);

        assert_eq!(chart.viewport_mode, ChartViewportMode::Custom);
        assert_eq!(chart.pending_request_range, Some(3..=6));
        assert!(!chart.reset_full_range);
    }

    #[test]
    fn chart_updates_keep_custom_range() {
        let mut shared = new_shared(10);
        shared.search.set_search_result_count(5);
        let mut chart = new_chart();
        chart.viewport_mode = ChartViewportMode::Custom;
        chart.current_request_range = Some(2..=7);

        chart.on_chart_data_changes(&shared);

        assert_eq!(chart.viewport_mode, ChartViewportMode::Custom);
        assert_eq!(chart.pending_request_range, Some(2..=7));
        assert!(!chart.reset_full_range);
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
        chart.current_request_range = Some(1..=4);
        chart.pending_request_range = Some(2..=7);
        chart.viewport_mode = ChartViewportMode::Custom;
        chart.reset_full_range = true;
        chart.data.set_histogram(vec![vec![ChartBar::new(0, 3)]]);
        chart.data.line_plots.insert(0, vec![point(1, 5.0)]);

        assert!(chart.throttle.ready(None));
        assert!(!chart.throttle.ready(None));

        chart.reset();

        assert!(chart.current_request_range.is_none());
        assert!(chart.pending_request_range.is_none());
        assert_eq!(chart.viewport_mode, ChartViewportMode::FollowFullRange);
        assert!(!chart.reset_full_range);
        assert!(chart.data.bars.is_empty());
        assert!(chart.data.line_plots.is_empty());
        assert!(chart.throttle.ready(None));
    }

    #[test]
    fn values_updates_follow_full_range() {
        let mut shared = new_shared(10);
        shared
            .search_values
            .set_values_map(Some(std::collections::HashMap::from([(0, (1.0, 2.0))])));

        let mut chart = new_chart();
        chart.current_request_range = Some(0..=9);

        chart.on_chart_data_changes(&shared);

        assert_eq!(chart.pending_request_range, Some(0..=9));
        assert!(chart.reset_full_range);
    }

    #[test]
    fn reset_to_full_range_restores_follow_mode() {
        let shared = new_shared(10);
        let mut chart = new_chart();
        chart.viewport_mode = ChartViewportMode::Custom;
        chart.current_request_range = Some(2..=7);

        chart.set_full_range(&shared);

        assert_eq!(chart.viewport_mode, ChartViewportMode::FollowFullRange);
        assert_eq!(chart.pending_request_range, Some(0..=9));
        assert!(chart.reset_full_range);
    }

    #[test]
    fn full_range_matches_session_span() {
        let shared = new_shared(10);
        assert_eq!(0..=9, ChartUI::get_full_range(&shared));
        assert_ne!(1..=9, ChartUI::get_full_range(&shared));
        assert_ne!(0..=8, ChartUI::get_full_range(&shared));
    }

    #[test]
    fn update_viewport_mode_detects_custom_range() {
        let shared = new_shared(10);
        let mut chart = new_chart();

        chart.update_viewport_mode(
            &PlotBounds::from_min_max([2.0, 0.0], [7.0, 1.0]),
            &(2..=7),
            &shared,
        );
        assert_eq!(chart.viewport_mode, ChartViewportMode::Custom);

        chart.update_viewport_mode(&ChartUI::default_bounds(&shared), &(0..=9), &shared);
        assert_eq!(chart.viewport_mode, ChartViewportMode::FollowFullRange);
    }

    #[test]
    fn full_range_request_restores_follow_mode() {
        let shared = new_shared(10);
        let mut chart = new_chart();
        chart.viewport_mode = ChartViewportMode::Custom;

        chart.update_viewport_mode(&ChartUI::default_bounds(&shared), &(0..=9), &shared);

        assert_eq!(chart.viewport_mode, ChartViewportMode::FollowFullRange);
    }

    #[test]
    fn zoomed_out_bounds_clamp_request_range() {
        let shared = new_shared(10);
        let bounds = PlotBounds::from_min_max([-2.0, 0.0], [12.0, 1.0]);

        assert_eq!(ChartUI::bounds_request_range(&bounds, &shared), 0..=9);
    }

    #[test]
    fn zoomed_out_full_range_stays_custom() {
        let shared = new_shared(10);
        let mut chart = new_chart();
        let bounds = PlotBounds::from_min_max([-2.0, 0.0], [12.0, 1.0]);

        chart.update_viewport_mode(&bounds, &(0..=9), &shared);

        assert_eq!(chart.viewport_mode, ChartViewportMode::Custom);
    }

    #[test]
    fn zoomed_out_custom_view_survives_updates() {
        let mut shared = new_shared(10);
        shared.search.set_search_result_count(5);
        let mut chart = new_chart();
        let bounds = PlotBounds::from_min_max([-2.0, 0.0], [12.0, 1.0]);

        chart.current_request_range = Some(0..=9);
        chart.update_viewport_mode(&bounds, &(0..=9), &shared);

        chart.on_chart_data_changes(&shared);

        assert_eq!(chart.viewport_mode, ChartViewportMode::Custom);
        assert_eq!(chart.pending_request_range, Some(0..=9));
        assert!(!chart.reset_full_range);
    }
}
