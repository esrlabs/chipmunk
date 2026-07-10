//! Command Palette result row rendering.

use egui::{
    Align, CursorIcon, Direction, Label, Layout, Rect, Response, RichText, Sense, Stroke,
    TextStyle, Theme, Ui, UiBuilder, Widget, text::LayoutJob, text::TextFormat, vec2,
};

use crate::{
    common::{phosphor::icons, ui::search_picker::SearchPickerText},
    host::common::parsers::ParserNames,
};

use super::{CommandAction, CommandPaletteItem};

/// Renders one selectable Command Palette result row.
pub fn render_result_row(ui: &mut Ui, item: &CommandPaletteItem, selected: bool) -> Response {
    const ROW_HEIGHT: f32 = 36.0;
    const ICON_COLUMN_WIDTH: f32 = 24.0;
    const ICON_SIZE: f32 = 16.0;
    const TITLE_FONT_SIZE: f32 = 14.0;

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
            Label::new(RichText::new(action_icon(item.action)).size(ICON_SIZE)).ui(ui);
        },
    );

    let text_rect = Rect::from_min_max(
        content_rect.min + vec2(ICON_COLUMN_WIDTH, 0.0),
        content_rect.max,
    );
    ui.scope_builder(
        UiBuilder::new()
            .max_rect(text_rect)
            .layout(Layout::left_to_right(Align::Center)),
        |ui| {
            render_title(ui, &item.title, TITLE_FONT_SIZE);
        },
    );

    response
}

fn render_title(ui: &mut Ui, title: &SearchPickerText, font_size: f32) {
    if title.highlights.is_empty() {
        Label::new(RichText::new(title.text.as_str()).size(font_size))
            .truncate()
            .ui(ui);
        return;
    }

    let mut font_id = TextStyle::Body.resolve(ui.style());
    font_id.size = font_size;
    let color = ui.visuals().text_color();
    let base_format = TextFormat {
        font_id,
        color,
        ..Default::default()
    };
    let highlight_format = TextFormat {
        underline: Stroke::new(1.0_f32, color),
        ..base_format.clone()
    };

    let mut job = LayoutJob::default();
    let mut cursor = 0;
    for range in &title.highlights {
        if cursor < range.start {
            job.append(&title.text[cursor..range.start], 0.0, base_format.clone());
        }
        job.append(
            &title.text[range.start..range.end],
            0.0,
            highlight_format.clone(),
        );
        cursor = range.end;
    }

    if cursor < title.text.len() {
        job.append(&title.text[cursor..], 0.0, base_format);
    }

    Label::new(job).truncate().ui(ui);
}

fn action_icon(action: CommandAction) -> &'static str {
    match action {
        CommandAction::GoHome => icons::regular::HOUSE,
        CommandAction::OpenFiles | CommandAction::OpenFilesWithPlugin => icons::regular::FILES,
        CommandAction::OpenFolderFiles(_) => icons::regular::FOLDER_OPEN,
        CommandAction::CloseCurrentTab => icons::regular::X,
        CommandAction::NextTab | CommandAction::PreviousTab => icons::regular::ARROWS_CLOCKWISE,
        CommandAction::OpenPluginManager
        | CommandAction::ReloadPlugins
        | CommandAction::ConnectionSetup {
            parser: ParserNames::Plugins,
            ..
        } => icons::regular::PLUG,
        CommandAction::OpenSettings => icons::regular::GEAR,
        CommandAction::ShowShortcuts => icons::regular::KEYBOARD,
        CommandAction::ShowAbout => icons::regular::INFO,
        CommandAction::SetTheme(Theme::Dark) => icons::regular::MOON,
        CommandAction::SetTheme(Theme::Light) => icons::regular::SUN,
        CommandAction::ToggleRightPanel | CommandAction::ToggleBottomPanel => {
            icons::regular::SIDEBAR
        }
        CommandAction::ToggleSdeBar => icons::regular::TERMINAL_WINDOW,
        CommandAction::ConnectionSetup { .. } => icons::regular::TERMINAL,
    }
}
