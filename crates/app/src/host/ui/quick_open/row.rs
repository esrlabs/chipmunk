//! Quick Open result row rendering.

use egui::{
    Align, CursorIcon, Direction, Label, Layout, Rect, Response, RichText, Sense, Stroke,
    TextStyle, Ui, UiBuilder, Widget, text::LayoutJob, text::TextFormat, vec2,
};

use crate::common::{phosphor::icons, ui::search_picker::SearchPickerText};

use super::QuickOpenItem;

/// Renders one selectable Quick Open result row.
pub fn render_result_row(ui: &mut Ui, item: &QuickOpenItem, selected: bool) -> Response {
    const ROW_HEIGHT: f32 = 48.0;
    const ICON_COLUMN_WIDTH: f32 = 24.0;
    const ICON_SIZE: f32 = 16.0;

    let (rect, response) =
        ui.allocate_exact_size(vec2(ui.available_width(), ROW_HEIGHT), Sense::click());
    let response = response.on_hover_cursor(CursorIcon::PointingHand);

    let background = if selected {
        Some(ui.visuals().selection.bg_fill)
    } else if response.hovered() {
        Some(ui.visuals().widgets.hovered.bg_fill)
    } else {
        None
    };

    if let Some(background) = background {
        ui.painter().rect_filled(rect, 0.0, background);
    }

    let content_rect = rect.shrink2(vec2(8.0, 4.0));
    let icon_rect = Rect::from_min_size(
        content_rect.min,
        vec2(ICON_COLUMN_WIDTH, content_rect.height()),
    );
    ui.scope_builder(
        UiBuilder::new()
            .max_rect(icon_rect)
            .layout(Layout::centered_and_justified(Direction::LeftToRight)),
        |ui| {
            Label::new(RichText::new(item_icon(item)).size(ICON_SIZE)).ui(ui);
        },
    );

    let text_rect = Rect::from_min_max(
        content_rect.min + vec2(ICON_COLUMN_WIDTH, 0.0),
        content_rect.max,
    );
    ui.scope_builder(
        UiBuilder::new()
            .max_rect(text_rect)
            .layout(Layout::top_down(Align::Min)),
        |ui| match item {
            QuickOpenItem::RecentSession { title, summary, .. } => {
                render_text_line(ui, title, true);
                render_text_line(ui, summary, false);
            }
            QuickOpenItem::FavoriteFile {
                name, path_text, ..
            } => {
                render_text_line(ui, name, true);
                render_text_line(ui, path_text, false);
            }
        },
    );

    response
}

fn render_text_line(ui: &mut Ui, text: &SearchPickerText, primary: bool) {
    if text.highlights.is_empty() {
        let content = if primary {
            RichText::new(text.text.as_str()).strong()
        } else {
            RichText::new(text.text.as_str()).size(13.0)
        };
        Label::new(content).truncate().ui(ui);
        return;
    }

    let job = highlighted_layout(ui, text, primary);
    Label::new(job).truncate().ui(ui);
}

fn highlighted_layout(ui: &Ui, text: &SearchPickerText, primary: bool) -> LayoutJob {
    let mut font_id = TextStyle::Body.resolve(ui.style());
    if !primary {
        font_id.size = 13.0;
    }

    let color = if primary {
        ui.visuals().strong_text_color()
    } else {
        ui.visuals().text_color()
    };
    let base_format = TextFormat {
        font_id,
        color,
        ..Default::default()
    };
    let highlight_format = TextFormat {
        underline: Stroke::new(1.25_f32, color),
        ..base_format.clone()
    };

    let mut job = LayoutJob::default();
    let mut cursor = 0;
    for range in &text.highlights {
        if cursor < range.start {
            job.append(&text.text[cursor..range.start], 0.0, base_format.clone());
        }
        job.append(
            &text.text[range.start..range.end],
            0.0,
            highlight_format.clone(),
        );
        cursor = range.end;
    }

    if cursor < text.text.len() {
        job.append(&text.text[cursor..], 0.0, base_format);
    }

    job
}

fn item_icon(item: &QuickOpenItem) -> &'static str {
    match item {
        QuickOpenItem::RecentSession { .. } => icons::regular::ARROW_COUNTER_CLOCKWISE,
        QuickOpenItem::FavoriteFile { .. } => icons::regular::FILE,
    }
}
