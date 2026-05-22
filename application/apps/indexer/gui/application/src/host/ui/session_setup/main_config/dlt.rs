use super::RenderOutcome;
use crate::host::ui::session_setup::state::parsers::DltParserConfig;
use egui::{ScrollArea, Ui};

pub fn render_statistics(parser: &mut DltParserConfig, ui: &mut Ui) -> RenderOutcome {
    if parser.dlt_statistics.is_none() {
        ui.with_layout(egui::Layout::top_down(egui::Align::Center), |ui| {
            let available = ui.available_height();
            ui.add_space(available * 0.45);

            ui.vertical_centered(|ui| {
                ui.spinner();
                ui.add_space(8.0);
                ui.label("Analyzing DLT structure...");
            });
        });

        return RenderOutcome::CollectStatistics;
    }

    ui.vertical(|ui| {
        if parser.dlt_tables.take_changed() {
            parser.update_summary();
        }

        if let Some(dlt_statistics) = &parser.dlt_statistics {
            summary::table(ui, &parser.dlt_summary);
            summary::chart(ui, &parser.dlt_summary);
            ui.separator();

            ScrollArea::vertical()
                .auto_shrink([false; 2])
                .show(ui, |ui| {
                    ui.vertical(|ui| {
                        statistics::table(
                            ui,
                            "Applications",
                            &dlt_statistics.app_ids,
                            &mut parser.dlt_tables.app_table,
                        );
                        ui.separator();
                        statistics::table(
                            ui,
                            "Contexts",
                            &dlt_statistics.ctx_ids,
                            &mut parser.dlt_tables.ctx_table,
                        );
                        ui.separator();
                        statistics::table(
                            ui,
                            "ECUs",
                            &dlt_statistics.ecu_ids,
                            &mut parser.dlt_tables.ecu_table,
                        );
                    });
                });
        }
    });

    RenderOutcome::None
}

pub mod summary {
    use egui::{Color32, RichText, Sense, TextStyle, Ui, vec2};
    use egui_extras::{Column, TableBuilder};
    use egui_plot::{Bar, BarChart, Plot};

    use crate::host::ui::session_setup::state::parsers::dlt::DltSummary;

    const COLUMN_NAMES: [&str; 9] = [
        "TOTAL", "FATAL", "ERROR", "WARN", "INFO", "DEBUG", "VERBOSE", "NONE", "INVALID",
    ];

    const LEVEL_WITH_COLORS: [(&str, Color32); 8] = [
        ("FATAL", Color32::from_rgb(220, 20, 60)),
        ("ERROR", Color32::from_rgb(255, 69, 0)),
        ("WARN", Color32::from_rgb(255, 140, 0)),
        ("INFO", Color32::from_rgb(60, 179, 113)),
        ("DEBUG", Color32::from_rgb(30, 144, 255)),
        ("VERBOSE", Color32::from_rgb(138, 43, 226)),
        ("NONE", Color32::from_rgb(192, 192, 192)),
        ("INVALID", Color32::from_rgb(128, 128, 128)),
    ];

    pub fn table(ui: &mut Ui, summary: &DltSummary) {
        let title = format!("Summary ({} / {})", summary.total.ids, summary.selected.ids);
        ui.label(RichText::new(title).strong());
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
                for name in COLUMN_NAMES.iter() {
                    header.col(|ui| {
                        ui.label(*name);
                    });
                }
            })
            .body(|mut body| {
                for (count, levels) in [
                    (summary.total.count, summary.total.levels),
                    (summary.selected.count, summary.selected.levels),
                ] {
                    body.row(20.0, |mut row_ui| {
                        row_ui.col(|ui| {
                            ui.label(count.to_string());
                        });
                        for level in levels {
                            row_ui.col(|ui| {
                                ui.label(level.to_string());
                            });
                        }
                    });
                }
            });
    }

    pub fn chart(ui: &mut Ui, summary: &DltSummary) {
        let mut charts: Vec<BarChart> = Vec::new();

        for (i, (_, color)) in LEVEL_WITH_COLORS.iter().enumerate() {
            let total = percent(summary.total.levels[i] as f64, summary.total.count as f64);
            let selected = percent(
                summary.selected.levels[i] as f64,
                summary.total.count as f64,
            );
            let mut chart = BarChart::new(
                format!("summary_chart_bar_{}", i),
                vec![
                    Bar::new(0.5, total).fill(*color),
                    Bar::new(0.0, selected).fill(*color),
                ],
            )
            .width(0.4)
            .color(*color)
            .horizontal();

            if let Some(prev) = charts.last() {
                chart = chart.stack_on(&[prev]);
            }

            charts.push(chart);
        }

        let back = BarChart::new(
            "summary_chart_background",
            vec![Bar::new(0.5, 100.0), Bar::new(0.0, 100.0)],
        )
        .width(0.4)
        .color(Color32::from_rgb(192, 192, 192))
        .horizontal();

        charts.insert(0, back);

        Plot::new("summary_chart")
            .height(70.0)
            .show_background(false)
            .allow_drag(false)
            .allow_zoom(false)
            .allow_scroll(false)
            .allow_boxed_zoom(false)
            .show_grid(false)
            .show_axes(false)
            .show_x(false)
            .show_y(false)
            .x_axis_formatter(|_, _| String::new())
            .y_axis_formatter(|_, _| String::new())
            .show(ui, |plot_ui| {
                for chart in charts {
                    plot_ui.bar_chart(chart);
                }
            });

        // chart legend
        ui.horizontal(|ui| {
            for (level, color) in LEVEL_WITH_COLORS.iter() {
                let (rect, _) = ui.allocate_exact_size(vec2(10.0, 10.0), Sense::empty());
                ui.painter().rect_filled(rect, 2.0, *color);
                ui.label(RichText::new(*level).text_style(TextStyle::Small));
            }
        });
    }

    fn percent(value: f64, max: f64) -> f64 {
        if max > 0.0 { value / max * 100.0 } else { 0.0 }
    }
}

pub mod statistics {
    use egui::{Button, RichText, Sense, TextWrapMode, Ui};
    use egui_extras::{Column, TableBuilder};
    use rustc_hash::FxHashMap;
    use std::cmp::Ordering;

    use crate::{
        common::phosphor::icons,
        host::{
            common::dlt_stats::LevelDistribution,
            ui::session_setup::state::parsers::dlt::TableConfig,
        },
    };

    const COLUMN_NAMES: [&str; 9] = [
        "ID", "FATAL", "ERROR", "WARN", "INFO", "DEBUG", "VERBOSE", "NONE", "INVALID",
    ];

    pub fn table(
        ui: &mut Ui,
        name: &str,
        stats: &FxHashMap<String, LevelDistribution>,
        state: &mut TableConfig,
    ) {
        ui.horizontal(|ui| {
            let title = format!("{} ({} / {})", name, stats.len(), state.selected_ids.len());
            ui.label(RichText::new(title).strong());

            let icon = if state.is_collapsed {
                icons::regular::CARET_RIGHT
            } else {
                icons::regular::CARET_DOWN
            };

            if ui
                .add(
                    Button::new(RichText::new(icon).size(12.0))
                        .frame(false)
                        .small(),
                )
                .clicked()
            {
                state.is_collapsed = !state.is_collapsed;
            }
        });

        ui.add_space(5.0);
        if state.is_collapsed {
            return;
        }

        let mut rows = Vec::new();
        for (id, levels) in stats {
            rows.push((id, levels.values()));
        }
        if let Some(sort) = state.column_sort {
            sort_rows(&mut rows, sort);
        }

        TableBuilder::new(ui)
            .id_salt(format!("statistics_table_{}", name))
            .vscroll(false)
            .striped(true)
            .resizable(false)
            .sense(Sense::click())
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
                for (idx, name) in COLUMN_NAMES.iter().enumerate() {
                    header.col(|ui| {
                        if is_sortable_column(&rows, idx) {
                            let is_sorted = state.column_sort.is_some_and(|(col, _)| col == idx);

                            let icon = if is_sorted && let Some((_, asc)) = state.column_sort {
                                if asc {
                                    format!(" {}", icons::regular::SORT_ASCENDING)
                                } else {
                                    format!(" {}", icons::regular::SORT_DESCENDING)
                                }
                            } else {
                                "".to_string()
                            };

                            let response = ui.add(
                                Button::new(format!("{name}{icon}"))
                                    .wrap_mode(TextWrapMode::Extend),
                            );

                            if response.clicked() {
                                if is_sorted && let Some((_, asc)) = &mut state.column_sort {
                                    *asc = !*asc;
                                } else if idx == 0 {
                                    state.column_sort = Some((idx, true));
                                } else {
                                    state.column_sort = Some((idx, false));
                                }
                            }
                        } else {
                            ui.label(name.to_string());
                        }
                    });
                }
            })
            .body(|mut body| {
                for (id, levels) in rows {
                    body.row(20.0, |mut row_ui| {
                        let is_selected = state.selected_ids.contains(id);
                        row_ui.set_selected(is_selected);

                        row_ui.col(|ui| {
                            ui.label(id);
                        });

                        for level in levels {
                            row_ui.col(|ui| {
                                ui.label(level.to_string());
                            });
                        }

                        let response = row_ui.response();

                        if response.clicked() {
                            if is_selected {
                                state.selected_ids.remove(id);
                            } else {
                                state.selected_ids.insert(id.clone());
                            }
                            state.is_changed = true;
                        }
                    });
                }
            });
    }

    fn is_sortable_column(rows: &[(&String, [usize; 8])], col: usize) -> bool {
        let Some(first) = rows.first() else {
            return false;
        };

        rows.iter().skip(1).any(|row| match col {
            0 => row.0 != first.0,
            1 => row.1[0] != first.1[0],
            2 => row.1[1] != first.1[1],
            3 => row.1[2] != first.1[2],
            4 => row.1[3] != first.1[3],
            5 => row.1[4] != first.1[4],
            6 => row.1[5] != first.1[5],
            7 => row.1[6] != first.1[6],
            8 => row.1[7] != first.1[7],
            _ => false,
        })
    }

    fn sort_rows(rows: &mut [(&String, [usize; 8])], sort: (usize, bool)) {
        rows.sort_by(|a, b| {
            let ord = match sort.0 {
                0 => a.0.cmp(b.0),
                1 => a.1[0].cmp(&b.1[0]),
                2 => a.1[1].cmp(&b.1[1]),
                3 => a.1[2].cmp(&b.1[2]),
                4 => a.1[3].cmp(&b.1[3]),
                5 => a.1[4].cmp(&b.1[4]),
                6 => a.1[5].cmp(&b.1[5]),
                7 => a.1[6].cmp(&b.1[6]),
                8 => a.1[7].cmp(&b.1[7]),
                _ => Ordering::Equal,
            }
            .then_with(|| a.0.cmp(b.0));

            if sort.1 { ord } else { ord.reverse() }
        });
    }
}
