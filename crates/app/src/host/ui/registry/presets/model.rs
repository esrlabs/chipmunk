//! Preset data model and row snapshot constructors.

use egui::Color32;
use processor::search::filter::SearchFilter;
use uuid::Uuid;

use crate::host::common::colors::{self, ColorPair};

/// Preset definition with copied row state.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Preset {
    /// Runtime identifier used by UI selection and edit flows.
    pub id: Uuid,
    /// User-visible preset name.
    pub name: String,
    /// Stored filter rows.
    pub filters: Vec<PresetFilterEntry>,
    /// Stored chart/search-value rows.
    pub search_values: Vec<PresetSearchValueEntry>,
}

/// Stored preset snapshot for one filter row.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PresetFilterEntry {
    /// Filter definition stored for the row.
    pub filter: SearchFilter,
    /// Whether the row was enabled when captured.
    pub enabled: bool,
    /// Highlight colors stored for the row.
    pub colors: ColorPair,
}

/// Stored preset snapshot for one chart/search-value row.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PresetSearchValueEntry {
    /// Search-value definition stored for the row.
    pub filter: SearchFilter,
    /// Whether the row was enabled when captured.
    pub enabled: bool,
    /// Chart color stored for the row.
    pub color: Color32,
}

impl PresetFilterEntry {
    /// Creates a filter entry with explicit row state.
    pub fn new(filter: SearchFilter, enabled: bool, colors: ColorPair) -> Self {
        Self {
            filter,
            enabled,
            colors,
        }
    }

    /// Creates an enabled filter entry using the default color for its row index.
    pub fn with_default_color(filter: SearchFilter, index: usize) -> Self {
        let colors =
            colors::FILTER_HIGHLIGHT_COLORS[index % colors::FILTER_HIGHLIGHT_COLORS.len()].clone();
        Self::new(filter, true, colors)
    }

    /// Creates an enabled filter entry using the next color after existing entries.
    pub fn with_next_color(filter: SearchFilter, entries: &[Self]) -> Self {
        let used_colors = entries
            .iter()
            .map(|entry| entry.colors.clone())
            .collect::<Vec<_>>();

        Self::new(filter, true, colors::next_filter_color(&used_colors))
    }
}

impl PresetSearchValueEntry {
    /// Creates a search-value entry with explicit row state.
    pub fn new(filter: SearchFilter, enabled: bool, color: Color32) -> Self {
        Self {
            filter,
            enabled,
            color,
        }
    }

    /// Creates an enabled search-value entry using the default color for its row index.
    pub fn with_default_color(filter: SearchFilter, index: usize) -> Self {
        Self::new(filter, true, colors::search_value_color(index))
    }

    /// Creates an enabled search-value entry using the next color after existing entries.
    pub fn with_next_color(filter: SearchFilter, entries: &[Self]) -> Self {
        let used_colors = entries.iter().map(|entry| entry.color).collect::<Vec<_>>();
        Self::new(filter, true, colors::next_search_value_color(&used_colors))
    }
}

impl Preset {
    /// Builds a preset from filters and default row state.
    pub fn with_default_state(
        id: Uuid,
        name: String,
        filters: Vec<SearchFilter>,
        search_values: Vec<SearchFilter>,
    ) -> Self {
        let filters = filters
            .into_iter()
            .enumerate()
            .map(|(index, filter)| PresetFilterEntry::with_default_color(filter, index))
            .collect();
        let search_values = search_values
            .into_iter()
            .enumerate()
            .map(|(index, filter)| PresetSearchValueEntry::with_default_color(filter, index))
            .collect();

        Self {
            id,
            name,
            filters,
            search_values,
        }
    }
}
