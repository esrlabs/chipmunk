use egui::{ScrollArea, Ui};
use egui_extras::{Column, TableBuilder};
use std::{cmp::Ordering, collections::HashSet, fmt::Display};

use super::RenderOutcome;
use crate::host::ui::session_setup::state::parsers::{
    DltParserConfig,
    dlt::{DltStatisticConfig, DltStatisticSummary},
};

#[derive(Clone, Copy, PartialEq)]
enum StatColumn {
    ID,
    FATAL,
    ERROR,
    WARN,
    INFO,
    DEBUG,
    VERBOSE,
    INVALID,
    NONE,
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
            StatColumn::INVALID => {}
            StatColumn::NONE => {}
        };

        &[
            StatColumn::ID,
            StatColumn::FATAL,
            StatColumn::ERROR,
            StatColumn::WARN,
            StatColumn::INFO,
            StatColumn::DEBUG,
            StatColumn::VERBOSE,
            StatColumn::INVALID,
            StatColumn::NONE,
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
            StatColumn::INVALID => "INVALID",
            StatColumn::NONE => "NONE",
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
    invalid: usize,
    none: usize,
}

fn sort_rows(rows: &mut [StatRow], sort_idx: i8) {
    let abs_idx = sort_idx.unsigned_abs() - 1;

    rows.sort_by(|a, b| {
        let primary = match abs_idx {
            0 => a.id.cmp(&b.id),
            1 => a.fatal.cmp(&b.fatal),
            2 => a.error.cmp(&b.error),
            3 => a.warn.cmp(&b.warn),
            4 => a.info.cmp(&b.info),
            5 => a.debug.cmp(&b.debug),
            6 => a.verbose.cmp(&b.verbose),
            7 => a.invalid.cmp(&b.invalid),
            8 => a.none.cmp(&b.none),
            _ => Ordering::Equal,
        };

        let secondary = primary.then_with(|| a.id.cmp(&b.id));

        if sort_idx < 0 {
            secondary.reverse()
        } else {
            secondary
        }
    });
}

pub fn render_statistics(parser: &mut DltParserConfig, ui: &mut Ui) -> RenderOutcome {
    ui.vertical(|ui| {
        summary_table(ui, &parser.summary());
        ui.separator();
        ScrollArea::vertical()
            .auto_shrink([false; 2])
            .show(ui, |ui| {
                ui.vertical(|ui| {
                    add_statistics(ui, "Applications", &mut parser.app_stats);
                    ui.separator();
                    add_statistics(ui, "Contexts", &mut parser.context_stats);
                    ui.separator();
                    add_statistics(ui, "ECUs", &mut parser.ecu_stats);
                });
            });
    });

    RenderOutcome::None
}

fn summary_table(ui: &mut egui::Ui, summary: &DltStatisticSummary) {
    ui.label(format!("Summary ({} / {})", summary.ids[0], summary.ids[1]));
    ui.add_space(5.0);

    TableBuilder::new(ui)
        .id_salt("summary_table")
        .vscroll(false)
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
        .column(Column::remainder())
        .header(24.0, |mut header| {
            header.col(|ui| {
                ui.label("TOTAL");
            });
            header.col(|ui| {
                ui.label("FATAL");
            });
            header.col(|ui| {
                ui.label("ERROR");
            });
            header.col(|ui| {
                ui.label("WARN");
            });
            header.col(|ui| {
                ui.label("INFO");
            });
            header.col(|ui| {
                ui.label("DEBUG");
            });
            header.col(|ui| {
                ui.label("VERBOSE");
            });
            header.col(|ui| {
                ui.label("INVALID");
            });
            header.col(|ui| {
                ui.label("NONE");
            });
        })
        .body(|mut body| {
            for i in 0..=1 {
                body.row(20.0, |mut row_ui| {
                    row_ui.col(|ui| {
                        ui.label(summary.total[i].to_string());
                    });
                    row_ui.col(|ui| {
                        ui.label(summary.fatal[i].to_string());
                    });
                    row_ui.col(|ui| {
                        ui.label(summary.error[i].to_string());
                    });
                    row_ui.col(|ui| {
                        ui.label(summary.warn[i].to_string());
                    });
                    row_ui.col(|ui| {
                        ui.label(summary.info[i].to_string());
                    });
                    row_ui.col(|ui| {
                        ui.label(summary.debug[i].to_string());
                    });
                    row_ui.col(|ui| {
                        ui.label(summary.verbose[i].to_string());
                    });
                    row_ui.col(|ui| {
                        ui.label(summary.invalid[i].to_string());
                    });
                    row_ui.col(|ui| {
                        ui.label(summary.none[i].to_string());
                    });
                });
            }
        });
}

fn add_statistics(ui: &mut egui::Ui, title: &str, stats: &mut DltStatisticConfig) {
    let mut rows = Vec::new();
    for (id, levels) in &stats.ids_with_levels {
        rows.push(StatRow {
            id: id.to_string(),
            fatal: levels.log_fatal,
            error: levels.log_error,
            warn: levels.log_warning,
            info: levels.log_info,
            debug: levels.log_debug,
            verbose: levels.log_verbose,
            invalid: levels.log_invalid,
            none: levels.non_log,
        });
    }
    sort_rows(&mut rows, stats.column_sort);

    statistics_table(
        ui,
        title,
        &mut rows,
        &mut stats.column_sort,
        &mut stats.selected_ids,
    );
}

fn statistics_table(
    ui: &mut egui::Ui,
    title: &str,
    rows: &mut Vec<StatRow>,
    column_sort: &mut i8,
    selected_ids: &mut HashSet<String>,
) {
    ui.label(title);
    ui.add_space(5.0);

    TableBuilder::new(ui)
        .id_salt(format!("statistics_table_{}", title))
        .vscroll(false)
        .striped(true)
        .resizable(false)
        .sense(egui::Sense::click())
        .column(Column::remainder())
        .column(Column::remainder())
        .column(Column::remainder())
        .column(Column::remainder())
        .column(Column::remainder())
        .column(Column::remainder())
        .column(Column::remainder())
        .column(Column::remainder())
        .column(Column::remainder())
        .header(24.0, |mut header| {
            for (col_idx, column) in StatColumn::all().iter().enumerate() {
                header.col(|ui| {
                    if is_sortable_column(rows, col_idx) {
                        let is_sorted = column_sort.unsigned_abs() as usize == col_idx + 1;

                        let arrow = if is_sorted {
                            if *column_sort > 0 { " >" } else { " <" }
                        } else {
                            ""
                        };

                        let response = ui.button(format!("{column}{arrow}"));

                        if response.clicked() {
                            if is_sorted {
                                *column_sort *= -1;
                            } else {
                                *column_sort = col_idx as i8 + 1;
                            }
                        }
                    } else {
                        ui.label(format!("{column}"));
                    }
                });
            }
        })
        .body(|mut body| {
            for row in rows {
                body.row(20.0, |mut row_ui| {
                    let is_selected = selected_ids.contains(&row.id);
                    row_ui.set_selected(is_selected);

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
                        ui.label(&row.invalid.to_string());
                    });
                    row_ui.col(|ui| {
                        ui.label(&row.none.to_string());
                    });

                    let response = row_ui.response();

                    if response.clicked() {
                        if is_selected {
                            selected_ids.remove(&row.id);
                        } else {
                            selected_ids.insert(row.id.clone());
                        }
                    }
                });
            }
        });
}

fn is_sortable_column(rows: &[StatRow], col: usize) -> bool {
    let Some(first) = rows.first() else {
        return false;
    };

    rows.iter().skip(1).any(|r| match col {
        0 => r.id != first.id,
        1 => r.fatal != first.fatal,
        2 => r.error != first.error,
        3 => r.warn != first.warn,
        4 => r.info != first.info,
        5 => r.debug != first.debug,
        6 => r.verbose != first.verbose,
        7 => r.invalid != first.invalid,
        8 => r.none != first.none,
        _ => false,
    })
}
