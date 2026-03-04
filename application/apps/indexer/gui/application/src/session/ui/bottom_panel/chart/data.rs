use egui::{Color32, ahash::HashMapExt as _};
use rustc_hash::FxHashMap;

use crate::{
    host::{common::colors::TEMP_SEARCH_COLORS, ui::registry::filters::FilterRegistry},
    session::ui::shared::SessionShared,
};

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

#[derive(Debug, Clone)]
pub struct HistogramSeries {
    pub filter_idx: u8,
    pub name: String,
    pub color: Color32,
}

#[derive(Debug, Clone, Default)]
pub struct HistogramBucket {
    /// Map filter index to its counts for one x-axis bucket.
    pub counts: FxHashMap<u8, u16>,
}

#[derive(Debug, Clone, Default)]
pub struct ChartsData {
    /// Spans of chart data representing bars counts per filter index.
    pub bars: Vec<HistogramBucket>,
    /// Values data used in line plots.
    pub line_plots: FxHashMap<u8, Vec<stypes::Point>>,

    pub series: Vec<HistogramSeries>,
}

impl ChartsData {
    /// Convert backend histogram buckets into a sparse per-bucket index map.
    ///
    /// Backend sends sparse `(filter_idx, matches_count)` pairs per bucket.
    /// We keep only present indices to avoid allocating empty slots per series.
    /// Duplicate indices in the same bucket are overwritten by the last entry.
    pub fn set_histogram(&mut self, raw_bars: Vec<Vec<ChartBar>>) {
        self.bars.clear();

        for bucket in raw_bars {
            let mut counts = FxHashMap::with_capacity(bucket.len());

            for bar in bucket {
                counts.insert(bar.filter_idx, bar.matches_count);
            }

            self.bars.push(HistogramBucket { counts });
        }
    }

    /// Resolve active histogram series for the current session in backend index order.
    ///
    /// The expected index mapping is:
    /// 1. Applied filters in `applied_filters` order.
    /// 2. Active temp search as the last series (if present).
    pub fn resolve_histogram_series(&mut self, shared: &SessionShared, registry: &FilterRegistry) {
        self.series.clear();

        for (idx, filter_id) in shared.filters.applied_filters.iter().enumerate() {
            let Some(filter_def) = registry.get_filter(filter_id) else {
                continue;
            };
            let Ok(filter_idx) = u8::try_from(idx) else {
                continue;
            };

            self.series.push(HistogramSeries {
                filter_idx,
                name: filter_def.filter.value.clone(),
                color: filter_def.colors.bg,
            });
        }

        // Append temp search to the end of charts
        if let Some(temp_search) = &shared.filters.active_temp_search
            && let Ok(filter_idx) = u8::try_from(shared.filters.applied_filters.len())
        {
            self.series.push(HistogramSeries {
                filter_idx,
                name: temp_search.value.clone(),
                color: TEMP_SEARCH_COLORS.bg,
            });
        }
    }

    pub fn clear(&mut self) {
        let Self {
            bars,
            line_plots,
            series,
        } = self;
        bars.clear();
        line_plots.clear();
        series.clear();
    }
}
