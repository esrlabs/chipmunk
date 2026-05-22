//! Validation rules for filter definitions.
//!
//! Filters are the least restrictive search input: they only reject empty text
//! and invalid regex patterns when regex mode is enabled.

use crate::common::validation::ValidationEligibility;
use processor::search::filter::{SearchFilter, get_filter_error};

pub fn validate_filter(filter: &SearchFilter) -> ValidationEligibility {
    if filter.value.is_empty() {
        return ValidationEligibility::Ineligible {
            reason: "Filter text cannot be empty".to_owned(),
        };
    }

    if !filter.is_regex() {
        return ValidationEligibility::Eligible;
    }

    if let Some(error) = get_filter_error(filter) {
        return ValidationEligibility::Ineligible {
            reason: format!("Invalid regex: {error}"),
        };
    }

    ValidationEligibility::Eligible
}

/// Validates whether the current filter text can safely switch into regex mode.
///
/// This is intentionally different from `validate_filter`: if regex mode is
/// already active, the toggle remains eligible so users can still turn it off.
pub fn validate_filter_regex_enable(filter: &SearchFilter) -> ValidationEligibility {
    if filter.is_regex() {
        return ValidationEligibility::Eligible;
    }

    validate_filter(&filter.clone().regex(true))
}

#[cfg(test)]
mod tests {
    use super::{validate_filter, validate_filter_regex_enable};
    use crate::common::validation::ValidationEligibility;
    use processor::search::filter::SearchFilter;

    #[test]
    fn rejects_empty_filter_text() {
        let filter = SearchFilter::plain("").ignore_case(true);

        assert!(matches!(
            validate_filter(&filter),
            ValidationEligibility::Ineligible { .. }
        ));
    }

    #[test]
    fn accepts_non_regex_filter() {
        let filter = SearchFilter::plain("cpu=42").ignore_case(true);

        assert!(matches!(
            validate_filter(&filter),
            ValidationEligibility::Eligible
        ));
    }

    #[test]
    fn rejects_invalid_regex() {
        let filter = SearchFilter::plain("(").regex(true).ignore_case(true);

        let result = validate_filter(&filter);

        assert!(matches!(result, ValidationEligibility::Ineligible { .. }));
        if let ValidationEligibility::Ineligible { reason } = result {
            assert!(reason.starts_with("Invalid regex:"));
        }
    }

    #[test]
    fn accepts_valid_regex() {
        let filter = SearchFilter::plain("cpu=(\\d+)")
            .regex(true)
            .ignore_case(true);

        assert!(matches!(
            validate_filter(&filter),
            ValidationEligibility::Eligible
        ));
    }

    #[test]
    fn regex_enable_rejects_invalid_pattern() {
        let filter = SearchFilter::plain("(").ignore_case(true);

        assert!(matches!(
            validate_filter_regex_enable(&filter),
            ValidationEligibility::Ineligible { .. }
        ));
    }

    #[test]
    fn regex_enable_skips_active_regex() {
        let filter = SearchFilter::plain("(").regex(true).ignore_case(true);

        assert!(matches!(
            validate_filter_regex_enable(&filter),
            ValidationEligibility::Eligible
        ));
    }
}
