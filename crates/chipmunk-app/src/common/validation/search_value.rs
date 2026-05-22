//! Validation rules for search-value definitions.
//!
//! Search values are stricter than filters because they must remain usable for
//! numeric chart extraction. This validator keeps that contract in one place
//! for every UI surface that creates or edits chart definitions.

use crate::common::validation::ValidationEligibility;
use processor::search::filter::{SearchFilter, get_filter_error};
use regex_syntax::ast::{self, Ast};

pub fn validate_search_value_filter(filter: &SearchFilter) -> ValidationEligibility {
    // Search values are regex-based extraction only.
    if !filter.is_regex() {
        return ValidationEligibility::Ineligible {
            reason: "Search value requires Regex mode.".to_owned(),
        };
    }

    // Reuse the same filter compilation path used by the search pipeline.
    if let Some(error) = get_filter_error(filter) {
        return ValidationEligibility::Ineligible {
            reason: format!("Invalid regex: {error}"),
        };
    }

    let ast = match ast::parse::Parser::new().parse(&filter.value) {
        Ok(ast) => ast,
        Err(_) => {
            return ValidationEligibility::Ineligible {
                reason: "Regex cannot be analyzed for capture groups.".to_owned(),
            };
        }
    };

    let Some(first_capture) = first_capture_ast(&ast) else {
        return ValidationEligibility::Ineligible {
            reason: "Regex must include at least one capture group.".to_owned(),
        };
    };

    // First capture group defines the value extracted to charts.
    if !is_numeric_capture(first_capture) {
        return ValidationEligibility::Ineligible {
            reason: "First capture group must describe a numeric value.".to_owned(),
        };
    }

    ValidationEligibility::Eligible
}

fn first_capture_ast(ast: &Ast) -> Option<&Ast> {
    match ast {
        Ast::Group(group) => {
            if group.capture_index() == Some(1) {
                Some(group.ast.as_ref())
            } else {
                first_capture_ast(group.ast.as_ref())
            }
        }
        Ast::Repetition(repetition) => first_capture_ast(repetition.ast.as_ref()),
        Ast::Alternation(alternation) => alternation.asts.iter().find_map(first_capture_ast),
        Ast::Concat(concat) => concat.asts.iter().find_map(first_capture_ast),
        Ast::Empty(_)
        | Ast::Flags(_)
        | Ast::Literal(_)
        | Ast::Dot(_)
        | Ast::Assertion(_)
        | Ast::ClassUnicode(_)
        | Ast::ClassPerl(_)
        | Ast::ClassBracketed(_) => None,
    }
}

#[derive(Debug, Default, Clone, Copy)]
struct NumericState {
    has_digits: bool,
}

/// Validates that a capture group AST is numeric-compatible.
///
/// Accepted constructs are intentionally strict and focus on numeric patterns:
/// digits, sign, decimal separator, exponent marker, and quantifiers/grouping
/// around them.
fn is_numeric_capture(ast: &Ast) -> bool {
    let mut state = NumericState::default();
    is_numeric_ast(ast, &mut state) && state.has_digits
}

/// Recursively validates all AST nodes that appear in the first capture group.
fn is_numeric_ast(ast: &Ast, state: &mut NumericState) -> bool {
    match ast {
        Ast::Empty(_) | Ast::Flags(_) => true,
        Ast::Literal(literal) => is_allowed_numeric_char(literal.c, state),
        Ast::ClassPerl(class) => match class.kind {
            ast::ClassPerlKind::Digit => {
                state.has_digits = true;
                true
            }
            _ => false,
        },
        Ast::ClassBracketed(class) => is_numeric_class_set(&class.kind, state),
        Ast::Repetition(repetition) => is_numeric_ast(repetition.ast.as_ref(), state),
        Ast::Group(group) => is_numeric_ast(group.ast.as_ref(), state),
        Ast::Concat(concat) => concat.asts.iter().all(|ast| is_numeric_ast(ast, state)),
        Ast::Alternation(alternation) => {
            let mut branch_has_digits = true;
            for branch in &alternation.asts {
                let mut branch_state = NumericState::default();
                if !is_numeric_ast(branch, &mut branch_state) {
                    return false;
                }
                branch_has_digits &= branch_state.has_digits;
            }
            state.has_digits |= branch_has_digits;
            true
        }
        Ast::Dot(_) | Ast::Assertion(_) | Ast::ClassUnicode(_) => false,
    }
}

/// Restricts bracket class content to numeric-compatible items.
fn is_numeric_class_set(set: &ast::ClassSet, state: &mut NumericState) -> bool {
    match set {
        ast::ClassSet::Item(item) => is_numeric_class_item(item, state),
        ast::ClassSet::BinaryOp(_) => false,
    }
}

fn is_numeric_class_item(item: &ast::ClassSetItem, state: &mut NumericState) -> bool {
    match item {
        ast::ClassSetItem::Literal(lit) => is_allowed_numeric_char(lit.c, state),
        ast::ClassSetItem::Range(range) => is_allowed_numeric_range(range, state),
        ast::ClassSetItem::Perl(class) => match class.kind {
            ast::ClassPerlKind::Digit => {
                state.has_digits = true;
                true
            }
            _ => false,
        },
        ast::ClassSetItem::Bracketed(class) => is_numeric_class_set(&class.kind, state),
        ast::ClassSetItem::Union(union) => union
            .items
            .iter()
            .all(|item| is_numeric_class_item(item, state)),
        ast::ClassSetItem::Empty(_)
        | ast::ClassSetItem::Ascii(_)
        | ast::ClassSetItem::Unicode(_) => false,
    }
}

fn is_allowed_numeric_range(range: &ast::ClassSetRange, state: &mut NumericState) -> bool {
    let start = range.start.c;
    let end = range.end.c;

    if start.is_ascii_digit() && end.is_ascii_digit() {
        state.has_digits = true;
        return true;
    }

    start == end && is_allowed_numeric_char(start, state)
}

/// Permitted literal chars for numeric captures.
fn is_allowed_numeric_char(c: char, state: &mut NumericState) -> bool {
    if c.is_ascii_digit() {
        state.has_digits = true;
        return true;
    }

    matches!(c, '+' | '-' | '.' | 'e' | 'E')
}

#[cfg(test)]
mod tests {
    use super::validate_search_value_filter;
    use crate::common::validation::ValidationEligibility;
    use processor::search::filter::SearchFilter;

    #[test]
    fn rejects_non_regex_mode() {
        let filter = SearchFilter::plain("cpu=(\\d+)").ignore_case(true);
        assert!(matches!(
            validate_search_value_filter(&filter),
            ValidationEligibility::Ineligible { .. }
        ));
    }

    #[test]
    fn rejects_missing_capture_group() {
        let filter = SearchFilter::plain("cpu=\\d+")
            .regex(true)
            .ignore_case(true);
        assert!(matches!(
            validate_search_value_filter(&filter),
            ValidationEligibility::Ineligible { .. }
        ));
    }

    #[test]
    fn rejects_non_numeric_capture_group() {
        let filter = SearchFilter::plain("cpu=([a-z]+)")
            .regex(true)
            .ignore_case(true);
        assert!(matches!(
            validate_search_value_filter(&filter),
            ValidationEligibility::Ineligible { .. }
        ));
    }

    #[test]
    fn rejects_when_first_group_is_not_numeric_even_if_later_group_is_numeric() {
        let filter = SearchFilter::plain("cpu=([a-z]+)-(\\d+)")
            .regex(true)
            .ignore_case(true);
        assert!(matches!(
            validate_search_value_filter(&filter),
            ValidationEligibility::Ineligible { .. }
        ));
    }

    #[test]
    fn rejects_escaped_parentheses_without_capture_group() {
        let filter = SearchFilter::plain("cpu=\\(\\d+\\)")
            .regex(true)
            .ignore_case(true);
        assert!(matches!(
            validate_search_value_filter(&filter),
            ValidationEligibility::Ineligible { .. }
        ));
    }

    #[test]
    fn accepts_digit_character_class_capture_group() {
        let filter = SearchFilter::plain("cpu=([0-9]+)")
            .regex(true)
            .ignore_case(true);
        assert!(matches!(
            validate_search_value_filter(&filter),
            ValidationEligibility::Eligible
        ));
    }

    #[test]
    fn accepts_signed_decimal_capture_group() {
        let filter = SearchFilter::plain("cpu=([-+]?\\d*\\.\\d+)")
            .regex(true)
            .ignore_case(true);
        assert!(matches!(
            validate_search_value_filter(&filter),
            ValidationEligibility::Eligible
        ));
    }

    #[test]
    fn accepts_scientific_notation_capture_group() {
        let filter = SearchFilter::plain("cpu=([-+]?\\d+[eE][-+]?\\d+)")
            .regex(true)
            .ignore_case(true);
        assert!(matches!(
            validate_search_value_filter(&filter),
            ValidationEligibility::Eligible
        ));
    }

    #[test]
    fn rejects_wildcard_capture_group() {
        let filter = SearchFilter::plain("cpu=(.+)")
            .regex(true)
            .ignore_case(true);
        assert!(matches!(
            validate_search_value_filter(&filter),
            ValidationEligibility::Ineligible { .. }
        ));
    }

    #[test]
    fn accepts_numeric_alternation() {
        let filter = SearchFilter::plain("cpu=(\\d+|\\d+\\.\\d+)")
            .regex(true)
            .ignore_case(true);
        assert!(matches!(
            validate_search_value_filter(&filter),
            ValidationEligibility::Eligible
        ));
    }

    #[test]
    fn rejects_mixed_alternation_with_non_numeric_branch() {
        let filter = SearchFilter::plain("cpu=(\\d+|abc)")
            .regex(true)
            .ignore_case(true);
        assert!(matches!(
            validate_search_value_filter(&filter),
            ValidationEligibility::Ineligible { .. }
        ));
    }

    #[test]
    fn accepts_nested_numeric_first_group() {
        let filter = SearchFilter::plain("cpu=((\\d+))")
            .regex(true)
            .ignore_case(true);
        assert!(matches!(
            validate_search_value_filter(&filter),
            ValidationEligibility::Eligible
        ));
    }

    #[test]
    fn invalid_regex_has_non_empty_reason() {
        let filter = SearchFilter::plain("cpu=(\\d+")
            .regex(true)
            .ignore_case(true);
        let result = validate_search_value_filter(&filter);

        match result {
            ValidationEligibility::Eligible => {
                panic!("Invalid regex must not be eligible");
            }
            ValidationEligibility::Ineligible { reason } => {
                assert!(!reason.trim().is_empty());
            }
        }
    }

    #[test]
    fn accepts_signed_float_capture_group() {
        let filter = SearchFilter::plain("cpu=([-+]?\\d+(\\.\\d+)?)")
            .regex(true)
            .ignore_case(true);
        assert!(matches!(
            validate_search_value_filter(&filter),
            ValidationEligibility::Eligible
        ));
    }

    #[test]
    fn accepts_exponent_capture_group() {
        let filter = SearchFilter::plain("cpu=([-+]?\\d+(\\.\\d+)?([eE][-+]?\\d+)?)")
            .regex(true)
            .ignore_case(true);
        assert!(matches!(
            validate_search_value_filter(&filter),
            ValidationEligibility::Eligible
        ));
    }

    #[test]
    fn eligible_has_no_reason() {
        let filter = SearchFilter::plain("cpu=(\\d+)")
            .regex(true)
            .ignore_case(true);

        let result = validate_search_value_filter(&filter);

        assert!(matches!(result, ValidationEligibility::Eligible));
    }

    #[test]
    fn invalid_exposes_reason() {
        let filter = SearchFilter::plain("cpu=\\d+")
            .regex(true)
            .ignore_case(true);

        let result = validate_search_value_filter(&filter);

        assert!(matches!(
            result,
            ValidationEligibility::Ineligible { reason }
            if reason == "Regex must include at least one capture group."
        ));
    }
}
