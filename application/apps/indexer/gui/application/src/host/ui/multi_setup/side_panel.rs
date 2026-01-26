use egui::{
    Align, Color32, CornerRadius, FontId, Grid, Label, Layout, Pos2, Rect, RichText, Sense, Ui,
    Vec2, Widget,
};

use crate::host::{
    common::{file_utls::format_file_size, ui_utls::side_panel_group_frame},
    ui::multi_setup::state::MultiFileState,
};

#[derive(Debug, Default)]
pub struct MultiSidePanel {
    segments_cache: Vec<FileSegment>,
}

#[derive(Debug, Clone)]
struct FileSegment {
    pub size: u64,
    pub color: Color32,
}

impl FileSegment {
    fn new(size: u64, color: Color32) -> Self {
        Self { size, color }
    }
}

impl MultiSidePanel {
    pub fn render_content(&mut self, ui: &mut Ui, state: &mut MultiFileState) {
        side_panel_group_frame(ui).show(ui, |ui| {
            Self::render_summary(ui, state);
        });

        side_panel_group_frame(ui).show(ui, |ui| {
            self.render_overview(ui, state);
        });
    }

    fn render_summary(ui: &mut Ui, state: &mut MultiFileState) {
        Label::new(RichText::new("Summary").heading())
            .selectable(false)
            .ui(ui);

        ui.add_space(6.);

        Grid::new("summary").num_columns(2).show(ui, |ui| {
            ui.label("Files in total:");
            ui.label(state.files.len().to_string());
            ui.end_row();

            ui.label("Selected files:");
            let selected_count = state.files.iter().filter(|f| f.included).count();
            ui.label(selected_count.to_string());
        });
    }

    fn render_overview(&mut self, ui: &mut Ui, state: &mut MultiFileState) {
        Label::new(RichText::new("Concat Overview").heading())
            .selectable(false)
            .ui(ui);
        ui.add_space(6.);

        // ------------------------------

        self.segments_cache.clear();

        let mut total_size = 0;
        self.segments_cache
            .extend(state.files.iter().filter(|f| f.included).map(|f| {
                let size = f.size_bytes.unwrap_or_default();
                total_size += size;
                FileSegment::new(size, f.color)
            }));

        if self.segments_cache.is_empty() {
            ui.with_layout(Layout::top_down(Align::Center), |ui| {
                Label::new(RichText::new("No file(s) selected").size(14.)).ui(ui);
            });
            return;
        }

        // *** Concatenation Bar ***
        let height = 26.0;
        let available_width = ui.available_width();

        let (rect, _response) =
            ui.allocate_exact_size(Vec2::new(available_width, height), Sense::hover());

        let painter = ui.painter();

        if total_size == 0 {
            painter.rect_filled(rect, 0, Color32::from_gray(50));
            return;
        }

        let mut current_x = rect.min.x;
        let total_width_px = rect.width();

        for (i, file) in self.segments_cache.iter().enumerate() {
            let ratio = file.size as f32 / total_size as f32;
            let seg_width = total_width_px * ratio;

            let seg_rect = Rect::from_min_size(
                Pos2::new(current_x, rect.min.y),
                Vec2::new(seg_width, height),
            );

            let corner_round = 3;

            let corner_radius = match i {
                0 => CornerRadius {
                    nw: corner_round,
                    ne: 0,
                    sw: corner_round,
                    se: 0,
                },
                n if n == self.segments_cache.len() - 1 => CornerRadius {
                    nw: 0,
                    ne: corner_round,
                    sw: 0,
                    se: corner_round,
                },
                _ => CornerRadius::ZERO,
            };

            painter.rect_filled(seg_rect, corner_radius, file.color);

            current_x += seg_width;
        }

        // Summary Overlay
        let summary_txt = format!(
            "{} / {}",
            self.segments_cache.len(),
            format_file_size(total_size)
        );

        let galley =
            painter.layout_no_wrap(summary_txt, FontId::proportional(14.0), Color32::WHITE);

        let text_rect_size = galley.rect.size();
        let center_pos = rect.center() - text_rect_size / 2.0;

        // Background Box
        let padding = Vec2::new(6.0, 2.0);
        let bg_rect = Rect::from_min_size(center_pos - padding, text_rect_size + padding * 2.0);
        painter.rect_filled(bg_rect, 0, Color32::from_black_alpha(150));

        // Draw text
        painter.galley(center_pos, galley, Color32::WHITE);
    }
}
