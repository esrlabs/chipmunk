use dlt_core::statistics::common::LevelDistribution;
use egui::Ui;
use egui_extras::{Column, TableBuilder};
use std::{cmp::Ordering, fmt::Display};

use super::RenderOutcome;
use crate::host::ui::session_setup::state::parsers::DltParserConfig;

#[derive(Clone, Copy, PartialEq)]
enum StatColumn {
    ID,
    FATAL,
    ERROR,
    WARN,
    INFO,
    DEBUG,
    VERBOSE,
    NON,
}

impl StatColumn {
    pub const fn all() -> &'static [Self] {
        // Reminder to update on new types
        match StatColumn::ID {
            StatColumn::ID => {}
            StatColumn::FATAL => {}
            StatColumn::ERROR => {}
            StatColumn::WARN => {}
            StatColumn::INFO => {}
            StatColumn::DEBUG => {}
            StatColumn::VERBOSE => {}
            StatColumn::NON => {}
        };

        &[
            StatColumn::ID,
            StatColumn::FATAL,
            StatColumn::ERROR,
            StatColumn::WARN,
            StatColumn::INFO,
            StatColumn::DEBUG,
            StatColumn::VERBOSE,
            StatColumn::NON,
        ]
    }
}

impl Display for StatColumn {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            StatColumn::ID => "ID",
            StatColumn::FATAL => "FATAL",
            StatColumn::ERROR => "ERROR",
            StatColumn::WARN => "WARN",
            StatColumn::INFO => "INFO",
            StatColumn::DEBUG => "DEBUG",
            StatColumn::VERBOSE => "VERBOSE",
            StatColumn::NON => "NON",
        };

        f.write_str(name)
    }
}

#[derive(Clone)]
struct StatRow {
    id: String,
    fatal: usize,
    error: usize,
    warn: usize,
    info: usize,
    debug: usize,
    verbose: usize,
    non: usize,
}

fn sort_rows(rows: &mut [StatRow], sort_idx: i8) {
    rows.sort_by(|a, b| {
        let ord = match sort_idx.unsigned_abs() - 1 {
            0 => a.id.cmp(&b.id),
            1 => a.fatal.cmp(&b.fatal),
            2 => a.error.cmp(&b.error),
            3 => a.warn.cmp(&b.warn),
            4 => a.info.cmp(&b.info),
            5 => a.debug.cmp(&b.debug),
            6 => a.verbose.cmp(&b.verbose),
            7 => a.non.cmp(&b.non),
            _ => Ordering::Equal,
        };

        if sort_idx < 0 { ord.reverse() } else { ord }
    });
}

fn sortable_header(ui: &mut egui::Ui, column: StatColumn, sort_idx: &mut i8) {
    let sort_column = StatColumn::all()[sort_idx.unsigned_abs() as usize - 1];

    let arrow = if sort_column == column {
        if *sort_idx > 0 { " >" } else { " <" }
    } else {
        ""
    };

    let response = ui.button(format!("{column}{arrow}"));

    if response.clicked() {
        if sort_column == column {
            *sort_idx = *sort_idx * -1;
        } else {
            *sort_idx = StatColumn::all()
                .iter()
                .position(|&c| c == column)
                .unwrap_or(0) as i8
                + 1;
        }
    }
}

pub fn render_statistics(parser: &mut DltParserConfig, ui: &mut Ui) -> RenderOutcome {
    ui.vertical(|ui| {
        add_statistics(
            ui,
            "Applications",
            &parser.app_ids,
            &mut parser.sort_idxs[0],
        );
        ui.separator();
        add_statistics(
            ui,
            "Contexts",
            &parser.context_ids,
            &mut parser.sort_idxs[1],
        );
        ui.separator();
        add_statistics(ui, "ECUs", &parser.ecu_ids, &mut parser.sort_idxs[2]);
    });

    RenderOutcome::None
}

fn add_statistics(
    ui: &mut egui::Ui,
    title: &str,
    ids_with_levels: &Vec<(String, LevelDistribution)>,
    sort_idx: &mut i8,
) {
    let mut rows = Vec::new();
    for (id, levels) in ids_with_levels {
        rows.push(StatRow {
            id: id.to_string(),
            fatal: levels.log_fatal,
            error: levels.log_error,
            warn: levels.log_warning,
            info: levels.log_info,
            debug: levels.log_debug,
            verbose: levels.log_verbose,
            non: levels.non_log,
        });
    }
    sort_rows(&mut rows, *sort_idx);
    ui_table(ui, title, &mut rows, sort_idx);
}

fn ui_table(ui: &mut egui::Ui, title: &str, rows: &mut Vec<StatRow>, sort_idx: &mut i8) {
    ui.label(title);
    ui.add_space(5.0);

    TableBuilder::new(ui)
        .id_salt(format!("statistics_table_{}", title))
        .striped(true)
        .resizable(false)
        .column(Column::remainder())
        .column(Column::remainder())
        .column(Column::remainder())
        .column(Column::remainder())
        .column(Column::remainder())
        .column(Column::remainder())
        .column(Column::remainder())
        .column(Column::remainder())
        .header(24.0, |mut header| {
            for column in StatColumn::all() {
                header.col(|ui| {
                    sortable_header(ui, *column, sort_idx);
                });
            }
        })
        .body(|mut body| {
            for row in rows.iter() {
                body.row(20.0, |mut row_ui| {
                    row_ui.col(|ui| {
                        ui.label(&row.id);
                    });
                    row_ui.col(|ui| {
                        ui.label(&row.fatal.to_string());
                    });
                    row_ui.col(|ui| {
                        ui.label(&row.error.to_string());
                    });
                    row_ui.col(|ui| {
                        ui.label(&row.warn.to_string());
                    });
                    row_ui.col(|ui| {
                        ui.label(&row.info.to_string());
                    });
                    row_ui.col(|ui| {
                        ui.label(&row.debug.to_string());
                    });
                    row_ui.col(|ui| {
                        ui.label(&row.verbose.to_string());
                    });
                    row_ui.col(|ui| {
                        ui.label(&row.non.to_string());
                    });
                });
            }
        });
}
