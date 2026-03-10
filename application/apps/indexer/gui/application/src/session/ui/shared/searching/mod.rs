//! Search-related session state shared across filters, log search, and chart extraction.
//!
//! This module groups the `SessionShared` state that drives the search UI.
//! [`FiltersState`] stores the session-local selection of filters and search values,
//! [`SearchState`] tracks log-search matches, and [`SearchValuesState`] tracks the separate
//! extraction pipeline used by charts.

mod filters;
mod search;
mod search_values;

pub use filters::FiltersState;
pub use search::{LogMainIndex, SearchState};
pub use search_values::SearchValuesState;
