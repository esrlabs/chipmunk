//! Provides shared helper functions and utilities to be used
//! with logs tables (both logs and search tables).

use egui::{Frame, Margin, Sense, Shape, Stroke, Ui, vec2};
use egui_table::Column;
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
            shared::{ObserveState, SessionShared, searching::LogMainIndex},
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

/// Render the row header cell in log tables, display the text and the source color
/// when `color_idx` is provided.
pub fn render_row_header(ui: &mut Ui, text: String, color_idx: Option<usize>) {
    ui.horizontal(|ui| {
        let (res, painter) = ui.allocate_painter(vec2(5.0, ui.available_height()), Sense::hover());

        if let Some(color_idx) = color_idx {
            let color = ObserveState::source_color(color_idx);
            painter.rect_filled(res.rect, 0.0, color);
        }

        ui.label(text);
    });
}

/// Frame for table content cells.
pub fn get_cell_frame() -> Frame {
    Frame::NONE.inner_margin(Margin::symmetric(4, 0))
}

/// Apply row background and foreground colors for logs/search tables.
pub fn apply_log_row_colors(
    ui: &mut Ui,
    shared: &SessionShared,
    main_log_pos: Option<u64>,
    is_selected: bool,
) {
    // Selected wins over filters
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
