//! Shared validation helpers for user-authored search definitions.
//!
//! This module centralizes the validation entrypoints used by both the search
//! bar and the sidebar editors so UI surfaces do not drift in accepted input or
//! disabled-reason text.

mod filter;
mod search_value;

pub use filter::{validate_filter, validate_filter_regex_enable};
pub use search_value::validate_search_value_filter;

/// Shared eligibility state for UI validation helpers.
#[derive(Debug, Clone)]
pub enum ValidationEligibility {
    Eligible,
    Ineligible { reason: String },
}

impl ValidationEligibility {
    pub const fn is_eligible(&self) -> bool {
        matches!(self, Self::Eligible)
    }
}
