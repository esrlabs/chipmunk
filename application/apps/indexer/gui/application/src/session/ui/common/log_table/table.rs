//! Shared table and row helpers for log-like tables.
//!
//! This module owns table columns, row headers, selection clicks, row coloring,
//! and shared backend-grab constants used by both the main log table and the
//! search-result table.

use egui::{
    Align, Color32, CursorIcon, Frame, Layout, Margin, Response, Sense, Shape, Stroke, Ui, vec2,
};
use egui_table::{Column, TableState};
use stypes::ObserveOrigin;
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::{
    host::{
        common::colors::{DEFAULT_ATTACHMENT_EXT_COLOR, SELECTED_LOG_COLORS, TEMP_SEARCH_COLORS},
        notification::AppNotification,
        ui::UiActions,
    },
    session::{
        command::SessionCommand,
        error::SessionError,
        ui::{
            definitions::schema::LogSchema,
            logs_table::LogAttachmentInfo,
            shared::{ObserveState, SelectionIntent, SessionShared, searching::LogMainIndex},
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

const ROW_HEADER_SOURCE_COLOR_WIDTH: f32 = 5.0;
const ROW_HEADER_BOOKMARK_WIDTH: f32 = 8.0;
const COLUMN_WIDTH_EPSILON: f32 = 0.25;

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
    attachment_info: LogAttachmentInfo,
) -> Response {
    ui.horizontal(|ui| {
        let (res, painter) = ui.allocate_painter(
            vec2(ROW_HEADER_SOURCE_COLOR_WIDTH, ui.available_height()),
            Sense::click(),
        );

        if let Some(color_idx) = color_idx {
            let color = ObserveState::source_color(color_idx);
            painter.rect_filled(res.rect, 0.0, color);
        }
        let text_res = ui.monospace(text);

        if let LogAttachmentInfo::WithAttachment { color } = attachment_info {
            ui.colored_label(
                color.unwrap_or(DEFAULT_ATTACHMENT_EXT_COLOR),
                egui::RichText::new(egui_phosphor::fill::FILE),
            );
            ui.add_space(ui.spacing().item_spacing.x);
        }

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

        res.union(text_res)
    })
    .inner
}

/// Frame for table content cells.
pub fn get_cell_frame() -> Frame {
    Frame::NONE.inner_margin(Margin::symmetric(4, 0))
}

pub fn apply_selection_click(
    shared: &mut SessionShared,
    actions: &mut UiActions,
    cmd_tx: &Sender<SessionCommand>,
    row: u64,
    modifiers: egui::Modifiers,
) -> Option<u64> {
    let selection_intent = selection_intent(modifiers);
    let change = shared.logs.select_from_click(row, selection_intent);

    if let Some(details_row) = change.details_row {
        actions.try_send_command(cmd_tx, SessionCommand::GetSelectedLog(details_row));
    }

    change.jump_to_row
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

    use super::selection_intent;
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
}
