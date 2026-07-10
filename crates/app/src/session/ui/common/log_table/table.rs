//! Shared table and row helpers for log-like tables.
//!
//! This module owns table columns, row headers, selection clicks, row coloring,
//! and shared backend-grab constants used by both the main log table and the
//! search-result table.

use std::ops::{Range, RangeInclusive};

use egui::{
    Align, Color32, CursorIcon, Frame, Label, Layout, Margin, Rect, Response, RichText, Sense,
    Shape, Stroke, TextStyle, Ui, Widget as _,
    text::{LayoutJob, TextFormat},
    vec2,
};
use egui_table::{Column, TableState};
use stypes::ObserveOrigin;
use uuid::Uuid;

use crate::{
    host::{
        common::colors::{
            DEFAULT_ATTACHMENT_EXT_COLOR, SELECTED_LOG_COLORS, TEMP_SEARCH_COLORS,
            active_log_table_indicator,
        },
        notification::AppNotification,
        ui::UiActions,
    },
    session::{
        error::SessionError,
        ui::{
            definitions::schema::LogSchema,
            logs_table::LogAttachmentInfo,
            shared::{
                ObserveState, SelectionChange, SelectionIntent, SessionShared, UiViewState,
                searching::LogMainIndex,
            },
        },
    },
};

use super::LogTableKind;

/// Constants needed when sending grab logs commands.
pub mod grab_cmd_consts {
    use std::time::Duration;

    pub const TIMEOUT_DURATION: Duration = Duration::from_millis(50);
    pub const SEND_INTERVAL: Duration = Duration::from_millis(5);
    pub const SEND_RETRY_MAX_COUNT: u8 = 10;
}

const ROW_HEADER_SOURCE_COLOR_WIDTH: f32 = 5.0;
const ROW_HEADER_BOOKMARK_WIDTH: f32 = 8.0;
const COLUMN_WIDTH_EPSILON: f32 = 0.25;

const BOOKMARK_EXTRA_SPACING: f32 = 3.0;

/// Vertical scroll command for log-like tables.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TableScroll {
    /// Scroll up by roughly one visible page.
    PageUp,
    /// Scroll down by roughly one visible page.
    PageDown,
    /// Scroll to the first row.
    Top,
    /// Scroll to the last row.
    Bottom,
}

/// Renders the shared context-menu command for clearing log selection.
pub fn render_unselect_action(shared: &mut SessionShared, ui: &mut Ui) {
    let selected_count = shared.logs.selected_count();
    let label = if selected_count == 0 {
        String::from("Unselect All")
    } else {
        format!("Unselect {selected_count} row(s)")
    };

    if ui
        .add_enabled(selected_count > 0, egui::Button::new(label))
        .clicked()
    {
        shared.logs.clear_selection();
        ui.close();
    }

    ui.separator();
}

/// Returns the row range to bring into view for a table scroll action.
pub fn scroll_target(
    action: TableScroll,
    last_visible_rows: Option<&Range<u64>>,
    row_count: u64,
) -> Option<RangeInclusive<u64>> {
    if row_count == 0 {
        return None;
    }

    let last_row = row_count - 1;
    match action {
        TableScroll::Top => Some(0..=0),
        TableScroll::Bottom => Some(last_row..=last_row),
        TableScroll::PageUp => {
            let visible_rows = last_visible_rows?;
            let page_size = visible_rows.end.saturating_sub(visible_rows.start);
            if page_size == 0 {
                return None;
            }

            // Page-up targets a single row. A full-page range near row 0 can already be
            // partially visible, causing `scroll_to_rows(..., None)` to stop before top.
            let row = visible_rows.start.saturating_sub(page_size).min(last_row);
            Some(row..=row)
        }
        TableScroll::PageDown => {
            let visible_rows = last_visible_rows?;
            let page_size = visible_rows.end.saturating_sub(visible_rows.start);
            if page_size == 0 {
                return None;
            }

            let first_row = visible_rows.start.saturating_add(page_size).min(last_row);
            let final_row = first_row.saturating_add(page_size - 1).min(last_row);
            Some(first_row..=final_row)
        }
    }
}

/// Creates the columns for logs table based on the provided `schema`,
/// inserting the row header column into them.
pub fn create_table_columns(schema: &dyn LogSchema) -> Vec<Column> {
    let mut columns = Vec::with_capacity(schema.columns().len() + 1);
    let row_header_col = Column::new(100.0).range(50.0..=500.0).resizable(true);

    columns.push(row_header_col);
    columns.extend(schema.columns().iter().map(|col| col.column));

    columns
}

/// Applies shared application column widths to an existing egui table state.
///
/// If the table has not rendered yet, the passed columns are enough for the first frame.
pub fn apply_columns_to_table_state(ui: &Ui, table_id_salt: &str, columns: &[Column]) {
    let table_id = TableState::id(ui, egui::Id::new(table_id_salt));
    let Some(mut state) = TableState::load(ui.ctx(), table_id) else {
        return;
    };

    let mut changed = false;
    for (col_idx, column) in columns.iter().enumerate() {
        let width = column.range.clamp(column.current);
        let column_id = column.id_for(col_idx);
        let should_update = state
            .col_widths
            .get(&column_id)
            .is_none_or(|current| (current - width).abs() > COLUMN_WIDTH_EPSILON);

        if should_update {
            state.col_widths.insert(column_id, width);
            changed = true;
        }
    }

    if changed {
        state.store(ui.ctx(), table_id);
    }
}

/// Copies persisted egui table widths back into the shared application columns.
pub fn sync_column_widths(ui: &Ui, table_id_salt: &str, columns: &mut [Column]) {
    let table_id = TableState::id(ui, egui::Id::new(table_id_salt));
    let Some(state) = TableState::load(ui.ctx(), table_id) else {
        return;
    };

    for (col_idx, column) in columns.iter_mut().enumerate() {
        let Some(width) = state.col_widths.get(&column.id_for(col_idx)).copied() else {
            continue;
        };

        column.current = column.range.clamp(width);
    }
}

/// Returns table columns with the last column widened to fill the available table width.
///
/// The adjustment is applied once per available width and then persisted through
/// `egui_table::TableState`, so normal table state handles later frames.
pub fn columns_filling_last(ui: &Ui, table_id_salt: &str, columns: &[Column]) -> Vec<Column> {
    let available_width = ui.available_width();
    // Put the final resize handle beyond the table container edge so its
    // expanded interaction rect does not steal surrounding splitter drags.
    let fill_width = available_width + 2.0 * ui.style().interaction.resize_grab_radius_side;
    let table_id = TableState::id(ui, egui::Id::new(table_id_salt));
    // egui_table updates TableState::parent_width on every show, even before this
    // adjustment is applied. Track the widths we already filled separately.
    let filled_width_id = table_id.with("last_column_filled_width");

    if ui
        .ctx()
        .data_mut(|data| data.get_temp::<f32>(filled_width_id))
        == Some(available_width)
    {
        return columns.to_vec();
    }

    let mut columns = columns.to_vec();
    let Some(last_col_idx) = columns.len().checked_sub(1) else {
        return columns;
    };

    let state = TableState::load(ui.ctx(), table_id);
    let used_width = columns[..last_col_idx]
        .iter()
        .enumerate()
        .map(|(col_idx, column)| {
            let column_id = column.id_for(col_idx);
            let current = state
                .as_ref()
                .and_then(|state| state.col_widths.get(&column_id).copied())
                .unwrap_or(column.current);

            column.range.clamp(current)
        })
        .sum::<f32>();

    let min_last_width = (fill_width - used_width).max(0.0);
    let last_column = &mut columns[last_col_idx];
    last_column.range.min = last_column.range.min.max(min_last_width);
    last_column.range.max = last_column.range.max.max(last_column.range.min);

    if let Some(mut state) = state {
        // The last column may not be visible, so egui_table might not persist its
        // computed width this frame. Store it explicitly before marking it filled.
        let column_id = last_column.id_for(last_col_idx);
        let current = state
            .col_widths
            .get(&column_id)
            .copied()
            .unwrap_or(last_column.current);
        state.col_widths.insert(
            column_id,
            last_column.range.clamp(current.max(min_last_width)),
        );
        state.store(ui.ctx(), table_id);
        ui.ctx()
            .data_mut(|data| data.insert_temp(filled_width_id, available_width));
    }

    columns
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
            0.5_f32,
            ui.style().visuals.widgets.noninteractive.fg_stroke.color,
        ),
        4.0,
        2.0,
    ));
}

/// Result of rendering a log table row header.
pub struct RowHeaderResponse {
    /// Combined response for row-header selection behavior.
    pub response: Response,
    /// Whether the attachment icon was clicked.
    pub attachment_clicked: bool,
    /// Whether the bookmark affordance was clicked.
    pub bookmark_clicked: bool,
}

/// Calculates the minimum width for the first log-table column.
///
/// Keep this in sync with [`render_row_header`].
pub fn row_header_column_width(ui: &Ui, largest_row_nr: u64) -> f32 {
    let font_id = TextStyle::Monospace.resolve(ui.style());
    let row_number_width = ui
        .painter()
        .layout_no_wrap(largest_row_nr.to_string(), font_id, Color32::TRANSPARENT)
        .size()
        .x;
    let bookmark_width = BOOKMARK_EXTRA_SPACING + ROW_HEADER_BOOKMARK_WIDTH;

    let spacing = ui.spacing().item_spacing.x;
    // This is a baseline width for row numbers; optional row affordances can still
    // use egui_table's normal growth because the column is not locked.
    row_number_width + spacing + bookmark_width + spacing
}

/// Render the row header for log tables.
///
/// The header contains:
/// - an optional left-side source-color strip for multi-source sessions,
/// - the row text,
/// - an optional attachment affordance,
/// - a right-side bookmark affordance that owns its own hover/click behavior.
///
pub fn render_row_header(
    ui: &mut Ui,
    row_number: u64,
    row_number_digits: usize,
    source_color_idx: Option<usize>,
    is_bookmarked: bool,
    attachment_info: LogAttachmentInfo,
) -> RowHeaderResponse {
    let mut attachment_clicked = false;
    let mut bookmark_clicked = false;
    let response = ui
        .horizontal(|ui| {
            // Data Source Color.
            let (res, painter) = ui.allocate_painter(
                vec2(ROW_HEADER_SOURCE_COLOR_WIDTH, ui.available_height()),
                Sense::click(),
            );

            if let Some(color_idx) = source_color_idx {
                let color = ObserveState::source_color(color_idx);
                painter.rect_filled(res.rect, 0.0, color);
            }

            // Header text
            let text_res = render_row_number(ui, row_number, row_number_digits);

            // Attachments
            if let LogAttachmentInfo::WithAttachment { color } = attachment_info {
                let icon = Label::new(
                    RichText::new(egui_phosphor::fill::FILE)
                        .color(color.unwrap_or(DEFAULT_ATTACHMENT_EXT_COLOR)),
                )
                .selectable(false)
                .sense(Sense::click());
                let icon_response = icon.ui(ui).on_hover_cursor(CursorIcon::PointingHand);
                attachment_clicked = icon_response.clicked();
                ui.add_space(ui.spacing().item_spacing.x);
            }

            // Bookmarks
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                ui.add_space(BOOKMARK_EXTRA_SPACING);
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

                bookmark_clicked = bookmark_res.clicked();
            });

            res.union(text_res)
        })
        .inner;

    RowHeaderResponse {
        response,
        attachment_clicked,
        bookmark_clicked,
    }
}

fn render_row_number(ui: &mut Ui, row_number: u64, row_number_digits: usize) -> Response {
    let row_number = row_number.to_string();
    let leading_zero_count = row_number_digits.saturating_sub(row_number.len());

    let font_id = TextStyle::Monospace.resolve(ui.style());
    let normal_format = TextFormat {
        font_id: font_id.clone(),
        color: ui.visuals().text_color(),
        ..Default::default()
    };
    let weak_format = TextFormat {
        font_id,
        color: ui.visuals().weak_text_color(),
        ..Default::default()
    };

    let mut job = LayoutJob::default();
    if leading_zero_count > 0 {
        let leading_zeros = "0".repeat(leading_zero_count);
        job.append(&leading_zeros, 0.0, weak_format);
    }
    job.append(&row_number, 0.0, normal_format);

    Label::new(job).ui(ui)
}

/// Frame for table content cells.
pub fn get_cell_frame() -> Frame {
    Frame::NONE.inner_margin(Margin::symmetric(4, 0))
}

pub fn apply_selection_click(
    shared: &mut SessionShared,
    row: u64,
    modifiers: egui::Modifiers,
) -> SelectionChange {
    let selection_intent = selection_intent(modifiers);
    shared.logs.select_from_click(row, selection_intent)
}

/// Get selection intent based on modifier pressed while clicking on log item.
fn selection_intent(modifiers: egui::Modifiers) -> SelectionIntent {
    if modifiers.shift {
        SelectionIntent::ExtendRange
    } else if modifiers.command {
        SelectionIntent::ToggleRow
    } else {
        SelectionIntent::Exclusive
    }
}

/// Selects the provided log table as active when the table area is clicked.
///
/// # Arguments
///
/// * `ui` - egi::UI.
/// * `rect` - Table response rectangle used to test click position.
/// * `view` - Session view state that stores the active log table.
/// * `table_kind` - Log-table kind to store when the table is clicked.
pub fn activate_table_on_click(
    ui: &Ui,
    rect: &Rect,
    view: &mut UiViewState,
    table_kind: LogTableKind,
) {
    if ui.input(|input| {
        input.pointer.any_click()
            && input
                .pointer
                .interact_pos()
                .is_some_and(|pos| rect.contains(pos))
    }) {
        view.active_log_table = table_kind;
    }
}

/// Paints a visual indicator on the provided log table if it is currently active.
///
/// # Arguments
///
/// * `ui` - egi::UI.
/// * `rect` - Table response rectangle to draw the indicator against.
/// * `view` - Session view state that stores the active log table.
/// * `table_kind` - Log-table kind to compare with the active table state.
pub fn render_active_table_indicator(
    ui: &Ui,
    rect: &Rect,
    view: &UiViewState,
    table_kind: LogTableKind,
) {
    if view
        .log_table_target(ui.ctx())
        .is_some_and(|target| target == table_kind)
    {
        ui.painter().line_segment(
            [rect.left_top(), rect.left_bottom()],
            active_log_table_indicator(ui.visuals().dark_mode),
        );
    }
}

/// Apply row background and foreground colors for logs/search tables.
pub fn apply_log_row_colors(
    ui: &mut Ui,
    shared: &SessionShared,
    main_log_pos: Option<u64>,
    is_selected: bool,
) {
    // Selected wins. Among matched filters, later filters in effective search order win,
    // matching legacy Chipmunk 3 precedence. Search/filter colors win over bookmark fallback.
    let row_colors = if is_selected {
        Some(&SELECTED_LOG_COLORS)
    } else if let Some(pos) = main_log_pos {
        shared
            .search
            .current_matches_map()
            .and_then(|map| map.get(&LogMainIndex(pos)))
            .and_then(|matches| matches.last())
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

    let notifi = AppNotification::SessionError(error);

    actions.add_notification(notifi);
}

/// Returns whether the visible table should keep following the newest row.
pub fn should_stick_to_bottom(shared: &SessionShared) -> bool {
    shared
        .observe
        .operations()
        .first()
        .is_some_and(|op| match &op.origin {
            ObserveOrigin::File(..) => {
                // Enable stick to bottom for files only when they reach tailing phase
                // after reading the already existed data in that file.
                op.phase().is_running() && shared.observe.is_file_read_completed()
            }
            ObserveOrigin::Concat(..) => false,
            ObserveOrigin::Stream(..) => true,
        })
}

#[cfg(test)]
mod tests {
    use egui::Modifiers;

    use super::{TableScroll, scroll_target, selection_intent};
    use crate::session::ui::shared::SelectionIntent;

    #[test]
    fn plain_modifiers_map_to_exclusive_selection() {
        assert_eq!(
            selection_intent(Modifiers::NONE),
            SelectionIntent::Exclusive
        );
    }

    #[test]
    fn command_modifier_maps_to_toggle_row() {
        assert_eq!(
            selection_intent(Modifiers {
                command: true,
                ..Default::default()
            }),
            SelectionIntent::ToggleRow,
        );
    }

    #[test]
    fn shift_modifier_maps_to_extend_range() {
        assert_eq!(
            selection_intent(Modifiers {
                shift: true,
                ..Default::default()
            }),
            SelectionIntent::ExtendRange,
        );
    }

    #[test]
    fn shift_takes_precedence_over_command() {
        assert_eq!(
            selection_intent(Modifiers {
                command: true,
                shift: true,
                ..Default::default()
            }),
            SelectionIntent::ExtendRange,
        );
    }

    #[test]
    fn page_scroll_uses_visible_page_size() {
        assert_eq!(
            scroll_target(TableScroll::PageDown, Some(&(10..20)), 100),
            Some(20..=29)
        );
        assert_eq!(
            scroll_target(TableScroll::PageUp, Some(&(10..20)), 100),
            Some(0..=0)
        );
    }

    #[test]
    fn edge_scrolls_require_rows() {
        assert_eq!(
            scroll_target(TableScroll::Top, Some(&(10..20)), 100),
            Some(0..=0)
        );
        assert_eq!(
            scroll_target(TableScroll::Bottom, Some(&(10..20)), 100),
            Some(99..=99)
        );
        assert_eq!(scroll_target(TableScroll::Top, None, 0), None);
    }
}
