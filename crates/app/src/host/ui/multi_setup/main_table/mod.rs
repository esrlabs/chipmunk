//! Multi-file setup table rendering and click-driven sorting.

use std::path::Path;

use egui::{
    Align, Align2, CursorIcon, Label, Layout, Rect, Response, RichText, ScrollArea, Sense, Stroke,
    TextStyle, Ui, Widget, pos2, vec2,
};
use egui_extras::{Column, TableBuilder};
use enum_iterator::all;

use crate::{
    common::phosphor::icons,
    host::{
        common::{
            colors::SOURCE_HIGHLIGHT_COLORS,
            ui_utls::{main_panel_group_frame, truncate_path_to_width},
        },
        ui::multi_setup::{
            main_table::table_columns::TableColumn,
            state::{FileUiState, MultiFileState},
        },
    },
};

mod table_columns;

/// Multi-file table with persistent column sorting state.
#[derive(Debug, Default)]
pub struct MainTable {
    sort: Option<TableSort>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct TableSort {
    column: TableColumn,
    direction: SortDirection,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SortDirection {
    Ascending,
    Descending,
}

impl MainTable {
    /// Renders the table and applies sorting requested through its headers.
    pub fn render_content(&mut self, ui: &mut Ui, state: &mut MultiFileState) {
        main_panel_group_frame(ui).show(ui, |ui| {
            ui.label(RichText::new("Multiple files").heading());

            ui.add_space(10.);

            ScrollArea::horizontal().show(ui, |ui| {
                self.render_table(ui, state);
                ui.add_space(5.);
            });
        });
    }

    fn render_table(&mut self, ui: &mut Ui, state: &mut MultiFileState) {
        let available_height = ui.available_height();
        let table = TableBuilder::new(ui)
            .auto_shrink(true)
            .drag_to_scroll(false)
            .striped(false)
            .resizable(false)
            .cell_layout(Layout::left_to_right(Align::Center))
            .column(Column::initial(10.0)) // Color
            .column(Column::initial(60.0)) // type
            .column(Column::remainder().at_least(120.0)) // name
            .column(Column::initial(200.0)) // path
            .column(Column::initial(70.0)) // size
            .column(Column::initial(140.0)) // modify date
            .min_scrolled_height(0.0)
            .max_scroll_height(available_height)
            .sense(Sense::click());

        let mut requested_sort = None;
        let table = table.header(20.0, |mut header| {
            for column in all::<TableColumn>() {
                header.col(|ui| {
                    if table_header(ui, column, self.sort).clicked() {
                        requested_sort = Some(column);
                    }
                });
            }
        });

        if let Some(column) = requested_sort {
            self.sort_files(&mut state.files, column);
        }

        let mut inclusion_changed = false;
        table.body(|body| {
            body.rows(20.0, state.files.len(), |mut row| {
                let file = &mut state.files[row.index()];

                row.set_selected(file.included);

                row.col(|ui| {
                    let (res, paint) =
                        ui.allocate_painter(vec2(10.0, ui.available_height()), Sense::hover());
                    paint.rect_filled(res.rect, 0, file.color);
                });

                row.col(|ui| table_cell_text(ui, file.format.to_string()));
                row.col(|ui| table_cell_text(ui, file.name.to_owned()));
                row.col(|ui| table_cell_path(ui, file.parent_path.as_deref().unwrap_or_default()));
                row.col(|ui| table_cell_text(ui, file.size_txt.to_owned().unwrap_or_default()));
                row.col(|ui| table_cell_text(ui, file.last_modify.to_owned().unwrap_or_default()));

                if row.response().clicked() {
                    file.included = !file.included;
                    inclusion_changed = true;
                }
            });
        });

        if inclusion_changed {
            assign_source_colors(&mut state.files);
        }
    }

    fn sort_files(&mut self, files: &mut [FileUiState], column: TableColumn) {
        if column == TableColumn::Color {
            return;
        }

        let direction = match self.sort {
            Some(sort) if sort.column == column => match sort.direction {
                SortDirection::Ascending => SortDirection::Descending,
                SortDirection::Descending => SortDirection::Ascending,
            },
            _ => SortDirection::Ascending,
        };

        let sort = TableSort { column, direction };
        self.sort = Some(sort);
        files.sort_by(|left, right| {
            let ordering = column.compare(left, right);
            match direction {
                SortDirection::Ascending => ordering,
                SortDirection::Descending => ordering.reverse(),
            }
        });
        assign_source_colors(files);
    }
}

fn assign_source_colors(files: &mut [FileUiState]) {
    // Concat source indexes exclude files that are not included in the command.
    let colors = SOURCE_HIGHLIGHT_COLORS.iter().copied().cycle();
    for (file, color) in files.iter_mut().filter(|file| file.included).zip(colors) {
        file.color = color;
    }
}

fn table_header(ui: &mut Ui, column: TableColumn, sort: Option<TableSort>) -> Response {
    if column == TableColumn::Color {
        return ui.label(RichText::new(column.header()).strong());
    }

    const HORIZONTAL_PADDING: f32 = 2.0;
    const ICON_GAP: f32 = 3.0;
    const ICON_SLOT_WIDTH: f32 = 14.0;

    let text_color = ui.visuals().strong_text_color();
    let label_font = TextStyle::Body.resolve(ui.style());
    let label_galley =
        ui.painter()
            .layout_no_wrap(column.header().to_owned(), label_font, text_color);
    let desired_width =
        label_galley.size().x + ICON_GAP + ICON_SLOT_WIDTH + HORIZONTAL_PADDING * 2.0;
    let desired_size = vec2(
        desired_width.min(ui.available_width()),
        ui.available_height(),
    );
    let (rect, response) = ui.allocate_exact_size(desired_size, Sense::click());
    let response = response.on_hover_cursor(CursorIcon::PointingHand);
    let visuals = ui.style().interact(&response);

    if response.hovered() || response.is_pointer_button_down_on() {
        ui.painter()
            .rect_filled(rect, visuals.corner_radius, visuals.weak_bg_fill);
    }

    let icon_rect = Rect::from_min_max(
        pos2(
            rect.max.x - HORIZONTAL_PADDING - ICON_SLOT_WIDTH,
            rect.min.y,
        ),
        pos2(rect.max.x - HORIZONTAL_PADDING, rect.max.y),
    );
    let label_pos = pos2(
        rect.min.x + HORIZONTAL_PADDING,
        rect.center().y - label_galley.size().y / 2.0,
    );
    let label_clip = Rect::from_min_max(rect.min, pos2(icon_rect.min.x - ICON_GAP, rect.max.y));
    ui.painter()
        .with_clip_rect(label_clip)
        .galley(label_pos, label_galley, text_color);

    if let Some(sort) = sort.filter(|sort| sort.column == column) {
        let icon = match sort.direction {
            SortDirection::Ascending => icons::regular::SORT_ASCENDING,
            SortDirection::Descending => icons::regular::SORT_DESCENDING,
        };
        let accent_color = ui.visuals().selection.stroke.color;
        let icon_font = TextStyle::Body.resolve(ui.style());
        ui.painter().text(
            icon_rect.center(),
            Align2::CENTER_CENTER,
            icon,
            icon_font,
            accent_color,
        );
        ui.painter().hline(
            rect.x_range(),
            rect.bottom() - 1.0,
            Stroke::new(1.0_f32, accent_color),
        );
    }

    response
}

fn table_cell_text(ui: &mut Ui, content: String) {
    Label::new(content).truncate().ui(ui);
}

fn table_cell_path(ui: &mut Ui, path: &str) {
    let path_txt =
        truncate_path_to_width(ui, Path::new(path), ui.available_width(), TextStyle::Body);
    let response = Label::new(path_txt.text)
        .truncate()
        .show_tooltip_when_elided(false)
        .ui(ui);
    if path_txt.truncated {
        response.on_hover_ui(|ui| {
            ui.set_max_width(ui.spacing().tooltip_width);
            ui.label(path);
        });
    }
}

#[cfg(test)]
mod tests {
    use std::{
        path::{Path, PathBuf},
        time::{Duration, UNIX_EPOCH},
    };

    use egui::Color32;
    use stypes::FileFormat;

    use super::{
        MainTable, SOURCE_HIGHLIGHT_COLORS, SortDirection, TableColumn, TableSort,
        assign_source_colors,
    };
    use crate::host::ui::multi_setup::state::FileUiState;

    fn test_file(name: &str, path: &str, format: FileFormat) -> FileUiState {
        FileUiState {
            name: name.to_owned(),
            path: PathBuf::from(path),
            parent_path: None,
            format,
            size_bytes: None,
            size_txt: None,
            modified_at: None,
            last_modify: None,
            color: Color32::BLACK,
            included: true,
        }
    }

    #[test]
    fn sort_requests_toggle_and_new_columns_start_ascending() {
        let mut files = vec![
            test_file("b", "/b", FileFormat::Text),
            test_file("a", "/a", FileFormat::Text),
            test_file("c", "/c", FileFormat::Text),
        ];
        files[0].size_bytes = Some(1);
        files[1].size_bytes = Some(3);
        files[2].size_bytes = Some(2);
        let mut table = MainTable::default();

        table.sort_files(&mut files, TableColumn::Name);
        assert_eq!(
            files
                .iter()
                .map(|file| file.name.as_str())
                .collect::<Vec<_>>(),
            ["a", "b", "c"]
        );
        let expected_sort = TableSort {
            column: TableColumn::Name,
            direction: SortDirection::Ascending,
        };
        assert_eq!(table.sort, Some(expected_sort));

        table.sort_files(&mut files, TableColumn::Name);
        assert_eq!(
            files
                .iter()
                .map(|file| file.name.as_str())
                .collect::<Vec<_>>(),
            ["c", "b", "a"]
        );
        let expected_sort = TableSort {
            column: TableColumn::Name,
            direction: SortDirection::Descending,
        };
        assert_eq!(table.sort, Some(expected_sort));

        table.sort_files(&mut files, TableColumn::Size);
        assert_eq!(
            files
                .iter()
                .map(|file| file.name.as_str())
                .collect::<Vec<_>>(),
            ["b", "c", "a"]
        );
        let expected_sort = TableSort {
            column: TableColumn::Size,
            direction: SortDirection::Ascending,
        };
        assert_eq!(table.sort, Some(expected_sort));
    }

    #[test]
    fn sorting_reassigns_colors_by_included_order() {
        let mut files = vec![
            test_file("c", "/c", FileFormat::Text),
            test_file("b", "/b", FileFormat::Text),
            test_file("a", "/a", FileFormat::Text),
        ];
        files[1].included = false;
        files[1].color = Color32::WHITE;

        MainTable::default().sort_files(&mut files, TableColumn::Name);

        assert_eq!(files[0].color, SOURCE_HIGHLIGHT_COLORS[0]);
        assert_eq!(files[1].color, Color32::WHITE);
        assert_eq!(files[2].color, SOURCE_HIGHLIGHT_COLORS[1]);

        files[1].included = true;
        assign_source_colors(&mut files);

        assert_eq!(
            files.iter().map(|file| file.color).collect::<Vec<_>>(),
            SOURCE_HIGHLIGHT_COLORS[..3]
        );
    }

    #[test]
    fn types_sort_in_displayed_alphabetical_order() {
        let mut files = vec![
            test_file("text", "/text", FileFormat::Text),
            test_file("pcap-ng", "/pcap-ng", FileFormat::PcapNG),
            test_file("binary", "/binary", FileFormat::Binary),
            test_file("pcap", "/pcap", FileFormat::PcapLegacy),
        ];

        MainTable::default().sort_files(&mut files, TableColumn::Type);

        assert_eq!(
            files.iter().map(|file| file.format).collect::<Vec<_>>(),
            [
                FileFormat::Binary,
                FileFormat::PcapLegacy,
                FileFormat::PcapNG,
                FileFormat::Text,
            ]
        );
    }

    #[test]
    fn paths_sort_by_complete_path() {
        let mut first = test_file("z.log", "/a/z.log", FileFormat::Text);
        first.parent_path = Some("/z".to_owned());
        let mut second = test_file("a.log", "/b/a.log", FileFormat::Text);
        second.parent_path = Some("/a".to_owned());
        let mut files = vec![second, first];

        MainTable::default().sort_files(&mut files, TableColumn::Path);

        assert_eq!(
            files
                .iter()
                .map(|file| file.path.as_path())
                .collect::<Vec<_>>(),
            [Path::new("/a/z.log"), Path::new("/b/a.log")]
        );
    }

    #[test]
    fn modification_dates_sort_chronologically() {
        let mut newer = test_file("newer", "/newer", FileFormat::Text);
        newer.modified_at = Some(UNIX_EPOCH + Duration::from_secs(20));
        newer.last_modify = Some("01/01/1970, 00:00:00".to_owned());
        let mut older = test_file("older", "/older", FileFormat::Text);
        older.modified_at = Some(UNIX_EPOCH + Duration::from_secs(10));
        older.last_modify = Some("31/12/2099, 23:59:59".to_owned());
        let mut files = vec![newer, older];

        MainTable::default().sort_files(&mut files, TableColumn::ModifyDate);

        assert_eq!(
            files
                .iter()
                .map(|file| file.name.as_str())
                .collect::<Vec<_>>(),
            ["older", "newer"]
        );
    }
}
