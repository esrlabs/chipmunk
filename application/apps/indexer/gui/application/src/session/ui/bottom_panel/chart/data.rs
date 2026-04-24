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

#[derive(Debug, Clone)]
pub struct SearchValueSeries {
    pub value_idx: u8,
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
    pub search_value_series: Vec<SearchValueSeries>,
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
    /// 1. Enabled filters in session order.
    /// 2. Active temp search as the last series (if present).
    pub fn resolve_histogram_series(&mut self, shared: &SessionShared, registry: &FilterRegistry) {
        self.series.clear();

        for (idx, item) in shared
            .filters
            .filter_entries
            .iter()
            .filter(|item| item.enabled)
            .enumerate()
        {
            let Some(filter_def) = registry.get_filter(&item.id) else {
                continue;
            };
            let Ok(filter_idx) = u8::try_from(idx) else {
                continue;
            };

            self.series.push(HistogramSeries {
                filter_idx,
                name: filter_def.filter.value.clone(),
                color: item.colors.bg,
            });
        }

        // Append temp search to the end of charts
        if let Some(temp_search) = &shared.filters.active_temp_search
            && let Ok(filter_idx) = u8::try_from(shared.filters.enabled_filter_ids().count())
        {
            self.series.push(HistogramSeries {
                filter_idx,
                name: temp_search.filter().value.clone(),
                color: TEMP_SEARCH_COLORS.bg,
            });
        }
    }

    /// Resolve active search-value series for the current session in backend index order.
    pub fn resolve_search_value_series(
        &mut self,
        shared: &SessionShared,
        registry: &FilterRegistry,
    ) {
        self.search_value_series.clear();

        for (idx, item) in shared
            .filters
            .search_value_entries
            .iter()
            .filter(|item| item.enabled)
            .enumerate()
        {
            let Some(value_def) = registry.get_search_value(&item.id) else {
                continue;
            };
            let Ok(value_idx) = u8::try_from(idx) else {
                continue;
            };

            self.search_value_series.push(SearchValueSeries {
                value_idx,
                name: value_def.filter.value.clone(),
                color: item.color,
            });
        }
    }

    /// Clears cached histogram data, line plots, and resolved series metadata.
    pub fn clear(&mut self) {
        let Self {
            bars,
            line_plots,
            series,
            search_value_series,
        } = self;

        bars.clear();
        line_plots.clear();
        series.clear();
        search_value_series.clear();
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use egui::Color32;
    use processor::search::filter::SearchFilter;
    use uuid::Uuid;

    use crate::{
        host::{
            common::{colors::ColorPair, parsers::ParserNames},
            ui::registry::filters::{FilterDefinition, FilterRegistry, SearchValueDefinition},
        },
        session::{
            types::ObserveOperation,
            ui::shared::{SessionInfo, SessionShared},
        },
    };

    use super::*;

    fn new_shared() -> SessionShared {
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

        SessionShared::new(session_info, observe_op)
    }

    #[test]
    fn clear_resets_cache() {
        let mut data = ChartsData::default();
        data.set_histogram(vec![vec![ChartBar::new(0, 3)]]);
        data.line_plots.insert(
            0,
            vec![stypes::Point {
                row: 1,
                min: 1.5,
                max: 2.5,
                y_value: 2.0,
            }],
        );
        data.series.push(super::HistogramSeries {
            filter_idx: 0,
            name: "series".to_owned(),
            color: egui::Color32::WHITE,
        });
        data.search_value_series.push(super::SearchValueSeries {
            value_idx: 0,
            name: "value".to_owned(),
            color: egui::Color32::RED,
        });

        data.clear();

        assert!(data.bars.is_empty());
        assert!(data.line_plots.is_empty());
        assert!(data.series.is_empty());
        assert!(data.search_value_series.is_empty());
    }

    #[test]
    fn resolve_histogram_series_uses_session_colors() {
        let mut shared = new_shared();
        let mut registry = FilterRegistry::default();
        let mut data = ChartsData::default();

        let first = FilterDefinition::new(SearchFilter::plain("status=ok").ignore_case(true));
        let first_id = first.id;
        registry.add_filter(first);

        let second = FilterDefinition::new(SearchFilter::plain("status=warn").ignore_case(true));
        let second_id = second.id;
        registry.add_filter(second);

        shared.filters.apply_filter(&mut registry, first_id);
        shared
            .filters
            .filter_entries
            .iter_mut()
            .find(|item| item.id == first_id)
            .expect("first filter should exist")
            .colors = ColorPair::new(Color32::WHITE, Color32::RED);

        shared.filters.apply_filter(&mut registry, second_id);
        shared
            .filters
            .filter_entries
            .iter_mut()
            .find(|item| item.id == second_id)
            .expect("second filter should exist")
            .colors = ColorPair::new(Color32::BLACK, Color32::GREEN);

        data.resolve_histogram_series(&shared, &registry);

        assert_eq!(data.series.len(), 2);
        assert_eq!(data.series[0].name, "status=ok");
        assert_eq!(data.series[0].color, Color32::RED);
        assert_eq!(data.series[1].name, "status=warn");
        assert_eq!(data.series[1].color, Color32::GREEN);
    }

    #[test]
    fn resolve_value_series_skips_missing() {
        let mut shared = new_shared();
        let mut registry = FilterRegistry::default();
        let mut data = ChartsData::default();

        let first = SearchValueDefinition::new(
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
        );
        let first_id = first.id;
        registry.add_search_value(first);

        let second = SearchValueDefinition::new(
            SearchFilter::plain("temp=(\\d+)")
                .regex(true)
                .ignore_case(true),
        );
        let second_id = second.id;
        registry.add_search_value(second);

        // Keep a missing id in the middle to verify we skip unknown entries
        // without re-numbering backend indices.
        shared.filters.apply_search_value(&mut registry, first_id);
        shared
            .filters
            .search_value_entries
            .iter_mut()
            .find(|item| item.id == first_id)
            .expect("first search value should exist")
            .color = Color32::RED;
        shared
            .filters
            .apply_search_value(&mut registry, Uuid::new_v4());
        shared.filters.apply_search_value(&mut registry, second_id);
        shared
            .filters
            .search_value_entries
            .iter_mut()
            .find(|item| item.id == second_id)
            .expect("second search value should exist")
            .color = Color32::GREEN;

        data.resolve_search_value_series(&shared, &registry);

        assert_eq!(data.search_value_series.len(), 2);
        assert_eq!(data.search_value_series[0].value_idx, 0);
        assert_eq!(data.search_value_series[0].name, "cpu=(\\d+)");
        assert_eq!(data.search_value_series[0].color, Color32::RED);
        // The second resolved series keeps index 2 because enabled order is canonical.
        assert_eq!(data.search_value_series[1].value_idx, 2);
        assert_eq!(data.search_value_series[1].name, "temp=(\\d+)");
        assert_eq!(data.search_value_series[1].color, Color32::GREEN);
    }
}
