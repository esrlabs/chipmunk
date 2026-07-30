//! Shared text layout for log table cells.
//!
//! This module combines ANSI SGR color spans with primary and nested search
//! highlights in one egui `LayoutJob`. ANSI parsing itself stays in `ansi_text`;
//! this module owns the log-table rendering policy and precedence rules.

use std::ops::Range;

use egui::{
    Color32, Response, TextStyle, Ui,
    text::{LayoutJob, LayoutSection},
};
use regex::Regex;

use crate::session::ui::{
    common::ansi_text::{AnsiSpan, AnsiText},
    definitions::{LogTableCell, LogTableItem},
    shared::{SessionShared, searching::FilterIndex},
};

const LOG_TEXT_STYLE: TextStyle = TextStyle::Monospace;

// This overlay is only painted for rows the backend already marked as matched,
// so it sits on top of the row-level match tint instead of the plain table background.
// A single translucent white highlight stays visible in both themes on that base.
const FILTER_MATCH_HIGHLIGHT_BG: Color32 = Color32::from_rgba_unmultiplied_const(255, 255, 255, 60);
const NESTED_MATCH_HIGHLIGHT_BG: Color32 = Color32::from_rgba_unmultiplied_const(255, 180, 0, 140);

/// Renders a monospace log-table cell with cached ANSI spans and match highlights.
pub fn render_log_cell_text(
    ui: &mut Ui,
    item: &LogTableItem,
    col_idx: usize,
    shared: &SessionShared,
) -> Response {
    let Some(cell) = item.cells.get(col_idx) else {
        return ui.monospace("");
    };

    let main_log_pos = item.element.pos as u64;
    match cell {
        LogTableCell::Plain(range) => {
            let content = item.element.content.get(range.clone()).unwrap_or_default();
            render_plain_cell(ui, content, main_log_pos, shared)
        }
        LogTableCell::Ansi(ansi_text) => render_ansi_cell(ui, ansi_text, main_log_pos, shared),
    }
}

fn render_plain_cell(
    ui: &mut Ui,
    content: &str,
    main_log_pos: u64,
    shared: &SessionShared,
) -> Response {
    let (match_spans, nested_spans) = cell_highlight_spans(
        content,
        main_log_pos,
        shared,
        shared.search.compiled_filters(),
    );
    if match_spans.is_empty() && nested_spans.is_empty() {
        ui.monospace(content)
    } else {
        let mut content_job = build_match_layout_job(ui, content, &match_spans);
        apply_nested_highlight(&mut content_job, &nested_spans);

        ui.label(content_job)
    }
}

fn render_ansi_cell(
    ui: &mut Ui,
    ansi_text: &AnsiText,
    main_log_pos: u64,
    shared: &SessionShared,
) -> Response {
    let (match_spans, nested_spans) = cell_highlight_spans(
        &ansi_text.text,
        main_log_pos,
        shared,
        shared.search.compiled_filters(),
    );
    if ansi_text.spans.is_empty() {
        if match_spans.is_empty() && nested_spans.is_empty() {
            ui.monospace(&ansi_text.text)
        } else {
            let mut job = build_match_layout_job(ui, &ansi_text.text, &match_spans);
            apply_nested_highlight(&mut job, &nested_spans);

            ui.label(job)
        }
    } else {
        let mut job = build_log_layout_job(ui, &ansi_text.text, &ansi_text.spans, &match_spans);
        apply_nested_highlight(&mut job, &nested_spans);

        ui.label(job)
    }
}

/// Returns the backend-reported filter indices for one main-log position, if that row matched.
fn matched_filter_indices(shared: &SessionShared, main_log_pos: u64) -> Option<&[FilterIndex]> {
    shared.search.filter_indices(main_log_pos)
}

/// Finds all cell-local matches for the row's matched filters and merges overlap into one pass.
fn cell_match_spans(
    content: &str,
    matched_filters: &[FilterIndex],
    compiled_filters: &[Regex],
) -> Vec<Range<usize>> {
    let spans: Vec<Range<usize>> = matched_filters
        .iter()
        .filter_map(|idx| compiled_filters.get(idx.0 as usize))
        .flat_map(|filter| filter.find_iter(content))
        .filter_map(|mat| (mat.start() < mat.end()).then_some(mat.range()))
        .collect();

    merge_match_spans(spans)
}

/// Resolves primary and nested highlight spans with one row-metadata lookup.
///
/// # Returns
///
/// The first vector contains spans from the row's matched primary filters. The second contains
/// spans from the nested matcher when the row belongs to the primary search results.
fn cell_highlight_spans(
    content: &str,
    main_log_pos: u64,
    shared: &SessionShared,
    compiled_filters: &[Regex],
) -> (Vec<Range<usize>>, Vec<Range<usize>>) {
    let matched_filters = matched_filter_indices(shared, main_log_pos);
    let match_spans = matched_filters
        .map(|filters| cell_match_spans(content, filters, compiled_filters))
        .unwrap_or_default();
    let nested_spans = if matched_filters.is_some() {
        shared
            .search
            .nested()
            .matcher()
            .map(|matcher| nested_match_spans(content, matcher))
            .unwrap_or_default()
    } else {
        Vec::new()
    };

    (match_spans, nested_spans)
}

/// Finds and coalesces adjacent nested matches in displayed cell text.
fn nested_match_spans(content: &str, matcher: &Regex) -> Vec<Range<usize>> {
    let mut spans: Vec<Range<usize>> = Vec::new();
    for mat in matcher.find_iter(content) {
        if mat.start() == mat.end() {
            continue;
        }

        let range = mat.range();
        if let Some(last) = spans.last_mut()
            && range.start == last.end
        {
            last.end = range.end;
        } else {
            spans.push(range);
        }
    }
    spans
}

/// Coalesces overlapping or adjacent spans so the final paint pass uses minimal segments.
fn merge_match_spans(mut spans: Vec<Range<usize>>) -> Vec<Range<usize>> {
    if spans.len() <= 1 {
        return spans;
    }

    spans.sort_unstable_by_key(|range| (range.start, range.end));

    let mut merged: Vec<Range<usize>> = Vec::with_capacity(spans.len());

    for span in spans {
        if let Some(last) = merged.last_mut()
            && span.start <= last.end
        {
            last.end = last.end.max(span.end);
        } else {
            merged.push(span);
        }
    }

    merged
}

/// Builds the cheaper search-only layout used when no ANSI escape exists.
fn build_match_layout_job(ui: &Ui, content: &str, spans: &[Range<usize>]) -> LayoutJob {
    let mut job = LayoutJob::default();
    let base_format = base_log_format(ui);
    let highlight_format = egui::text::TextFormat {
        background: FILTER_MATCH_HIGHLIGHT_BG,
        ..base_format.clone()
    };

    let mut cursor = 0;
    for span in spans {
        if cursor < span.start {
            job.append(&content[cursor..span.start], 0.0, base_format.clone());
        }
        job.append(
            &content[span.start..span.end],
            0.0,
            highlight_format.clone(),
        );
        cursor = span.end;
    }

    if cursor < content.len() {
        job.append(&content[cursor..], 0.0, base_format);
    }

    job
}

/// Builds a layout for ANSI-styled text without search highlighting.
pub fn ansi_layout_job(ui: &Ui, ansi_text: &AnsiText, base_color: Color32) -> LayoutJob {
    build_styled_layout_job(
        &ansi_text.text,
        &ansi_text.spans,
        &[],
        text_format(ui, base_color),
    )
}

/// Builds a layout where ANSI spans and search-highlight spans can overlap.
///
/// The input spans must use byte ranges in `content`. Search highlighting wins
/// over ANSI background, while ANSI foreground stays active.
fn build_log_layout_job(
    ui: &Ui,
    content: &str,
    ansi_spans: &[AnsiSpan],
    match_spans: &[Range<usize>],
) -> LayoutJob {
    build_styled_layout_job(content, ansi_spans, match_spans, base_log_format(ui))
}

fn build_styled_layout_job(
    content: &str,
    ansi_spans: &[AnsiSpan],
    match_spans: &[Range<usize>],
    base_format: egui::text::TextFormat,
) -> LayoutJob {
    let mut job = LayoutJob::default();

    // A LayoutJob segment can have only one final TextFormat. ANSI styling and
    // search highlighting are represented as independent ranges, so first split
    // the text at every range edge. Each pair of adjacent boundaries then covers
    // a segment where the active ANSI style and match state cannot change.

    // Include text start/end plus start/end for every style and match range.
    let boundary_count = 2 + 2 * (ansi_spans.len() + match_spans.len());
    let mut boundaries = Vec::with_capacity(boundary_count);
    boundaries.push(0);
    boundaries.push(content.len());
    for span in ansi_spans {
        boundaries.push(span.range.start);
        boundaries.push(span.range.end);
    }
    for span in match_spans {
        boundaries.push(span.start);
        boundaries.push(span.end);
    }
    // Multiple ranges can start/end at the same byte, so remove duplicates after sorting.
    boundaries.sort_unstable();
    boundaries.dedup();

    let mut ansi_idx = 0;
    let mut match_idx = 0;
    // Walk each segment between two adjacent boundaries, resolve the active ANSI
    // style and match state for that segment, then append it with one TextFormat.
    for window in boundaries.windows(2) {
        let start = window[0];
        let end = window[1];
        if start == end {
            continue;
        }

        // Spans are sorted and non-overlapping within their own list, so indexes
        // only move forward as segment starts increase.
        while ansi_spans
            .get(ansi_idx)
            .is_some_and(|span| span.range.end <= start)
        {
            ansi_idx += 1;
        }
        while match_spans
            .get(match_idx)
            .is_some_and(|span| span.end <= start)
        {
            match_idx += 1;
        }

        // Resolve whether the current segment is inside the active match span.
        let is_match = match_spans
            .get(match_idx)
            .is_some_and(|span| span.start <= start && start < span.end);

        // Start from row-aware defaults, then layer ANSI colors and match overlay.
        let mut format = base_format.clone();
        if let Some(span) = ansi_spans
            .get(ansi_idx)
            .filter(|span| span.range.start <= start && start < span.range.end)
        {
            if let Some(fg) = span.style.fg {
                format.color = fg;
            }
            if let Some(bg) = span.style.bg {
                format.background = bg;
                if span.style.fg.is_none() && !is_match {
                    format.color = readable_text_color(bg, format.color);
                }
            }
        }
        if is_match {
            // The match overlay is translucent, so do not derive contrast from it here.
            format.background = FILTER_MATCH_HIGHLIGHT_BG;
        }

        // The segment boundaries were collected from UTF-8-safe regex and parser ranges.
        job.append(&content[start..end], 0.0, format);
    }

    job
}

/// Applies nested background last while preserving every existing section style.
fn apply_nested_highlight(job: &mut LayoutJob, nested_spans: &[Range<usize>]) {
    if nested_spans.is_empty() {
        return;
    }

    let source_sections = std::mem::take(&mut job.sections);
    let mut sections = Vec::with_capacity(source_sections.len() + nested_spans.len() * 2);
    let mut first_nested = 0;

    for source in source_sections {
        while nested_spans
            .get(first_nested)
            .is_some_and(|span| span.end <= source.byte_range.start)
        {
            first_nested += 1;
        }

        let mut cursor = source.byte_range.start;
        let mut nested_idx = first_nested;
        while let Some(span) = nested_spans.get(nested_idx) {
            if span.start >= source.byte_range.end {
                break;
            }

            let highlight_start = span.start.max(cursor);
            let highlight_end = span.end.min(source.byte_range.end);
            if cursor < highlight_start {
                push_layout_section(&mut sections, &source, cursor..highlight_start, false);
            }
            if highlight_start < highlight_end {
                push_layout_section(&mut sections, &source, highlight_start..highlight_end, true);
                cursor = highlight_end;
            }
            nested_idx += 1;
        }

        if cursor < source.byte_range.end {
            push_layout_section(&mut sections, &source, cursor..source.byte_range.end, false);
        }
    }

    job.sections = sections;
}

fn push_layout_section(
    sections: &mut Vec<LayoutSection>,
    source: &LayoutSection,
    byte_range: Range<usize>,
    nested: bool,
) {
    let leading_space = if byte_range.start == source.byte_range.start {
        source.leading_space
    } else {
        0.0
    };
    let mut format = source.format.clone();
    if nested {
        format.background = NESTED_MATCH_HIGHLIGHT_BG;
    }
    let section = LayoutSection {
        leading_space,
        byte_range,
        format,
    };
    sections.push(section);
}

/// Returns the base text format shared by ANSI and search-highlight jobs.
fn base_log_format(ui: &Ui) -> egui::text::TextFormat {
    text_format(
        ui,
        ui.style()
            .visuals
            .override_text_color
            .unwrap_or_else(|| ui.visuals().text_color()),
    )
}

fn text_format(ui: &Ui, color: Color32) -> egui::text::TextFormat {
    egui::text::TextFormat {
        font_id: LOG_TEXT_STYLE.resolve(ui.style()),
        color,
        ..Default::default()
    }
}

/// Keeps `base` when readable, otherwise chooses black or white for the background.
fn readable_text_color(background: Color32, base: Color32) -> Color32 {
    const MIN_TEXT_BACKGROUND_CONTRAST: f32 = 4.5;

    if contrast_ratio(base, background) >= MIN_TEXT_BACKGROUND_CONTRAST {
        return base;
    }

    let black_contrast = contrast_ratio(Color32::BLACK, background);
    let white_contrast = contrast_ratio(Color32::WHITE, background);
    if black_contrast >= white_contrast {
        Color32::BLACK
    } else {
        Color32::WHITE
    }
}

/// WCAG contrast ratio between two opaque sRGB colors.
fn contrast_ratio(first: Color32, second: Color32) -> f32 {
    let first = relative_luminance(first);
    let second = relative_luminance(second);
    let lighter = first.max(second);
    let darker = first.min(second);

    // WCAG adds 0.05 so pure black still has a finite contrast ratio.
    (lighter + 0.05) / (darker + 0.05)
}

/// Relative luminance for an opaque sRGB color.
fn relative_luminance(color: Color32) -> f32 {
    // WCAG weights linear RGB by human-perceived brightness: green contributes
    // most, then red, then blue.
    0.2126 * linear_channel(color.r())
        + 0.7152 * linear_channel(color.g())
        + 0.0722 * linear_channel(color.b())
}

/// Converts one sRGB channel to linear light.
fn linear_channel(value: u8) -> f32 {
    // Color32 stores channels as 0..=255 sRGB bytes; normalize to 0.0..=1.0 first.
    let channel = f32::from(value) / 255.0;
    if channel <= 0.03928 {
        // Low sRGB values use the linear part of the transfer function.
        channel / 12.92
    } else {
        // Higher sRGB values use the gamma curve defined by WCAG/sRGB.
        ((channel + 0.055) / 1.055).powf(2.4)
    }
}

#[cfg(test)]
mod tests {
    use std::{ops::Range, path::PathBuf, slice};

    use egui::{Color32, TextFormat, text::LayoutJob};
    use processor::search::filter::{self, SearchFilter};
    use regex::Regex;
    use stypes::{FileFormat, FilterMatch, ObserveOrigin};
    use uuid::Uuid;

    use crate::{
        host::{
            common::parsers::ParserNames,
            ui::registry::filters::{FilterDefinition, FilterRegistry},
        },
        session::{
            types::ObserveOperation,
            ui::shared::{SessionInfo, SessionShared},
        },
    };

    use super::{
        FILTER_MATCH_HIGHLIGHT_BG, FilterIndex, NESTED_MATCH_HIGHLIGHT_BG, apply_nested_highlight,
        build_styled_layout_job, cell_highlight_spans, cell_match_spans, matched_filter_indices,
        readable_text_color,
    };
    use crate::session::ui::common::ansi_text::{AnsiSpan, AnsiStyle, parse_ansi_text};
    use crate::session::ui::definitions::schema::LogSchemaSpec;

    fn new_shared() -> SessionShared {
        let session_id = Uuid::new_v4();
        let origin = ObserveOrigin::File(
            "source".to_owned(),
            FileFormat::Text,
            PathBuf::from("source.log"),
        );
        let observe_op = ObserveOperation::new(Uuid::new_v4(), origin);
        let session_info = SessionInfo {
            id: session_id,
            title: "test".to_owned(),
            parser: ParserNames::Text,
            raw_export_supported: false,
        };

        SessionShared::new(session_info, observe_op, LogSchemaSpec::Text)
    }

    fn apply_filter(
        shared: &mut SessionShared,
        registry: &mut FilterRegistry,
        filter: SearchFilter,
    ) -> Uuid {
        let filter_def = FilterDefinition::new(filter);
        let filter_id = filter_def.id;
        registry.add_filter(filter_def);
        shared.filters.apply_filter(registry, filter_id);
        filter_id
    }

    fn append_row_match(shared: &mut SessionShared, row_nr: u64, filters: Vec<u8>) {
        shared.search.set_search_operation(Uuid::new_v4());
        shared.search.append_matches(vec![FilterMatch {
            index: row_nr,
            filters,
        }]);
    }

    fn compile_regexes(filters: impl IntoIterator<Item = SearchFilter>) -> Vec<Regex> {
        filters
            .into_iter()
            .map(|filter| Regex::new(&filter::as_regex(&filter)).unwrap())
            .collect()
    }

    fn apply_nested_filter(shared: &mut SessionShared, filter: SearchFilter) {
        assert!(
            shared
                .search
                .nested_mut()
                .apply_filter(filter.clone())
                .is_eligible()
        );
        let matcher = Regex::new(&filter::as_regex(&filter)).unwrap();
        shared.search.nested_mut().set_matcher(Box::new(matcher));
    }

    fn matched_cell_spans(
        content: &str,
        main_log_pos: u64,
        shared: &SessionShared,
        compiled_filters: &[Regex],
    ) -> Vec<Range<usize>> {
        cell_highlight_spans(content, main_log_pos, shared, compiled_filters).0
    }

    fn nested_cell_spans(
        content: &str,
        main_log_pos: u64,
        shared: &SessionShared,
    ) -> Vec<Range<usize>> {
        cell_highlight_spans(
            content,
            main_log_pos,
            shared,
            shared.search.compiled_filters(),
        )
        .1
    }

    fn nested_layout(
        content: &str,
        ansi_spans: &[AnsiSpan],
        primary_spans: &[Range<usize>],
        nested_spans: &[Range<usize>],
    ) -> LayoutJob {
        let mut job =
            build_styled_layout_job(content, ansi_spans, primary_spans, TextFormat::default());
        apply_nested_highlight(&mut job, nested_spans);
        job
    }

    fn format_at(job: &LayoutJob, offset: usize) -> &TextFormat {
        &job.sections
            .iter()
            .find(|section| section.byte_range.contains(&offset))
            .expect("offset should be covered")
            .format
    }

    #[test]
    fn plain_text_filter_highlights_literal() {
        let compiled = compile_regexes([SearchFilter::plain("cpu=(1.0)")]);

        let spans = cell_match_spans("cpu=(1.0) status", &[FilterIndex(0)], &compiled);

        assert_eq!(spans, vec![0..9]);
    }

    #[test]
    fn regex_filter_highlights_match() {
        let compiled = compile_regexes([SearchFilter::plain("cpu=\\d+").regex(true)]);

        let spans = cell_match_spans("cpu=42 status", &[FilterIndex(0)], &compiled);

        assert_eq!(spans, vec![0..6]);
    }

    #[test]
    fn ignore_case_matches_mixed_case() {
        let compiled = compile_regexes([SearchFilter::plain("warning").ignore_case(true)]);

        let spans = cell_match_spans("pre WARNING post", &[FilterIndex(0)], &compiled);

        assert_eq!(spans, vec![4..11]);
    }

    #[test]
    fn word_boundary_skips_embedded_text() {
        let compiled = compile_regexes([SearchFilter::plain("warn").word(true)]);

        let spans = cell_match_spans("prewarn warn warned", &[FilterIndex(0)], &compiled);

        assert_eq!(spans, vec![8..12]);
    }

    #[test]
    fn all_matches_in_cell() {
        let compiled = compile_regexes([SearchFilter::plain("err")]);

        let spans = cell_match_spans("err and err", &[FilterIndex(0)], &compiled);

        assert_eq!(spans, vec![0..3, 8..11]);
    }

    #[test]
    fn overlapping_matches_are_merged() {
        let compiled = compile_regexes([SearchFilter::plain("foo"), SearchFilter::plain("oob")]);

        let spans = cell_match_spans("foobar", &[FilterIndex(0), FilterIndex(1)], &compiled);

        assert_eq!(spans, vec![0..4]);
    }

    #[test]
    fn stale_filter_index_is_ignored() {
        let compiled = compile_regexes([SearchFilter::plain("warn")]);

        let spans = cell_match_spans("warn", &[FilterIndex(1)], &compiled);

        assert!(spans.is_empty());
    }

    #[test]
    fn bookmarked_row_has_no_cell_highlight() {
        let mut shared = new_shared();
        shared.logs.bookmarked_rows.insert(7);
        let compiled = compile_regexes([SearchFilter::plain("warn")]);

        assert!(matched_filter_indices(&shared, 7).is_none());
        assert!(matched_cell_spans("warn", 7, &shared, &compiled).is_empty());
    }

    #[test]
    fn indexed_row_uses_main_log_pos() {
        let mut shared = new_shared();
        let compiled = compile_regexes([SearchFilter::plain("warn")]);

        append_row_match(&mut shared, 42, vec![0]);

        let spans = matched_cell_spans("warn row", 42, &shared, &compiled);

        assert_eq!(spans, vec![0..4]);
        assert!(matched_cell_spans("warn row", 3, &shared, &compiled).is_empty());
    }

    #[test]
    fn filter_matches_visible_ansi_text() {
        let mut shared = new_shared();
        let compiled = compile_regexes([SearchFilter::plain("warn")]);
        append_row_match(&mut shared, 42, vec![0]);

        let visible = parse_ansi_text("w\x1b[31marn").text;
        let spans = matched_cell_spans(&visible, 42, &shared, &compiled);

        assert_eq!(visible, "warn");
        assert_eq!(spans, vec![0..4]);
    }

    #[test]
    fn nested_matches_visible_ansi_text() {
        let mut shared = new_shared();
        append_row_match(&mut shared, 42, vec![0]);
        apply_nested_filter(&mut shared, SearchFilter::plain("warn"));
        let ansi_text = parse_ansi_text("w\x1b[31marn");

        assert_eq!(ansi_text.text, "warn");
        assert_eq!(nested_cell_spans(&ansi_text.text, 42, &shared), vec![0..4]);
    }

    #[test]
    fn nested_plain_text_finds_all_visible_ranges() {
        let mut shared = new_shared();
        append_row_match(&mut shared, 42, vec![0]);
        apply_nested_filter(&mut shared, SearchFilter::plain("warn"));

        assert_eq!(
            nested_cell_spans("warn then warn", 42, &shared),
            vec![0..4, 10..14]
        );
    }

    #[test]
    fn nested_plain_text_treats_regex_syntax_literally() {
        let mut shared = new_shared();
        append_row_match(&mut shared, 42, vec![0]);
        apply_nested_filter(&mut shared, SearchFilter::plain("cpu=(1.0)"));

        assert_eq!(
            nested_cell_spans("cpu=(1.0) cpu=110", 42, &shared),
            vec![0..9]
        );
    }

    #[test]
    fn nested_case_flag_controls_visible_matches() {
        let mut shared = new_shared();
        append_row_match(&mut shared, 42, vec![0]);
        apply_nested_filter(&mut shared, SearchFilter::plain("warn"));
        assert_eq!(nested_cell_spans("WARN warn", 42, &shared), vec![5..9]);

        apply_nested_filter(&mut shared, SearchFilter::plain("warn").ignore_case(true));
        assert_eq!(
            nested_cell_spans("WARN warn", 42, &shared),
            vec![0..4, 5..9]
        );
    }

    #[test]
    fn nested_word_flag_skips_embedded_text() {
        let mut shared = new_shared();
        append_row_match(&mut shared, 42, vec![0]);
        apply_nested_filter(&mut shared, SearchFilter::plain("warn").word(true));

        assert_eq!(
            nested_cell_spans("prewarn warn warned", 42, &shared),
            vec![8..12]
        );
    }

    #[test]
    fn nested_regex_finds_multiple_ranges() {
        let mut shared = new_shared();
        append_row_match(&mut shared, 42, vec![0]);
        apply_nested_filter(&mut shared, SearchFilter::plain(r"cpu=\d+").regex(true));

        assert_eq!(
            nested_cell_spans("cpu=4 cpu=27", 42, &shared),
            vec![0..5, 6..12]
        );
    }

    #[test]
    fn nested_zero_width_matches_do_not_create_highlights() {
        let mut shared = new_shared();
        append_row_match(&mut shared, 42, vec![0]);
        apply_nested_filter(&mut shared, SearchFilter::plain("$").regex(true));

        let spans = nested_cell_spans("warn", 42, &shared);
        assert!(spans.is_empty());
        let job = nested_layout("warn", &[], &[], &spans);
        assert!(
            job.sections
                .iter()
                .all(|section| section.format.background != NESTED_MATCH_HIGHLIGHT_BG)
        );
    }

    #[test]
    fn adjacent_nested_ranges_are_normalized() {
        let mut shared = new_shared();
        append_row_match(&mut shared, 42, vec![0]);
        apply_nested_filter(&mut shared, SearchFilter::plain("a"));

        assert_eq!(nested_cell_spans("aa", 42, &shared), vec![0..2]);
    }

    #[test]
    fn primary_result_is_nested_highlight_eligible_by_session_position() {
        let mut shared = new_shared();
        append_row_match(&mut shared, 42, vec![0]);
        apply_nested_filter(&mut shared, SearchFilter::plain("warn"));

        assert_eq!(nested_cell_spans("warn", 42, &shared), vec![0..4]);
        assert!(nested_cell_spans("warn", 3, &shared).is_empty());
    }

    #[test]
    fn bookmarked_primary_result_remains_nested_highlight_eligible() {
        let mut shared = new_shared();
        shared.logs.bookmarked_rows.insert(42);
        append_row_match(&mut shared, 42, vec![0]);
        apply_nested_filter(&mut shared, SearchFilter::plain("warn"));

        assert_eq!(nested_cell_spans("warn", 42, &shared), vec![0..4]);
    }

    #[test]
    fn bookmark_only_row_is_not_nested_highlight_eligible() {
        let mut shared = new_shared();
        shared.logs.bookmarked_rows.insert(7);
        apply_nested_filter(&mut shared, SearchFilter::plain("warn"));

        assert!(nested_cell_spans("warn", 7, &shared).is_empty());
    }

    #[test]
    fn disjoint_primary_and_nested_backgrounds_remain_distinct() {
        let job = nested_layout(
            "primary nested",
            &[],
            slice::from_ref(&(0..7)),
            slice::from_ref(&(8..14)),
        );

        assert_eq!(format_at(&job, 1).background, FILTER_MATCH_HIGHLIGHT_BG);
        assert_eq!(format_at(&job, 9).background, NESTED_MATCH_HIGHLIGHT_BG);
    }

    #[test]
    fn nested_background_wins_only_on_primary_overlap() {
        let job = nested_layout(
            "abcdef",
            &[],
            slice::from_ref(&(0..6)),
            slice::from_ref(&(2..4)),
        );

        assert_eq!(format_at(&job, 1).background, FILTER_MATCH_HIGHLIGHT_BG);
        assert_eq!(format_at(&job, 2).background, NESTED_MATCH_HIGHLIGHT_BG);
        assert_eq!(format_at(&job, 5).background, FILTER_MATCH_HIGHLIGHT_BG);
    }

    #[test]
    fn nested_background_preserves_ansi_foreground_and_outside_background() {
        let foreground = Color32::from_rgb(200, 10, 10);
        let background = Color32::from_rgb(10, 10, 200);
        let ansi_spans = vec![AnsiSpan {
            range: 0..6,
            style: AnsiStyle {
                fg: Some(foreground),
                bg: Some(background),
            },
        }];
        let job = nested_layout("abcdef", &ansi_spans, &[], slice::from_ref(&(2..4)));

        assert_eq!(format_at(&job, 1).background, background);
        assert_eq!(format_at(&job, 2).background, NESTED_MATCH_HIGHLIGHT_BG);
        assert_eq!(format_at(&job, 5).background, background);
        assert!(
            [1, 2, 5]
                .into_iter()
                .all(|offset| format_at(&job, offset).color == foreground)
        );
    }

    #[test]
    fn nested_layout_preserves_text_and_complete_byte_coverage() {
        let content = "pré match suffix";
        let nested = Regex::new("match").unwrap().find(content).unwrap().range();
        let job = nested_layout(
            content,
            &[],
            slice::from_ref(&(0..10)),
            slice::from_ref(&nested),
        );

        assert_eq!(job.text, content);
        assert_eq!(job.sections.first().unwrap().byte_range.start, 0);
        assert_eq!(job.sections.last().unwrap().byte_range.end, content.len());
        assert!(
            job.sections
                .windows(2)
                .all(|pair| pair[0].byte_range.end == pair[1].byte_range.start)
        );
        let reconstructed: String = job
            .sections
            .iter()
            .map(|section| &job.text[section.byte_range.clone()])
            .collect();
        assert_eq!(reconstructed, content);
    }

    #[test]
    fn readable_text_color_keeps_sufficient_contrast() {
        let base = Color32::WHITE;

        assert_eq!(readable_text_color(Color32::BLACK, base), base);
    }

    #[test]
    fn readable_text_color_picks_black_for_light_background() {
        assert_eq!(
            readable_text_color(Color32::from_rgb(255, 255, 0), Color32::WHITE),
            Color32::BLACK
        );
    }

    #[test]
    fn readable_text_color_picks_white_for_dark_background() {
        assert_eq!(
            readable_text_color(Color32::from_rgb(0, 0, 128), Color32::BLACK),
            Color32::WHITE
        );
    }

    #[test]
    fn active_filters_follow_backend_order() {
        let mut shared = new_shared();
        let mut registry = FilterRegistry::default();

        let first_id = apply_filter(&mut shared, &mut registry, SearchFilter::plain("first"));
        let second_id = apply_filter(&mut shared, &mut registry, SearchFilter::plain("second"));
        shared
            .filters
            .set_temp_search(SearchFilter::plain("temp").ignore_case(true));
        let filters = shared.search.get_active_filters(&shared.filters, &registry);
        shared.search.refresh_compiled_filters(&filters);

        append_row_match(&mut shared, 12, vec![0, 2]);

        let spans = matched_cell_spans(
            "first temp second",
            12,
            &shared,
            shared.search.compiled_filters(),
        );

        assert_eq!(shared.filters.filter_entries[0].id, first_id);
        assert_eq!(shared.filters.filter_entries[1].id, second_id);
        assert_eq!(spans, vec![0..5, 6..10]);
    }
}
