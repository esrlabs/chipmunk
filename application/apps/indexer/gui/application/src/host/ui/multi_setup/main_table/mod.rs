use egui::{Align, Label, Layout, RichText, ScrollArea, Sense, Ui, Widget, vec2};
use egui_extras::{Column, TableBuilder};

use crate::host::{
    common::ui_utls::main_panel_group_frame,
    ui::multi_setup::{main_table::table_columns::TableColumn, state::MultiFileState},
};

mod table_columns;

pub fn render_content(ui: &mut Ui, state: &mut MultiFileState) {
    main_panel_group_frame(ui).show(ui, |ui| {
        Label::new(RichText::new("Multiple files").heading())
            .selectable(false)
            .ui(ui);

        ui.add_space(10.);

        ScrollArea::horizontal().show(ui, |ui| {
            render_table(ui, state);
            ui.add_space(5.);
        });
    });
}

fn render_table(ui: &mut Ui, state: &mut MultiFileState) {
    let available_height = ui.available_height();
    let table = TableBuilder::new(ui)
        .auto_shrink(true)
        .drag_to_scroll(false)
        .striped(false)
        .resizable(false)
        .cell_layout(Layout::left_to_right(Align::Center))
        .column(Column::initial(10.0)) // Color
        .column(Column::initial(50.0)) // type
        .column(Column::remainder()) // name
        .column(Column::initial(200.0)) // path
        .column(Column::initial(70.0)) // size
        .column(Column::initial(130.0)) // modify date
        .min_scrolled_height(0.0)
        .max_scroll_height(available_height)
        .sense(Sense::click());

    table
        .header(20.0, |mut header| {
            for column in TableColumn::all() {
                header.col(|ui| table_header(ui, *column));
            }
        })
        .body(|body| {
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
                row.col(|ui| table_cell_text(ui, file.parent_path.to_owned().unwrap_or_default()));
                row.col(|ui| table_cell_text(ui, file.size_txt.to_owned().unwrap_or_default()));
                row.col(|ui| table_cell_text(ui, file.last_modify.to_owned().unwrap_or_default()));

                if row.response().clicked() {
                    file.included = !file.included;
                }
            });
        });
}

fn table_header(ui: &mut Ui, column: TableColumn) {
    Label::new(RichText::new(column.header()).strong())
        .selectable(false)
        .ui(ui);
}

fn table_cell_text(ui: &mut Ui, content: String) {
    Label::new(content).selectable(false).truncate().ui(ui);
}
