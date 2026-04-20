//! Shared recent-session row rendering used by host UI surfaces.

use egui::{Align, Button, Label, Layout, RichText, Sense, Sides, Ui, UiBuilder, Widget, vec2};

use crate::{
    common::phosphor::icons,
    host::ui::storage::{RecentSessionSnapshot, RecentSessionSource},
};

const ROW_HEIGHT: f32 = 50.0;
// Keep in sync with the current two-line row layout.
const TEXT_BLOCK_TOP_SPACING: f32 = 8.0;
const CONTENT_PADDING_X: f32 = 8.0;
const CONTENT_PADDING_Y: f32 = 0.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecentSessionRowAction {
    RestoreSession,
    RestoreParserConfiguration,
    OpenClean,
    Remove,
}

/// Row-level feature flags for one recent-session entry.
#[derive(Debug, Clone, Default)]
pub struct RecentSessionRowOptions {
    /// Enables the clean-open button and menu action for surfaces that support it.
    pub show_clean_open: bool,
}

/// Renders one recent-session row and returns the user action triggered on it.
pub fn render_recent_session_row(
    ui: &mut Ui,
    session: &RecentSessionSnapshot,
    options: &RecentSessionRowOptions,
) -> Option<RecentSessionRowAction> {
    let (rect, response) =
        ui.allocate_exact_size(vec2(ui.available_width(), ROW_HEIGHT), Sense::click());
    let mut action = None;

    response.context_menu(|ui| render_row_menu(ui, session, options, &mut action));

    if response.hovered() {
        ui.painter()
            .rect_filled(rect, 0.0, ui.visuals().widgets.hovered.bg_fill);
    }

    let content_rect = rect.shrink2(vec2(CONTENT_PADDING_X, CONTENT_PADDING_Y));

    ui.scope_builder(UiBuilder::new().max_rect(content_rect), |ui| {
        Sides::new()
            .shrink_left()
            .truncate()
            .height(ROW_HEIGHT)
            .show(
                ui,
                |ui| {
                    let content = ui.with_layout(Layout::left_to_right(Align::Center), |ui| {
                        ui.take_available_width();
                        render_source_badge(ui, session);
                        ui.vertical(|ui| {
                            ui.add_space(TEXT_BLOCK_TOP_SPACING);
                            Label::new(RichText::new(session.title()).strong())
                                .truncate()
                                .ui(ui);

                            Label::new(RichText::new(session.summary()).size(13.0))
                                .truncate()
                                .ui(ui);
                        });
                    });
                    content.response.on_hover_ui(|ui| {
                        ui.set_max_width(ui.spacing().tooltip_width);
                        ui.label(session.tooltip());
                    });
                },
                |ui| render_row_actions(ui, session, options, &mut action),
            );
    });

    if response.double_clicked() && action.is_none() {
        action = Some(RecentSessionRowAction::RestoreSession);
    }

    action
}

fn render_row_actions(
    ui: &mut Ui,
    session: &RecentSessionSnapshot,
    options: &RecentSessionRowOptions,
    action: &mut Option<RecentSessionRowAction>,
) {
    ui.horizontal_centered(|ui| {
        if recent_action_button(icons::regular::ARROW_COUNTER_CLOCKWISE)
            .ui(ui)
            .on_hover_text("Restore session")
            .clicked()
        {
            *action = Some(RecentSessionRowAction::RestoreSession);
        }

        if recent_action_button(icons::regular::SLIDERS_HORIZONTAL)
            .ui(ui)
            .on_hover_text("Open with saved parser configuration")
            .clicked()
        {
            *action = Some(RecentSessionRowAction::RestoreParserConfiguration);
        }

        if options.show_clean_open {
            let clean_open = ui
                .add_enabled(
                    session.supports_clean_open(),
                    recent_action_button(icons::regular::ARROW_SQUARE_OUT),
                )
                .on_hover_text("Open as a fresh session without restoring saved state")
                .on_disabled_hover_text("Clean open is currently only available for file sessions");

            if clean_open.clicked() {
                *action = Some(RecentSessionRowAction::OpenClean);
            }
        }
    });
}

fn render_row_menu(
    ui: &mut Ui,
    session: &RecentSessionSnapshot,
    options: &RecentSessionRowOptions,
    action: &mut Option<RecentSessionRowAction>,
) {
    if ui.button("Restore session").clicked() {
        *action = Some(RecentSessionRowAction::RestoreSession);
    }

    if ui.button("Restore parser settings").clicked() {
        *action = Some(RecentSessionRowAction::RestoreParserConfiguration);
    }

    if options.show_clean_open
        && session.supports_clean_open()
        && ui.button("Open without saved state").clicked()
    {
        *action = Some(RecentSessionRowAction::OpenClean);
    }

    ui.separator();

    if ui.button("Remove").clicked() {
        *action = Some(RecentSessionRowAction::Remove);
    }
}

fn render_source_badge(ui: &mut Ui, session: &RecentSessionSnapshot) {
    let icon = source_badge_icon(session);
    let icon = RichText::new(icon).size(19.0);

    Label::new(icon).ui(ui);
}

fn source_badge_icon(session: &RecentSessionSnapshot) -> &'static str {
    match session.sources().first() {
        Some(RecentSessionSource::File { .. }) => icons::regular::FILE,
        Some(RecentSessionSource::Stream { transport }) => match transport {
            stypes::Transport::Process(_) => icons::regular::TERMINAL_WINDOW,
            stypes::Transport::TCP(_) => icons::regular::PLUGS_CONNECTED,
            stypes::Transport::UDP(_) => icons::regular::BROADCAST,
            stypes::Transport::Serial(_) => icons::regular::USB,
        },
        None => icons::regular::FILE,
    }
}

fn recent_action_button(icon: &'static str) -> Button<'static> {
    Button::new(RichText::new(icon).size(16.0))
        .frame(false)
        .frame_when_inactive(false)
}
