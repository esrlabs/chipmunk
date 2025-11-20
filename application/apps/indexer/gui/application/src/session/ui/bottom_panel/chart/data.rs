use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct ChartBar {
    /// The index of the currently applied filter.
    pub filter_idx: u8,
    /// Number of matches in the current chart span
    pub matches_count: u16,
}

impl ChartBar {
    pub fn new(filter_idx: u8, count: u16) -> Self {
        Self {
            filter_idx,
            matches_count: count,
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct ChartsData {
    /// Spans of chart data representing the bars of histogram.
    pub bars: Vec<Vec<ChartBar>>,
    /// Values data used in line plots.
    pub line_plots: HashMap<u8, Vec<stypes::Point>>,
}

impl ChartsData {
    pub fn clear(&mut self) {
        let Self { bars, line_plots } = self;
        bars.clear();
        line_plots.clear();
    }
}
