//! Service-owned state for operations that need follow-up after backend callbacks.

use super::export::SearchResultsTabOperation;

/// Tracks operations that need service-side work after backend completion callbacks.
#[derive(Debug, Default)]
pub struct OperationTracker {
    /// Pending generated search-results tab export, if one is in progress.
    pub search_results_tab: Option<SearchResultsTabOperation>,
}
