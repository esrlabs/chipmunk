//! Provides shared helper functions and utilities to be used
//! with logs tables (both logs and search tables).

use std::ops::{Not, Range};

use egui::{
    Align, Color32, CursorIcon, Frame, Layout, Margin, Sense, Shape, Stroke, TextStyle, Ui, vec2,
};
use egui_table::Column;
use regex::Regex;
use uuid::Uuid;

use crate::{
    host::{
        common::colors::{SELECTED_LOG_COLORS, TEMP_SEARCH_COLORS},
        notification::AppNotification,
        ui::UiActions,
    },
    session::{
        error::SessionError,
        ui::{
            definitions::schema::LogSchema,
            shared::{
                ObserveState, SessionShared,
                searching::{FilterIndex, LogMainIndex},
            },
        },
    },
};

/// Constants needed when sending grab logs commands.
pub mod grab_cmd_consts {
    use std::time::Duration;

    pub const TIMEOUT_DURATION: Duration = Duration::from_millis(50);
    pub const SEND_INTERVAL: Duration = Duration::from_millis(5);
    pub const SEND_RETRY_MAX_COUNT: u8 = 10;
}

pub const ROW_HEADER_SOURCE_COLOR_WIDTH: f32 = 5.0;
pub const ROW_HEADER_BOOKMARK_WIDTH: f32 = 8.0;

// This overlay is only painted for rows the backend already marked as matched,
// so it sits on top of the row-level match tint instead of the plain table background.
// A single translucent white highlight stays visible in both themes on that base.
const FILTER_MATCH_HIGHLIGHT_BG: Color32 = Color32::from_rgba_unmultiplied_const(255, 255, 255, 60);

/// Creates the columns for logs table based on the provided `schema`,
/// inserting the row header column into them.
pub fn create_table_columns(schema: &dyn LogSchema) -> Box<[Column]> {
    let mut columns = Vec::with_capacity(schema.columns().len() + 1);
    let row_header_col = Column::new(100.0).range(50.0..=500.0).resizable(true);

    columns.push(row_header_col);
    columns.extend(schema.columns().iter().map(|col| col.column));

    columns.into_boxed_slice()
}

/// Draw border line on the top of a log cell indicating that its
/// source is different from the log above it.
pub fn render_upper_bound(ui: &mut Ui) {
    let rect = ui.max_rect();
    // Draw dashed line at the top of the cell
    ui.painter().add(Shape::dashed_line(
        &[
            egui::Pos2::new(rect.min.x, rect.top() + 1.0),
            egui::Pos2::new(rect.max.x, rect.top() + 1.0),
        ],
        Stroke::new(
            0.5,
            ui.style().visuals.widgets.noninteractive.fg_stroke.color,
        ),
        4.0,
        2.0,
    ));
}

/// Render the row header for log tables.
///
/// The header contains three parts:
/// - an optional left-side source-color strip for multi-source sessions,
/// - the row text,
/// - a right-side bookmark affordance that owns its own hover/click behavior.
///
/// `on_toggle_bookmark` is invoked only when the bookmark area is clicked.
pub fn render_row_header(
    ui: &mut Ui,
    text: String,
    color_idx: Option<usize>,
    is_bookmarked: bool,
    on_toggle_bookmark: impl FnOnce(),
) {
    ui.horizontal(|ui| {
        let (res, painter) = ui.allocate_painter(
            vec2(ROW_HEADER_SOURCE_COLOR_WIDTH, ui.available_height()),
            Sense::hover(),
        );

        if let Some(color_idx) = color_idx {
            let color = ObserveState::source_color(color_idx);
            painter.rect_filled(res.rect, 0.0, color);
        }

        ui.label(text);

        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
            ui.add_space(3.0);
            let (mut bookmark_res, painter) = ui.allocate_painter(
                vec2(ROW_HEADER_BOOKMARK_WIDTH, ui.available_height()),
                Sense::click(),
            );
            if bookmark_res.hovered() {
                ui.ctx().set_cursor_icon(CursorIcon::PointingHand);
            }

            let fill = if is_bookmarked {
                ui.visuals().selection.bg_fill
            } else if bookmark_res.hovered() {
                ui.visuals().widgets.hovered.bg_fill
            } else {
                Color32::TRANSPARENT
            };
            painter.rect_filled(bookmark_res.rect, 0.0, fill);

            bookmark_res = bookmark_res.on_hover_ui(|ui| {
                ui.set_max_width(ui.spacing().tooltip_width);

                let text = if is_bookmarked {
                    "Remove line bookmark"
                } else {
                    "Add line bookmark"
                };
                ui.label(text);
            });

            if bookmark_res.clicked() {
                on_toggle_bookmark();
            }
        });
    });
}

/// Frame for table content cells.
pub fn get_cell_frame() -> Frame {
    Frame::NONE.inner_margin(Margin::symmetric(4, 0))
}

/// Returns the backend-reported filter indices for one main-log position, if that row matched.
fn matched_filter_indices(shared: &SessionShared, main_log_pos: u64) -> Option<&[FilterIndex]> {
    shared
        .search
        .current_matches_map()
        .and_then(|map| map.get(&LogMainIndex(main_log_pos)))
        .map(Vec::as_slice)
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

/// Resolves the merged highlight spans for one visible cell using the original main-log position.
fn matched_cell_spans(
    content: &str,
    main_log_pos: u64,
    shared: &SessionShared,
    compiled_filters: &[Regex],
) -> Vec<Range<usize>> {
    matched_filter_indices(shared, main_log_pos)
        .map(|matched_filters| cell_match_spans(content, matched_filters, compiled_filters))
        .unwrap_or_default()
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

/// Builds highlighted text only when this cell's main-log position has concrete matches to paint.
pub fn highlighted_cell_layout_job(
    ui: &Ui,
    content: &str,
    main_log_pos: u64,
    shared: &SessionShared,
    compiled_filters: &[Regex],
) -> Option<egui::text::LayoutJob> {
    let spans = matched_cell_spans(content, main_log_pos, shared, compiled_filters);

    spans
        .is_empty()
        .not()
        .then(|| build_highlighted_layout_job(ui, content, &spans))
}

/// Preserves the row-selected text color and adds only background highlight on matched spans.
fn build_highlighted_layout_job(
    ui: &Ui,
    content: &str,
    spans: &[Range<usize>],
) -> egui::text::LayoutJob {
    let mut job = egui::text::LayoutJob::default();
    let base_format = egui::text::TextFormat {
        font_id: TextStyle::Body.resolve(ui.style()),
        color: ui
            .style()
            .visuals
            .override_text_color
            .unwrap_or_else(|| ui.visuals().text_color()),
        ..Default::default()
    };
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

/// Apply row background and foreground colors for logs/search tables.
pub fn apply_log_row_colors(
    ui: &mut Ui,
    shared: &SessionShared,
    main_log_pos: Option<u64>,
    is_selected: bool,
) {
    // Selected wins over filters/bookmarks. Search/filter colors win over bookmark fallback.
    let row_colors = if is_selected {
        Some(&SELECTED_LOG_COLORS)
    } else if let Some(pos) = main_log_pos {
        shared
            .search
            .current_matches_map()
            .and_then(|map| map.get(&LogMainIndex(pos)))
            .and_then(|matches| matches.first())
            .and_then(|filter_idx| {
                let idx = filter_idx.0 as usize;
                if let Some(filter_id) = shared.filters.enabled_filter_ids().nth(idx) {
                    shared
                        .filters
                        .filter_entries
                        .iter()
                        .find(|item| item.id == *filter_id)
                        .map(|item| &item.colors)
                } else {
                    // This is the temporary unregistered search.
                    Some(&TEMP_SEARCH_COLORS)
                }
            })
            .or_else(|| {
                shared
                    .logs
                    .is_bookmarked(pos)
                    .then_some(&TEMP_SEARCH_COLORS)
            })
    } else {
        None
    };

    if let Some(colors) = row_colors {
        ui.painter().rect_filled(ui.max_rect(), 0.0, colors.bg);
        ui.style_mut().visuals.override_text_color = Some(colors.fg);
    } else {
        ui.style_mut().visuals.override_text_color = None;
    }
}

pub fn handle_grab_errors(error: SessionError, session_id: Uuid, actions: &mut UiActions) {
    log::error!("Session Error: Session ID: {session_id}, error: {error}");

    let notifi = AppNotification::SessionError { session_id, error };

    actions.add_notification(notifi);
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

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

    use super::{FilterIndex, cell_match_spans, matched_cell_spans, matched_filter_indices};

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
        };

        SessionShared::new(session_info, observe_op)
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
        shared.logs.insert_bookmark(7);
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
